import { useState } from "react"
import { UserCheck, Users } from "lucide-react"
import { Badge, Button, Card, Field, Input, PageHeader } from "../../../components/ui/ui"
import { fmtStamp, textareaCls } from "../../event-manager/shared"
import {
  assignCrewMemberToEvent,
  designateEventTeamLead,
  getAvailableGroundCrewAccounts,
  useOperationsStore,
  type OpsActor,
} from "../../../operations/store"
import { useNotify } from "../warehouse-shared"

export default function PersonnelDeploymentModule({ actor }: { actor: OpsActor }) {
  const state = useOperationsStore()
  const notify = useNotify()
  const availableCrew = getAvailableGroundCrewAccounts()

  const [selectedEventId, setSelectedEventId] = useState(
    () => state.orderRequests[0]?.eventId ?? "",
  )
  const order =
    state.orderRequests.find((o) => o.eventId === selectedEventId) ?? state.orderRequests[0]

  const [crewEmail, setCrewEmail] = useState(availableCrew[0]?.email ?? "crew@demo.com")
  const [schedule, setSchedule] = useState("Apr 25, 2026 · 07:00 AM – 11:59 PM")
  const [shiftLabel, setShiftLabel] = useState("Shift 1 — Ingress, Event & Return")
  const [duties, setDuties] = useState(
    "Execute dispatch loading counts, venue arrival checks, event hours monitoring, and warehouse return audit.",
  )
  const [makeLead, setMakeLead] = useState(false)
  const [replaceLeadEmail, setReplaceLeadEmail] = useState("")
  const [replaceReason, setReplaceReason] = useState("")

  if (!order) return null

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Warehouse Operations Manager", "Personnel Deployment"]}
        title="Personnel Deployment"
        subtitle="Assign crew and a Team Lead, then track progress and blockers."
      />

      {/* Event Selector */}
      <div className="flex flex-wrap gap-2">
        {state.orderRequests.map((o) => (
          <Button
            key={o.eventId}
            type="button"
            variant={o.eventId === order.eventId ? "solid" : "outline"}
            onClick={() => setSelectedEventId(o.eventId)}
          >
            {o.eventTitle} ({o.id})
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Assign Ground Crew Member */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-foreground">
            Assign Ground Crew Member to {order.eventTitle}
          </h3>
          <p className="text-xs text-muted-foreground">
            All active <strong>Ground Crew</strong> accounts provisioned by System Admin appear
            below. Team Lead is an event-specific designation; the account role remains Ground Crew.
          </p>

          <Field label="Ground Crew Account (from System Admin Accounts)">
            <select
              className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
              value={crewEmail}
              onChange={(e) => setCrewEmail(e.target.value)}
            >
              {availableCrew.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shift Label">
              <Input value={shiftLabel} onChange={(e) => setShiftLabel(e.target.value)} />
            </Field>
            <Field label="Schedule">
              <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            </Field>
          </div>

          <Field label="Assigned Duties">
            <textarea
              className={textareaCls}
              rows={2}
              value={duties}
              onChange={(e) => setDuties(e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={makeLead}
              onChange={(e) => setMakeLead(e.target.checked)}
            />
            Designate this Ground Crew member as the event’s Team Lead upon assignment
          </label>

          <Button
            type="button"
            icon={Users}
            onClick={() => {
              const chosen = availableCrew.find((u) => u.email === crewEmail) ?? {
                email: crewEmail,
                name: crewEmail,
              }
              const res = assignCrewMemberToEvent(actor, {
                eventId: order.eventId,
                crewEmail: chosen.email,
                crewName: chosen.name,
                schedule,
                duties,
                shiftLabel,
                makeTeamLead: makeLead,
              })
              if (!res.ok) notify(res.error)
              else
                notify(
                  `Assigned ${chosen.name} (${chosen.email}) to ${order.eventTitle}${makeLead ? " as Team Lead" : ""}.`,
                )
            }}
          >
            Assign Ground Crew Member
          </Button>
        </Card>

        {/* Right: Team Lead Designation & Replacement (Scenario 8) */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">
              Team Lead
            </h3>
            {order.teamLeadName ? (
              <Badge tone="info">Current Lead: {order.teamLeadName}</Badge>
            ) : (
              <Badge tone="warning">No Team Lead Designated</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Replacing the Team Lead (including after work has started) transfers authority over
            remaining arrival confirmations, final checklists, and rental confirmations while
            preserving the original submitter on already-completed records.
          </p>

          <Field label="Select Assigned Ground Crew Member as Replacement Team Lead">
            <select
              className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
              value={replaceLeadEmail || order.teamLeadEmail || ""}
              onChange={(e) => setReplaceLeadEmail(e.target.value)}
            >
              <option value="" disabled>
                Choose assigned crew member…
              </option>
              {order.crewAssignments.map((a) => (
                <option key={a.crewEmail} value={a.crewEmail}>
                  {a.crewName} ({a.crewEmail})
                  {order.teamLeadEmail?.toLowerCase() === a.crewEmail.toLowerCase()
                    ? " — Current Team Lead"
                    : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reason for Team Lead Designation / Replacement">
            <Input
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
              placeholder="e.g. Shift handover after Venue Arrival; Crew Member B assuming Team Lead authority for return."
            />
          </Field>

          <Button
            type="button"
            icon={UserCheck}
            onClick={() => {
              const targetEmail = replaceLeadEmail || order.crewAssignments[0]?.crewEmail
              const targetMember = order.crewAssignments.find(
                (a) => a.crewEmail.toLowerCase() === targetEmail?.toLowerCase(),
              )
              if (!targetMember) {
                notify("Assign the Ground Crew member to this event first.")
                return
              }
              const res = designateEventTeamLead(actor, {
                eventId: order.eventId,
                newLeadEmail: targetMember.crewEmail,
                newLeadName: targetMember.crewName,
                reason: replaceReason,
              })
              if (!res.ok) notify(res.error)
              else {
                notify(
                  `Updated Team Lead for ${order.eventTitle} to ${targetMember.crewName} (${targetMember.crewEmail}). Completed records retain their original submitters.`,
                )
                setReplaceReason("")
              }
            }}
          >
            Update / Replace Event Team Lead
          </Button>

          {/* Completed Records Attribution Preservation Audit */}
          <div className="border-t border-line pt-4 text-xs space-y-1.5">
            <div className="font-semibold text-foreground">
              Completed Checkpoint Attribution (Preserved Across Replacements)
            </div>
            <div className="text-muted-foreground">
              • Final Loading Checklist:{" "}
              <strong className="text-foreground">
                {order.loadingChecklist
                  ? `${order.loadingChecklist.submittedByName} (${order.loadingChecklist.submittedByEmail})`
                  : "Pending"}
              </strong>
            </div>
            <div className="text-muted-foreground">
              • Venue Arrival Confirmation:{" "}
              <strong className="text-foreground">
                {order.venueArrival
                  ? `${order.venueArrival.submittedByName} (${order.venueArrival.submittedByEmail})`
                  : "Pending"}
              </strong>
            </div>
            <div className="text-muted-foreground">
              • Warehouse Arrival Confirmation:{" "}
              <strong className="text-foreground">
                {order.warehouseArrival
                  ? `${order.warehouseArrival.submittedByName} (${order.warehouseArrival.submittedByEmail})`
                  : "Pending"}
              </strong>
            </div>
            <div className="text-muted-foreground">
              • Final Return Checklist:{" "}
              <strong className="text-foreground">
                {order.returnChecklist
                  ? `${order.returnChecklist.submittedByName} (${order.returnChecklist.submittedByEmail})`
                  : "Pending"}
              </strong>
            </div>
          </div>

          {/* Team Lead Change Audit Log */}
          {order.teamLeadHistory.length > 0 && (
            <div className="border-t border-line pt-3 text-xs">
              <div className="font-semibold text-foreground">
                Team Lead Designation History ({order.teamLeadHistory.length})
              </div>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                {order.teamLeadHistory.map((h) => (
                  <li key={h.id}>
                    {h.previousLeadName ? (
                      <>
                        Replaced <strong>{h.previousLeadName}</strong> with{" "}
                        <strong className="text-foreground">{h.newLeadName}</strong>
                      </>
                    ) : (
                      <>
                        Designated <strong className="text-foreground">{h.newLeadName}</strong> as
                        Team Lead
                      </>
                    )}{" "}
                    by {h.changedByName} at {fmtStamp(h.changedAt)} — “{h.reason}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Assigned Crew Roster, Task Progress & Blockers */}
      <Card className="p-6">
        <h3 className="text-base font-bold text-foreground">
          Assigned Ground Crew Roster, Progress & Blockers ({order.crewAssignments.length})
        </h3>
        {order.crewAssignments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No Ground Crew members assigned to this event yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">Crew Member</th>
                  <th className="py-3 pr-4">Designation</th>
                  <th className="py-3 pr-4">Shift & Schedule</th>
                  <th className="py-3 pr-4">Duties</th>
                  <th className="py-3 pr-4">Task Status & Blocker</th>
                  <th className="py-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.crewAssignments.map((a) => {
                  const isLead =
                    order.teamLeadEmail?.toLowerCase() === a.crewEmail.toLowerCase()
                  return (
                    <tr key={a.id}>
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-foreground">{a.crewName}</div>
                        <div className="text-xs text-muted-foreground">{a.crewEmail}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        {isLead ? (
                          <Badge tone="info">Event Team Lead</Badge>
                        ) : (
                          <Badge tone="neutral">Ground Crew</Badge>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-xs">
                        <div className="font-medium text-foreground">{a.shiftLabel}</div>
                        <div className="text-muted-foreground">{a.schedule}</div>
                      </td>
                      <td className="py-3.5 pr-4 text-xs text-muted-foreground max-w-xs">
                        {a.duties}
                      </td>
                      <td className="py-3.5 pr-4 text-xs">
                        <Badge
                          tone={
                            a.taskStatus === "Completed"
                              ? "success"
                              : a.taskStatus === "Blocked"
                                ? "danger"
                                : a.taskStatus === "InProgress"
                                  ? "info"
                                  : "neutral"
                          }
                        >
                          {a.taskStatus}
                        </Badge>
                        {a.blockerReason && (
                          <div className="mt-1 text-danger font-medium">
                            Blocker: “{a.blockerReason}”
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 text-right">
                        {!isLead && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              designateEventTeamLead(actor, {
                                eventId: order.eventId,
                                newLeadEmail: a.crewEmail,
                                newLeadName: a.crewName,
                                reason: `Designated ${a.crewName} as Team Lead from roster.`,
                              })
                              notify(`${a.crewName} is now the designated Team Lead.`)
                            }}
                          >
                            Make Team Lead
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
