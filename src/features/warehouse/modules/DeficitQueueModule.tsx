import { ShoppingCart } from "lucide-react"
import { Badge, Button, Card, PageHeader } from "../../../components/ui/ui"
import {
  createAcquisitionOrder,
  useOperationsStore,
  type OpsActor,
} from "../../../operations/store"
import { useNotify } from "../warehouse-shared"

export default function DeficitQueueModule({
  actor,
  onNavigate,
}: {
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  const state = useOperationsStore()
  const notify = useNotify()

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Warehouse Operations Manager", "Deficit Queue"]}
        title="Deficit Queue"
        subtitle="Review shortages and replenishment requests by event."
        actions={
          <Button
            type="button"
            icon={ShoppingCart}
            onClick={() => onNavigate("module-asset-acquisition")}
          >
            Go to Asset Acquisition
          </Button>
        }
      />

      <Card className="p-6">
        {state.deficitQueue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active stock shortages in the Deficit Queue. When an Event Manager or Warehouse
            allocation exceeds available stock, shortages appear here automatically.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">Deficit ID</th>
                  <th className="py-3 pr-4">Event</th>
                  <th className="py-3 pr-4">Asset</th>
                  <th className="py-3 pr-4">Shortage Qty</th>
                  <th className="py-3 pr-4">Urgency</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.deficitQueue.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3.5 pr-4 font-mono text-xs">{d.id}</td>
                    <td className="py-3.5 pr-4 font-semibold">{d.eventTitle}</td>
                    <td className="py-3.5 pr-4">
                      {d.assetName} <span className="text-xs text-muted-foreground">({d.assetCode})</span>
                    </td>
                    <td className="py-3.5 pr-4 font-bold tabular-nums text-danger">
                      {d.shortageQty}
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={d.urgency === "Critical" || d.urgency === "High" ? "danger" : "warning"}>
                        {d.urgency}
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={d.status === "Fulfilled" ? "success" : "info"}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-right">
                      {d.status !== "Fulfilled" && (
                        <Button
                          type="button"
                          onClick={() => {
                            const res = createAcquisitionOrder({
                              deficitId: d.id,
                              eventId: d.eventId,
                              assetId: d.assetId,
                              supplierName: "Manila Event Supply Co.",
                              quantity: d.shortageQty,
                              unitCost: 1500,
                              actorName: actor.name,
                              receiveImmediately: true,
                            })
                            if (res.ok) {
                              notify(
                                `Acquired ${d.shortageQty} × ${d.assetName} and fulfilled shortage for ${d.eventTitle}.`,
                              )
                            }
                          }}
                        >
                          Acquire & Fulfill ({d.shortageQty})
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
