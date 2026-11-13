import { useState } from "react"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Play,
  RotateCcw,
  Truck,
  Warehouse,
} from "lucide-react"
import { Badge, Button, Card, Input, PageHeader } from "../../components/ui/ui"
import {
  getEventManifestLines,
  updateCrewTaskExecutionStatus,
  useOperationsStore,
  type OpsActor,
} from "../../operations/store"
import { EventSelectorHeader, useNotify } from "./ground-crew-shared"

export default function AssignedWorkModule({
  actor,
  onNavigate,
}: {
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [selectedEventId, setSelectedEventId] = useState(
    () => state.orderRequests[0]?.eventId ?? "",
  )
  const [blockerInputs, setBlockerInputs] = useState<Record<string, string>>({})

  const order =
    state.orderRequests.find((o) => o.eventId === selectedEventId) ?? state.orderRequests[0]
  if (!order) return null

  const manifestLines = getEventManifestLines(state, order.eventId)

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Ground Crew", "Assigned Work"]}
        title="Assigned Work"
        subtitle="Review your event, assigned duties, and dispatch manifest."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              icon={Camera}
              onClick={() => onNavigate("module-evidence-capture")}
            >
              Add shift photo
            </Button>
            <Button
              type="button"
              icon={Truck}
              onClick={() => onNavigate("module-dispatch-checks")}
            >
              Loading checklist
            </Button>
          </div>
        }
      />

      <EventSelectorHeader
        actor={actor}
        selectedEventId={order.eventId}
        onSelect={setSelectedEventId}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Assigned Tasks & Blocker Controls */}
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Assigned Duties & Shift Execution — {order.eventTitle}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Venue: <strong className="text-foreground">{order.venue}</strong> · Event Window:{" "}
              <strong className="text-foreground">
                {order.startDateTime.replace("T", " ")} – {order.endDateTime.replace("T", " ")}
              </strong>
            </p>
          </div>

          {order.crewAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Ground Crew assignments on this event yet. Warehouse Operations Manager assigns
              crew in Personnel Deployment.
            </p>
          ) : (
            <div className="space-y-4">
              {order.crewAssignments.map((asg) => {
                const isLead =
                  order.teamLeadEmail?.toLowerCase() === asg.crewEmail.toLowerCase()
                const blockerText = blockerInputs[asg.id] ?? ""
                return (
                  <div
                    key={asg.id}
                    className="rounded-xl border border-line bg-fg/[0.02] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground">{asg.crewName}</span>
                          <span className="text-xs text-muted-foreground">({asg.crewEmail})</span>
                          {isLead && <Badge tone="info">Designated Team Lead</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <strong>{asg.shiftLabel}</strong> · {asg.schedule}
                        </div>
                      </div>
                      <Badge
                        tone={
                          asg.taskStatus === "Completed"
                            ? "success"
                            : asg.taskStatus === "Blocked"
                              ? "danger"
                              : asg.taskStatus === "InProgress"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {asg.taskStatus}
                      </Badge>
                    </div>

                    <p className="text-xs text-foreground">
                      <strong>Duties:</strong> {asg.duties}
                    </p>

                    {asg.blockerReason && (
                      <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                        <strong>Reported Blocker:</strong> “{asg.blockerReason}” (Visible in
                        Warehouse → Personnel Deployment)
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      {asg.taskStatus === "Assigned" && (
                        <Button
                          type="button"
                          icon={Play}
                          onClick={() => {
                            updateCrewTaskExecutionStatus(actor, {
                              eventId: order.eventId,
                              assignmentId: asg.id,
                              status: "InProgress",
                            })
                            notify(`Started task for ${asg.crewName}.`)
                          }}
                        >
                          Start Task
                        </Button>
                      )}
                      {asg.taskStatus === "Blocked" && (
                        <Button
                          type="button"
                          icon={RotateCcw}
                          onClick={() => {
                            updateCrewTaskExecutionStatus(actor, {
                              eventId: order.eventId,
                              assignmentId: asg.id,
                              status: "InProgress",
                            })
                            notify(`Resumed work for ${asg.crewName}.`)
                          }}
                        >
                          Resume Work
                        </Button>
                      )}
                      {asg.taskStatus !== "Completed" && (
                        <Button
                          type="button"
                          variant="outline"
                          icon={CheckCircle2}
                          onClick={() => {
                            updateCrewTaskExecutionStatus(actor, {
                              eventId: order.eventId,
                              assignmentId: asg.id,
                              status: "Completed",
                            })
                            notify(`Marked task Completed for ${asg.crewName}.`)
                          }}
                        >
                          Mark Task Complete
                        </Button>
                      )}
                    </div>

                    {asg.taskStatus !== "Completed" && (
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] pt-1">
                        <Input
                          value={blockerText}
                          onChange={(e) =>
                            setBlockerInputs({ ...blockerInputs, [asg.id]: e.target.value })
                          }
                          placeholder="Reason for blocker (e.g. venue freight elevator locked, missing hardware)…"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          icon={AlertTriangle}
                          onClick={() => {
                            const res = updateCrewTaskExecutionStatus(actor, {
                              eventId: order.eventId,
                              assignmentId: asg.id,
                              status: "Blocked",
                              blockerReason: blockerText,
                            })
                            if (!res.ok) notify(res.error)
                            else {
                              notify("Blocker reported to Warehouse Operations Manager.")
                              setBlockerInputs({ ...blockerInputs, [asg.id]: "" })
                            }
                          }}
                        >
                          Report Blocker
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Event Dispatch Manifest Preview */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-foreground">
            Event Dispatch Manifest ({manifestLines.length} lines)
          </h3>
          <p className="text-xs text-muted-foreground">
            Assets transported by Ground Crew. Direct-to-venue rentals are verified separately at
            Venue Arrival.
          </p>
          <ul className="divide-y divide-line text-xs">
            {manifestLines.map((line) => (
              <li key={line.lineId} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground">{line.name}</div>
                  <div className="text-muted-foreground">
                    {line.code} · {line.category}
                  </div>
                </div>
                <Badge tone={line.loadedQty >= line.plannedQty ? "success" : "warning"}>
                  {line.loadedQty}/{line.plannedQty} {line.unit}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}


export { AssignedWorkModule }
