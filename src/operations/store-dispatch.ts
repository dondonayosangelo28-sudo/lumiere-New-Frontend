import { oldSystemApis, v51ContractApis } from "./apiClients"
import { getEventManifestLines, mutateOperationsStore, type OpsActor } from "./store-core"

/**
 * D03 & Checkpoint 1 (DISPATCH LOADING):
 * Ground Crew counts the physical load on each manifest line.
 * If a line is modified after checklist submission, the checklist must be re-verified.
 */
export function updateManifestLoadedQuantity(
  eventId: string,
  assetId: string,
  loadedQty: number,
  notes?: string,
): { ok: true; hasShortfall: boolean } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    const line = order.stockLines.find((s) => s.assetId === assetId)
    if (!line) return { ok: false, error: "Manifest line item not found." }

    const planned = line.releasedForLoadQty > 0 ? line.releasedForLoadQty : line.allocatedQty
    const clamped = Math.max(0, Math.min(planned, loadedQty))
    line.loadedQty = clamped
    line.loadingVerified = clamped === planned
    if (notes !== undefined) line.notes = notes

    // If any line now has a shortfall, invalidate any premature loadingChecklist clearance
    const anyShortfall = order.stockLines.some((s) => {
      const p = s.releasedForLoadQty > 0 ? s.releasedForLoadQty : s.allocatedQty
      return p > 0 && s.loadedQty < p
    })
    if (anyShortfall) {
      order.loadingChecklist = undefined
    }

    return { ok: true, hasShortfall: clamped < planned }
  })
}

/**
 * D03 & Scenario 3, 7, 8 — Team Lead submits final Loading Checklist:
 * - Only the currently designated Team Lead for the event can submit.
 * - Any shortfall (`loadedQty < plannedQty`) on any planned line blocks submission and vehicle departure.
 */
export function submitFinalLoadingChecklist(
  actor: OpsActor,
  eventId: string,
  notes: string,
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    if (!order.teamLeadEmail || order.teamLeadEmail.toLowerCase() !== actor.email.toLowerCase()) {
      return {
        ok: false,
        error: `Only the designated Team Lead (${order.teamLeadName || "Unassigned"}) can submit the final Loading Checklist for this event.`,
      }
    }

    const lines = getEventManifestLines(draft, eventId)
    if (lines.length === 0) {
      return {
        ok: false,
        error: "No manifest items have been released for loading yet.",
      }
    }

    const shortfalls = lines.filter((l) => l.loadedQty < l.plannedQty)
    if (shortfalls.length > 0) {
      const detail = shortfalls
        .map((s) => `${s.name} (${s.loadedQty}/${s.plannedQty} loaded, shortfall of ${s.shortfallQty})`)
        .join("; ")
      return {
        ok: false,
        error: `DISPATCH BLOCKED (D03): Vehicle cannot be cleared to leave while planned quantities have shortfalls: ${detail}. Resolve the shortfall with Warehouse and recheck the line.`,
      }
    }

    const submission = {
      submittedByEmail: actor.email.toLowerCase(),
      submittedByName: actor.name,
      submittedAt: new Date().toISOString(),
      notes: notes.trim() || "All planned manifest items physically counted and verified at full quantity.",
    }
    order.loadingChecklist = submission

    // Default returnedQty to loadedQty initially so post-event audit starts with outbound baseline
    for (const s of order.stockLines) {
      if (s.returnedQty === 0 && s.loadedQty > 0) {
        s.returnedQty = s.loadedQty
      }
    }

    void v51ContractApis.submitLoadingChecklist(eventId, submission)
    return { ok: true }
  })
}

/**
 * D03 & Scenario 3 — Warehouse Operations Manager confirms Outbound Departure:
 * Allowed only after every planned item is present in its full planned quantity AND
 * the Team Lead has submitted the final Loading Checklist.
 */
export function confirmOutboundDeparture(
  actor: OpsActor,
  eventId: string,
  payload: { vehiclePlate: string; driverName: string; notes: string },
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    if (!order.loadingChecklist) {
      return {
        ok: false,
        error: "Cannot confirm outbound departure: Team Lead must submit the final Loading Checklist with zero shortfalls first.",
      }
    }

    const lines = getEventManifestLines(draft, eventId)
    const shortfalls = lines.filter((l) => l.loadedQty < l.plannedQty)
    if (shortfalls.length > 0) {
      return {
        ok: false,
        error: "Cannot confirm outbound departure: one or more manifest lines have a physical loading shortfall.",
      }
    }

    const departure = {
      confirmedByEmail: actor.email,
      confirmedByName: actor.name,
      confirmedAt: new Date().toISOString(),
      vehiclePlate: payload.vehiclePlate.trim() || "NGA-4821 (Lumière Box Truck 02)",
      driverName: payload.driverName.trim() || "R. Santos",
      notes: payload.notes.trim() || "Vehicle cleared and departed warehouse after full manifest verification.",
    }
    order.outboundDeparture = departure

    // Move allocated stock to dispatched stock in inventory
    for (const line of order.stockLines) {
      const inv = draft.inventory.find((i) => i.assetId === line.assetId)
      if (inv && line.loadedQty > 0) {
        inv.allocatedStock = Math.max(0, inv.allocatedStock - line.loadedQty)
        inv.dispatchedStock += line.loadedQty
      }
    }

    void oldSystemApis.dispatch.dispatchAssets(eventId, departure.notes)
    void v51ContractApis.confirmOutboundDeparture(eventId, departure)
    return { ok: true }
  })
}

/**
 * Checkpoint 2 (VENUE ARRIVAL) & Checkpoint 4 (WAREHOUSE ARRIVAL) — Scenario 7 & 8:
 * - Requires the currently designated Team Lead for the event.
 * - Requires a mandatory checkpoint photo taken at the venue or warehouse.
 * - Stored distinctly from after-shift work photos and damage report photos.
 */
export function submitArrivalCheckpoint(
  actor: OpsActor,
  payload: {
    eventId: string
    checkpoint: "Venue Arrival" | "Warehouse Arrival"
    photoUrl: string
    notes: string
  },
): { ok: true } | { ok: false; error: string } {
  if (!payload.photoUrl.trim()) {
    return {
      ok: false,
      error: `A photo taken at the ${payload.checkpoint === "Venue Arrival" ? "venue" : "warehouse"} is required to confirm ${payload.checkpoint}.`,
    }
  }

  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === payload.eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    if (!order.teamLeadEmail || order.teamLeadEmail.toLowerCase() !== actor.email.toLowerCase()) {
      return {
        ok: false,
        error: `Only the currently designated Team Lead (${order.teamLeadName || "Unassigned"}) can submit ${payload.checkpoint} confirmation.`,
      }
    }

    const record = {
      checkpoint: payload.checkpoint,
      photoUrl: payload.photoUrl.trim(),
      notes:
        payload.notes.trim() ||
        `Confirmed ${payload.checkpoint} with timestamped location photo.`,
      submittedByEmail: actor.email.toLowerCase(),
      submittedByName: actor.name,
      submittedAt: new Date().toISOString(),
    }

    if (payload.checkpoint === "Venue Arrival") {
      order.venueArrival = record
    } else {
      order.warehouseArrival = record
    }

    void v51ContractApis.submitArrivalConfirmation(payload.eventId, record)
    return { ok: true }
  })
}
