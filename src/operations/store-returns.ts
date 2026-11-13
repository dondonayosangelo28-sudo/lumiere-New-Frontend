import { oldSystemApis, v51ContractApis } from "./apiClients"
import type {
  CheckpointName,
  FieldIncidentReport,
  IssueResolutionType,
} from "./types"
import { mutateOperationsStore, type OpsActor } from "./store-core"

/**
 * Checkpoints 2, 3 (EVENT HOURS), and 4 — File Damage Report or Missing Item Report:
 * Tags the report with the checkpoint (`Venue Arrival`, `Event Hours`, `Warehouse Arrival`),
 * item, quantity, description, and photo evidence.
 */
export function submitFieldIncidentReport(
  actor: OpsActor,
  payload: {
    eventId: string
    reportType: "Damage" | "Missing"
    checkpoint: CheckpointName
    itemCode: string
    itemName: string
    quantity: number
    description: string
    photoUrl: string
  },
): { ok: true; report: FieldIncidentReport } | { ok: false; error: string } {
  if (!payload.itemName.trim()) {
    return { ok: false, error: "Select or enter the affected item." }
  }
  if (payload.quantity < 1) {
    return { ok: false, error: "Affected quantity must be at least 1." }
  }
  if (!payload.description.trim()) {
    return { ok: false, error: "Describe the damage or missing item details." }
  }
  if (payload.reportType === "Damage" && !payload.photoUrl.trim()) {
    return { ok: false, error: "Photo evidence is required for a Damage Report." }
  }

  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === payload.eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    const report: FieldIncidentReport = {
      id: `INC-${Date.now().toString().slice(-6)}`,
      eventId: payload.eventId,
      eventTitle: order.eventTitle,
      reportType: payload.reportType,
      checkpoint: payload.checkpoint,
      itemCode: payload.itemCode.trim() || "AST-GEN",
      itemName: payload.itemName.trim(),
      quantity: payload.quantity,
      description: payload.description.trim(),
      photoUrl: payload.photoUrl.trim() || "/event-manager-images/planning.jpg",
      submittedByEmail: actor.email.toLowerCase(),
      submittedByName: actor.name,
      submittedAt: new Date().toISOString(),
      resolutionStatus: "Pending",
    }

    draft.incidentReports.unshift(report)

    const inv = draft.inventory.find(
      (i) => i.assetCode === report.itemCode || i.name === report.itemName,
    )
    if (inv) {
      if (payload.reportType === "Damage") inv.damagedCount += payload.quantity
      else inv.missingCount += payload.quantity
    }

    void oldSystemApis.damage.submitDamageReport({
      eventId: payload.eventId,
      assetId: report.itemCode,
      damageSeverity: payload.reportType === "Missing" ? "Missing" : "Damaged",
      description: `[${payload.checkpoint}] ${report.description}`,
      quantityAffected: report.quantity,
      photoEvidenceUrl: report.photoUrl,
    })
    void v51ContractApis.submitIncidentReport(payload.eventId, report)

    return { ok: true, report }
  })
}

/**
 * Checkpoint 4 (WAREHOUSE ARRIVAL):
 * Updates the physical returned count for a manifest line against the quantity that actually left.
 */
export function updateManifestReturnedQuantity(
  eventId: string,
  assetId: string,
  returnedQty: number,
): { ok: true; discrepancy: number } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }
    const line = order.stockLines.find((s) => s.assetId === assetId)
    if (!line) return { ok: false, error: "Manifest line not found." }

    const outboundActual = line.loadedQty > 0 ? line.loadedQty : line.releasedForLoadQty
    const clamped = Math.max(0, Math.min(outboundActual, returnedQty))
    line.returnedQty = clamped

    return { ok: true, discrepancy: Math.max(0, outboundActual - clamped) }
  })
}

