import { ClipboardCheck } from "lucide-react"
import { Badge, Button, Card } from "../../components/ui/ui"
import { fmtStamp } from "../event-manager/shared"
import { useOperationsStore, type OpsActor } from "../../operations/store"
import AssignedWorkModule from "./AssignedWorkModule"
import DispatchLoadingChecksModule from "./DispatchLoadingChecksModule"
import VenueArrivalAndEventHoursModule from "./VenueArrivalAndEventHoursModule"
import EvidenceCaptureModule from "./EvidenceCaptureModule"
import WarehouseArrivalAndReturnAuditModule from "./WarehouseArrivalAndReturnAuditModule"

export {
  AssignedWorkModule,
  DispatchLoadingChecksModule,
  VenueArrivalAndEventHoursModule,
  EvidenceCaptureModule,
  WarehouseArrivalAndReturnAuditModule,
}

export function GroundCrewDashboardSummary({
  actor,
  onNavigate,
}: {
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  const state = useOperationsStore()
  const email = actor.email.toLowerCase()
  const assignedOrders = state.orderRequests.filter((order) =>
    order.crewAssignments.some((assignment) => assignment.crewEmail.toLowerCase() === email),
  )
  const hasAssignments = assignedOrders.length > 0

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your events</h2>
          <p className="mt-1 text-sm text-muted-foreground">See what is assigned to you and where each event stands.</p>
        </div>
        {hasAssignments && (
          <Button type="button" icon={ClipboardCheck} onClick={() => onNavigate("module-assigned-work")}>Open assigned work</Button>
        )}
      </div>
      {!hasAssignments ? (
        <div className="border-t border-line px-5 py-5">
          <p className="text-sm font-semibold">No events assigned yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Your events will appear when Warehouse assigns you.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {assignedOrders.map((order) => {
            const checkpoints = [
              { title: "Dispatch Loading", status: order.loadingChecklist ? "Submitted" : "Pending" },
              { title: "Venue Arrival", status: order.venueArrival ? "Confirmed" : "Pending" },
              { title: "Event Hours", status: order.returnChecklist ? "Past" : order.venueArrival ? "Reporting open" : "Upcoming" },
              { title: "Warehouse Arrival", status: order.returnChecklist ? "Return submitted" : order.warehouseArrival ? "Arrived" : "Pending" },
            ]
            return (
              <li key={order.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold">{order.eventTitle}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{order.venue} · {fmtStamp(order.startDateTime)}</p>
                  </div>
                  {order.teamLeadEmail?.toLowerCase() === email && <Badge tone="info">Team Lead</Badge>}
                </div>
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {checkpoints.map((checkpoint, index) => (
                    <li key={checkpoint.title} className="min-w-0 rounded-lg border border-line px-2.5 py-2">
                      <p className="text-xs font-semibold">{index + 1}. {checkpoint.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{checkpoint.status}</p>
                    </li>
                  ))}
                </ol>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default function GroundCrewModulePage({
  moduleKey,
  actor,
  onNavigate,
}: {
  moduleKey: string
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  switch (moduleKey) {
    case "assigned-work":
      return <AssignedWorkModule actor={actor} onNavigate={onNavigate} />
    case "dispatch-checks":
      return <DispatchLoadingChecksModule actor={actor} onNavigate={onNavigate} />
    case "venue-arrival":
      return <VenueArrivalAndEventHoursModule actor={actor} onNavigate={onNavigate} />
    case "evidence-capture":
      return <EvidenceCaptureModule actor={actor} />
    case "post-event-audits":
      return <WarehouseArrivalAndReturnAuditModule actor={actor} />
    default:
      return <AssignedWorkModule actor={actor} onNavigate={onNavigate} />
  }
}
