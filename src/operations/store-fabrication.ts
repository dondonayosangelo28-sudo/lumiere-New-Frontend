import { oldSystemApis, v51ContractApis } from "./apiClients"
import type {
  AfterShiftPhoto,
  CustomFabricationSpec,
  FabricationJob,
} from "./types"
import { mutateOperationsStore, type OpsActor } from "./store-core"

/**
 * Custom Fabrication (D02 & Scenario 2):
 * Creates or updates a production job for an event's custom item.
 */
export function createCustomFabricationJob(
  eventId: string,
  spec: Omit<CustomFabricationSpec, "id">,
  assignedCrewEmails: string[],
): { ok: true; job: FabricationJob } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }
    if (!spec.name.trim()) return { ok: false, error: "Custom item name is required." }

    const fullSpec: CustomFabricationSpec = {
      ...spec,
      id: `cust-${Date.now().toString().slice(-5)}`,
    }
    order.customSpecs.push(fullSpec)

    const job: FabricationJob = {
      id: `fab-${Date.now().toString().slice(-5)}`,
      eventId,
      eventTitle: order.eventTitle,
      customItemId: fullSpec.id,
      spec: fullSpec,
      status: "In Production",
      assignedCrewEmails: assignedCrewEmails.length > 0 ? assignedCrewEmails : ["crew@demo.com"],
      progressPercent: 10,
      completedQty: 0,
      materialsVerified: true,
      linkedShiftPhotoIds: [],
      releasedForLoading: false,
      updatedAt: new Date().toISOString(),
    }
    draft.fabricationJobs.unshift(job)
    return { ok: true, job }
  })
}

/**
 * Ground Crew After-Shift Work Photo (Scenario 2 & Scenario 7):
 * Stored separately from Venue/Warehouse Arrival photos and Damage Evidence photos.
 * Links to event and shift, and when `fabricationJobId` is provided, links to the production job
 * so Warehouse can verify progress and approve `Ready to Load`.
 */
export function submitAfterShiftWorkPhoto(
  actor: OpsActor,
  payload: {
    eventId: string
    shiftLabel: string
    photoUrl: string
    caption: string
    isFabricationWork: boolean
    fabricationJobId?: string
  },
): { ok: true; photo: AfterShiftPhoto } | { ok: false; error: string } {
  if (!payload.photoUrl.trim()) {
    return { ok: false, error: "A work photo is required for after-shift submission." }
  }
  if (!payload.shiftLabel.trim()) {
    return { ok: false, error: "Enter the shift label." }
  }
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === payload.eventId)
    if (!order) return { ok: false, error: "Event not found." }

    const now = new Date().toISOString()
    const photo: AfterShiftPhoto = {
      id: `asp-${Date.now().toString().slice(-6)}`,
      eventId: payload.eventId,
      eventTitle: order.eventTitle,
      shiftLabel: payload.shiftLabel.trim(),
      photoUrl: payload.photoUrl.trim(),
      caption: payload.caption.trim() || "Completed shift work documentation.",
      isFabricationWork: payload.isFabricationWork,
      fabricationJobId: payload.isFabricationWork ? payload.fabricationJobId : undefined,
      submittedByEmail: actor.email.toLowerCase(),
      submittedByName: actor.name,
      submittedAt: now,
    }

    draft.afterShiftPhotos.unshift(photo)

    if (payload.isFabricationWork && payload.fabricationJobId) {
      const job = draft.fabricationJobs.find((j) => j.id === payload.fabricationJobId)
      if (job) {
        if (!job.linkedShiftPhotoIds.includes(photo.id)) {
          job.linkedShiftPhotoIds.push(photo.id)
        }
        job.progressPercent = 100
        job.completedQty = job.spec.requestedQty
        if (job.status !== "Ready to Load") {
          job.status = "Awaiting Verification"
        }
        job.updatedAt = now
      }
    }

    void v51ContractApis.submitAfterShiftPhoto(photo)
    return { ok: true, photo }
  })
}

/**
 * Warehouse Operations Manager:
 * Verifies finished custom fabrication work against Event Manager's approved specifications
 * using the Ground Crew after-shift work photo (Scenario 2).
 * - Cannot mark `Ready to Load` without a linked Ground Crew after-shift work photo.
 * - If it passes, marks `Ready to Load` and releases it onto the event's dispatch manifest.
 * - If corrections are needed, marks `Needs Correction` and keeps it in production.
 */
export function verifyCustomFabricationJob(
  actor: OpsActor,
  jobId: string,
  decision: {
    passed: boolean
    photoId?: string
    notes: string
  },
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const job = draft.fabricationJobs.find((j) => j.id === jobId)
    if (!job) return { ok: false, error: "Fabrication job not found." }

    const linkedPhotos = draft.afterShiftPhotos.filter((p) =>
      job.linkedShiftPhotoIds.includes(p.id),
    )

    if (decision.passed) {
      if (linkedPhotos.length === 0) {
        return {
          ok: false,
          error:
            "Cannot mark Ready to Load: Ground Crew must first submit an after-shift work photo of the finished fabrication item.",
        }
      }
      const chosenPhoto =
        (decision.photoId && linkedPhotos.find((p) => p.id === decision.photoId)) ||
        linkedPhotos[0]

      const now = new Date().toISOString()
      job.status = "Ready to Load"
      job.verifiedPhotoUrl = chosenPhoto.photoUrl
      job.verificationNotes =
        decision.notes.trim() ||
        "Verified against Event Manager dimensions, quantities, reference images, and build instructions."
      job.verifiedByEmail = actor.email
      job.verifiedByName = actor.name
      job.verifiedAt = now
      job.releasedForLoading = true
      job.updatedAt = now

      // Ensure custom item is tracked in the order's load/return counters
      const order = draft.orderRequests.find((o) => o.eventId === job.eventId)
      if (order) {
        const existingCustomStockLine = order.stockLines.find(
          (s) => s.assetId === job.customItemId,
        )
        if (!existingCustomStockLine) {
          order.stockLines.push({
            assetId: job.customItemId,
            assetCode: `FAB-${job.id.slice(-4).toUpperCase()}`,
            name: `${job.spec.name} (Custom Fabrication)`,
            category: "Custom Fabrication",
            image: job.spec.referenceImages[0] || chosenPhoto.photoUrl,
            unit: "unit",
            approvedRequestedQty: job.spec.requestedQty,
            allocatedQty: job.spec.requestedQty,
            deficitQty: 0,
            releasedForLoadQty: job.spec.requestedQty,
            loadedQty: 0,
            loadingVerified: false,
            returnedQty: 0,
            notes: `Verified Ready to Load via Ground Crew photo (${chosenPhoto.shiftLabel})`,
          })
          // If Loading Checklist was previously submitted, adding a new unreleased custom item requires re-verification
          order.loadingChecklist = undefined
        }
      }

      void oldSystemApis.production.approveTask(jobId, job.verificationNotes)
      void v51ContractApis.verifyCustomFabricationWithPhoto(jobId, {
        passed: true,
        photoUrl: chosenPhoto.photoUrl,
        notes: job.verificationNotes,
        verifiedByEmail: actor.email,
      })
    } else {
      if (!decision.notes.trim()) {
        return {
          ok: false,
          error: "Specify the required corrections so Ground Crew can rework the item.",
        }
      }
      job.status = "Needs Correction"
      job.correctionNotes = decision.notes.trim()
      job.releasedForLoading = false
      job.updatedAt = new Date().toISOString()
      void oldSystemApis.production.rejectTask(jobId, decision.notes.trim())
    }

    return { ok: true }
  })
}