/**
 * Checkpoint 4 — Team Lead submits final Return Checklist to Warehouse (Scenario 1, 6, 7, 8):
 * - Requires the currently designated Team Lead for the event.
 * - Requires Warehouse Arrival photo confirmation first.
 * - Automatically files a Missing Item Report for any line where `returnedQty < loadedQty`
 *   if one hasn't been filed yet, ensuring Warehouse must resolve it before closing the event.
 */
export function submitFinalReturnChecklist(
  actor: OpsActor,
  eventId: string,
  notes: string,
): { ok: true; autoCreatedMissingReports: number } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    if (!order.teamLeadEmail || order.teamLeadEmail.toLowerCase() !== actor.email.toLowerCase()) {
      return {
        ok: false,
        error: `Only the currently designated Team Lead (${order.teamLeadName || "Unassigned"}) can submit the final Return Checklist.`,
      }
    }

    if (!order.warehouseArrival) {
      return {
        ok: false,
        error: "Confirm Arrived at Warehouse with a warehouse arrival photo before submitting the final Return Checklist.",
      }
    }

    let autoCreatedMissingReports = 0
    for (const line of order.stockLines) {
      const outbound = line.loadedQty > 0 ? line.loadedQty : line.releasedForLoadQty
      const shortage = Math.max(0, outbound - line.returnedQty)
      if (shortage > 0) {
        const alreadyReported = draft.incidentReports.some(
          (r) =>
            r.eventId === eventId &&
            r.reportType === "Missing" &&
            (r.itemCode === line.assetCode || r.itemName === line.name),
        )
        if (!alreadyReported) {
          draft.incidentReports.unshift({
            id: `INC-MIS-${Date.now().toString().slice(-5)}-${autoCreatedMissingReports}`,
            eventId,
            eventTitle: order.eventTitle,
            reportType: "Missing",
            checkpoint: "Warehouse Arrival",
            itemCode: line.assetCode,
            itemName: line.name,
            quantity: shortage,
            description: `Return count discrepancy on Return Checklist: ${line.returnedQty} returned of ${outbound} outbound loaded.`,
            photoUrl: order.warehouseArrival.photoUrl,
            submittedByEmail: actor.email.toLowerCase(),
            submittedByName: actor.name,
            submittedAt: new Date().toISOString(),
            resolutionStatus: "Pending",
          })
          autoCreatedMissingReports += 1
        }
      }
    }

    const submission = {
      submittedByEmail: actor.email.toLowerCase(),
      submittedByName: actor.name,
      submittedAt: new Date().toISOString(),
      notes:
        notes.trim() ||
        "Final post-event Return Checklist counted against outbound loaded quantities and submitted to Warehouse.",
    }
    order.returnChecklist = submission

    void v51ContractApis.submitReturnChecklist(eventId, submission)
    return { ok: true, autoCreatedMissingReports }
  })
}

/**
 * D05 & Scenario 6 — Warehouse Operations Manager resolves a Missing Item Report or Damage Report:
 * Records a documented resolution (`Recovered`, `Repair Scheduled`, `Approved Write-off`, etc.).
 */
export function resolveFieldIncidentReport(
  actor: OpsActor,
  reportId: string,
  payload: {
    resolutionType: IssueResolutionType
    resolutionNotes: string
  },
): { ok: true } | { ok: false; error: string } {
  if (!payload.resolutionNotes.trim()) {
    return { ok: false, error: "Enter the documented resolution details for audit accountability." }
  }
  return mutateOperationsStore((draft) => {
    const report = draft.incidentReports.find((r) => r.id === reportId)
    if (!report) return { ok: false, error: "Incident report not found." }

    report.resolutionStatus = "Resolved"
    report.resolutionType = payload.resolutionType
    report.resolutionNotes = payload.resolutionNotes.trim()
    report.resolvedByEmail = actor.email
    report.resolvedByName = actor.name
    report.resolvedAt = new Date().toISOString()

    void oldSystemApis.damage.signOffReport(reportId, {
      isApproved: true,
      comments: `[${payload.resolutionType}] ${payload.resolutionNotes.trim()}`,
    })
    void v51ContractApis.resolveIncidentReport(reportId, {
      resolutionType: payload.resolutionType,
      resolutionNotes: payload.resolutionNotes.trim(),
      resolvedByEmail: actor.email,
      resolvedByName: actor.name,
    })

    return { ok: true }
  })
}

