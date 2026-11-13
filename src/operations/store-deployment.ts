import { oldSystemApis, v51ContractApis } from "./apiClients"
import type { CrewTaskStatus } from "./types"
import { mutateOperationsStore, type OpsActor } from "./store-core"

/**
 * Warehouse Operations Manager — Personnel Deployment & Team Lead Designation (Scenario 1 & Scenario 8):
 * Assigns a Ground Crew account to an event and optionally designates them as Team Lead.
 */
export function assignCrewMemberToEvent(
  actor: OpsActor,
  payload: {
    eventId: string
    crewEmail: string
    crewName: string
    schedule: string
    duties: string
    shiftLabel: string
    makeTeamLead?: boolean
    teamLeadReason?: string
  },
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === payload.eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    const normalizedEmail = payload.crewEmail.trim().toLowerCase()
    const now = new Date().toISOString()
    const existing = order.crewAssignments.find(
      (a) => a.crewEmail.toLowerCase() === normalizedEmail,
    )

    if (existing) {
      existing.schedule = payload.schedule.trim() || existing.schedule
      existing.duties = payload.duties.trim() || existing.duties
      existing.shiftLabel = payload.shiftLabel.trim() || existing.shiftLabel
      existing.updatedAt = now
    } else {
      order.crewAssignments.push({
        id: `asg-${Date.now().toString().slice(-6)}`,
        eventId: payload.eventId,
        crewEmail: normalizedEmail,
        crewName: payload.crewName.trim(),
        schedule: payload.schedule.trim() || "Event Schedule — Full Shift",
        duties:
          payload.duties.trim() ||
          "Field logistics, dispatch loading checks, venue setup, and post-event return audit.",
        shiftLabel: payload.shiftLabel.trim() || "Shift 1 — Event Operations",
        taskStatus: "Assigned",
        updatedAt: now,
      })
    }

    if (payload.makeTeamLead || !order.teamLeadEmail) {
      const prevEmail = order.teamLeadEmail
      const prevName = order.teamLeadName
      if (prevEmail?.toLowerCase() !== normalizedEmail) {
        order.teamLeadEmail = normalizedEmail
        order.teamLeadName = payload.crewName.trim()
        order.teamLeadHistory.unshift({
          id: `tlh-${Date.now().toString().slice(-6)}`,
          previousLeadEmail: prevEmail,
          previousLeadName: prevName,
          newLeadEmail: normalizedEmail,
          newLeadName: payload.crewName.trim(),
          changedByEmail: actor.email,
          changedByName: actor.name,
          changedAt: now,
          reason:
            payload.teamLeadReason?.trim() ||
            (prevEmail
              ? "Team Lead designation reassigned by Warehouse Operations Manager."
              : "Initial Team Lead designation."),
        })
      }
    }

    return { ok: true }
  })
}

/**
 * Warehouse Operations Manager — Change or Replace Team Lead (Scenario 8):
 * Transfers Team Lead authority over remaining arrival confirmations, final checklists,
 * and rental receipt/return confirmations while preserving the original submitter on completed records.
 */
export function designateEventTeamLead(
  actor: OpsActor,
  payload: {
    eventId: string
    newLeadEmail: string
    newLeadName: string
    reason: string
  },
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === payload.eventId)
    if (!order) return { ok: false, error: "Event Order Request not found." }

    const normalizedEmail = payload.newLeadEmail.trim().toLowerCase()
    const isAssigned = order.crewAssignments.some(
      (a) => a.crewEmail.toLowerCase() === normalizedEmail,
    )
    if (!isAssigned) {
      return {
        ok: false,
        error: "The designated Team Lead must be an assigned Ground Crew member for this event.",
      }
    }

    if (order.teamLeadEmail?.toLowerCase() === normalizedEmail) {
      return { ok: true }
    }

    const now = new Date().toISOString()
    const prevEmail = order.teamLeadEmail
    const prevName = order.teamLeadName

    order.teamLeadEmail = normalizedEmail
    order.teamLeadName = payload.newLeadName.trim()
    order.teamLeadHistory.unshift({
      id: `tlh-${Date.now().toString().slice(-6)}`,
      previousLeadEmail: prevEmail,
      previousLeadName: prevName,
      newLeadEmail: normalizedEmail,
      newLeadName: payload.newLeadName.trim(),
      changedByEmail: actor.email,
      changedByName: actor.name,
      changedAt: now,
      reason:
        payload.reason.trim() ||
        "Team Lead replaced by Warehouse Operations Manager during event operations.",
    })

    void v51ContractApis.setEventTeamLead(payload.eventId, {
      newLeadEmail: normalizedEmail,
      newLeadName: payload.newLeadName.trim(),
      changedByEmail: actor.email,
      changedByName: actor.name,
      reason: payload.reason.trim(),
    })

    return { ok: true }
  })
}

/**
 * Ground Crew — Assigned Work Task Execution & Blocker Reporting:
 * Ground Crew can start tasks, report a blocker with reason, resume work, and mark tasks complete.
 */
export function updateCrewTaskExecutionStatus(
  actor: OpsActor,
  payload: {
    eventId: string
    assignmentId: string
    status: CrewTaskStatus
    blockerReason?: string
  },
): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const order = draft.orderRequests.find((o) => o.eventId === payload.eventId)
    if (!order) return { ok: false, error: "Event not found." }

    const assignment = order.crewAssignments.find((a) => a.id === payload.assignmentId)
    if (!assignment) return { ok: false, error: "Crew assignment not found." }

    if (payload.status === "Blocked" && !payload.blockerReason?.trim()) {
      return { ok: false, error: "Provide the blocker reason so Warehouse can resolve it." }
    }

    const now = new Date().toISOString()
    assignment.taskStatus = payload.status
    assignment.updatedAt = now
    if (payload.status === "InProgress" && !assignment.startedAt) {
      assignment.startedAt = now
    }
    if (payload.status === "Blocked") {
      assignment.blockerReason = payload.blockerReason?.trim()
    } else if (payload.status === "InProgress" || payload.status === "Completed") {
      assignment.blockerReason = undefined
    }
    if (payload.status === "Completed") {
      assignment.completedAt = now
    }

    void oldSystemApis.manning.updateAssignmentStatus(payload.assignmentId, {
      status: payload.status,
      blockerReason: payload.blockerReason,
    })

    return { ok: true }
  })
}
