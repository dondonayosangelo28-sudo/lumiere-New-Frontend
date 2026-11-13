import { ArrowRight } from "lucide-react"
import { Badge, Button, Card } from "../../components/ui/ui"
import { fmtStamp } from "../event-manager/shared"
import {
  useOperationsStore,
  type OpsActor,
} from "../../operations/store"
import AssetInventoryModule from "./modules/AssetInventoryModule"
import OrderRequestsModule from "./modules/OrderRequestsModule"
import DeficitQueueModule from "./modules/DeficitQueueModule"
import AssetAcquisitionModule from "./modules/AssetAcquisitionModule"
import CustomFabricationModule from "./modules/CustomFabricationModule"
import PersonnelDeploymentModule from "./modules/PersonnelDeploymentModule"
import DamageAssessmentModule from "./modules/DamageAssessmentModule"

export {
  AssetInventoryModule,
  OrderRequestsModule,
  DeficitQueueModule,
  AssetAcquisitionModule,
  CustomFabricationModule,
  PersonnelDeploymentModule,
  DamageAssessmentModule,
}

export function WarehouseDashboardSummary({ onNavigate }: { onNavigate: (route: string) => void }) {
  const state = useOperationsStore()
  const orders = state.orderRequests.filter((order) => !order.warehouseClosed)
  const openDeficits = state.deficitQueue.filter((item) => item.status !== "Fulfilled").length
  const pendingRentals = orders.flatMap((order) => order.rentals).filter((rental) => rental.confirmationStatus !== "Confirmed").length
  const blockers = orders.reduce(
    (count, order) => count + order.crewAssignments.filter((assignment) => assignment.taskStatus === "Blocked").length,
    0,
  )

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Event fulfillment</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track active orders from asset preparation through return.</p>
        </div>
        <Button type="button" icon={ArrowRight} onClick={() => onNavigate("module-order-requests")}>Open order requests</Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line px-5 py-3 sm:grid-cols-4">
        {[
          ["Active orders", orders.length],
          ["Stock shortages", openDeficits],
          ["Pending rentals", pendingRentals],
          ["Crew blockers", blockers],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {orders.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Approved events will appear here when their asset plans reach Warehouse.</p>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{order.eventTitle}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{order.venue} · {fmtStamp(order.startDateTime)}</p>
              </div>
              <Badge tone={order.returnChecklist ? "info" : "neutral"}>
                {order.returnChecklist ? "Ready for review" : order.outboundDeparture ? "Dispatched" : "Preparing"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function WarehouseModulePage({
  moduleKey,
  actor,
  onNavigate,
}: {
  moduleKey: string
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  switch (moduleKey) {
    case "asset-inventory":
      return <AssetInventoryModule actor={actor} onNavigate={onNavigate} />
    case "order-requests":
      return <OrderRequestsModule actor={actor} onNavigate={onNavigate} />
    case "deficit-queue":
      return <DeficitQueueModule actor={actor} onNavigate={onNavigate} />
    case "asset-acquisition":
      return <AssetAcquisitionModule actor={actor} />
    case "custom-fabrication":
      return <CustomFabricationModule actor={actor} />
    case "personnel-deployment":
      return <PersonnelDeploymentModule actor={actor} />
    case "damage-assessment":
      return <DamageAssessmentModule actor={actor} />
    default:
      return <OrderRequestsModule actor={actor} onNavigate={onNavigate} />
  }
}