/**
 * D05 & Scenario 6 — Warehouse Operations Manager Event Closeout:
 * Closes warehouse accountability for the event ONLY after:
 * 1. The Team Lead's final Return Checklist has been submitted.
 * 2. All Missing Item Reports and Damage Reports for the event have a documented resolution.
 * 3. All direct-to-venue rental return confirmations and discrepancies are resolved.
 * Tracks Ground Crew task completion separately from Warehouse event closeout.
 */
export function closeWarehouseEventAccountability(
  actor: OpsActor,
  eventId: string,
  closeoutNotes: string,
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    if (!order.returnChecklist) {
      return {
        ok: false,
        error: "CLOSEOUT BLOCKED (D05): Team Lead must submit the final Return Checklist before Warehouse can close the event.",
      }
    }

    const unresolvedIncidents = draft.incidentReports.filter(
      (r) => r.eventId === eventId && r.resolutionStatus !== "Resolved",
    )
    if (unresolvedIncidents.length > 0) {
      const summary = unresolvedIncidents
        .map((i) => `${i.reportType}: ${i.itemName} (×${i.quantity} at ${i.checkpoint})`)
        .join("; ")
      return {
        ok: false,
        error: `CLOSEOUT BLOCKED (D05): Resolve all outstanding missing items and damage reports before closing the event: ${summary}.`,
      }
    }

    const unreturnedRentals = order.rentals.filter((r) => !r.supplierReturn)
    if (unreturnedRentals.length > 0) {
      const names = unreturnedRentals.map((r) => r.vendorName).join(", ")
      return {
        ok: false,
        error: `CLOSEOUT BLOCKED (D05): Team Lead must record rental return confirmation for: ${names}.`,
      }
    }

    const unresolvedRentalDiscrepancies = order.rentals.filter(
      (r) =>
        (r.venueReceipt?.hasDiscrepancy && r.venueReceipt.resolutionStatus !== "Resolved") ||
        (r.supplierReturn?.hasDiscrepancy && r.supplierReturn.resolutionStatus !== "Resolved"),
    )
    if (unresolvedRentalDiscrepancies.length > 0) {
      const names = unresolvedRentalDiscrepancies.map((r) => `${r.vendorName} (${r.itemName})`).join(", ")
      return {
        ok: false,
        error: `CLOSEOUT BLOCKED (D05): Document a resolution for all rental delivery/return discrepancies before closing the event: ${names}.`,
      }
    }

    const now = new Date().toISOString()
    order.warehouseClosed = true
    order.closedByEmail = actor.email
    order.closedByName = actor.name
    order.closedAt = now
    order.closeoutNotes =
      closeoutNotes.trim() ||
      "All outbound manifest returns, field incidents, and rental returns reconciled and signed off."

    // Return stock to available warehouse inventory
    for (const line of order.stockLines) {
      const inv = draft.inventory.find((i) => i.assetId === line.assetId)
      if (inv && line.returnedQty > 0) {
        inv.dispatchedStock = Math.max(0, inv.dispatchedStock - line.loadedQty)
        inv.availableStock = Math.max(
          0,
          inv.totalStock - inv.allocatedStock - inv.dispatchedStock - inv.damagedCount - inv.missingCount,
        )
      }
    }

    void v51ContractApis.closeWarehouseEvent(eventId, {
      closedByEmail: actor.email,
      closedByName: actor.name,
      notes: order.closeoutNotes,
    })

    return { ok: true }
  })
}
