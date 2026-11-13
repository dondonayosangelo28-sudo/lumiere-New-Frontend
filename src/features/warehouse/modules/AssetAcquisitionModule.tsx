import { useState } from "react"
import { PackagePlus } from "lucide-react"
import { Badge, Button, Card, Field, Input, PageHeader } from "../../../components/ui/ui"
import {
  createAcquisitionOrder,
  receiveAcquisitionOrder,
  useOperationsStore,
  type OpsActor,
} from "../../../operations/store"
import { useNotify } from "../warehouse-shared"

export default function AssetAcquisitionModule({ actor }: { actor: OpsActor }) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [assetId, setAssetId] = useState(state.inventory[0]?.assetId ?? "evtast-0001")
  const [supplier, setSupplier] = useState("Manila Artisan Event Supply")
  const [qty, setQty] = useState(25)
  const [unitCost, setUnitCost] = useState(1450)

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Warehouse Operations Manager", "Asset Acquisition"]}
        title="Asset Acquisition"
        subtitle="Acquire new warehouse stock to resolve Deficit Queue shortages and expand inventory capacity."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-bold text-foreground">Create Acquisition Order</h3>
          <Field label="Catalog Asset">
            <select
              className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              {state.inventory.map((inv) => (
                <option key={inv.assetId} value={inv.assetId}>
                  {inv.assetCode} — {inv.name} (Avail: {inv.availableStock})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <Field label="Unit Cost (PHP)">
              <Input
                type="number"
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              icon={PackagePlus}
              onClick={() => {
                const res = createAcquisitionOrder({
                  assetId,
                  supplierName: supplier,
                  quantity: qty,
                  unitCost,
                  actorName: actor.name,
                  receiveImmediately: true,
                })
                if (!res.ok) notify(res.error)
                else notify(`Acquisition ${res.order.id} received and added to stock.`)
              }}
            >
              Acquire & Receive Into Stock Now
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const res = createAcquisitionOrder({
                  assetId,
                  supplierName: supplier,
                  quantity: qty,
                  unitCost,
                  actorName: actor.name,
                  receiveImmediately: false,
                })
                if (!res.ok) notify(res.error)
                else notify(`Purchase Order ${res.order.id} placed.`)
              }}
            >
              Place Order (Receive Later)
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-bold text-foreground">
            Acquisition Ledger ({state.acquisitions.length})
          </h3>
          {state.acquisitions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No acquisition orders recorded yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">Order ID</th>
                    <th className="py-3 pr-4">Asset</th>
                    <th className="py-3 pr-4">Supplier</th>
                    <th className="py-3 pr-4">Qty</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {state.acquisitions.map((acq) => (
                    <tr key={acq.id}>
                      <td className="py-3 pr-4 font-mono text-xs">{acq.id}</td>
                      <td className="py-3 pr-4 font-semibold">{acq.assetName}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {acq.supplierName}
                      </td>
                      <td className="py-3 pr-4 font-semibold tabular-nums">+{acq.quantity}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={acq.status === "Received & Stocked" ? "success" : "info"}>
                          {acq.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        {acq.status !== "Received & Stocked" && (
                          <Button
                            type="button"
                            onClick={() => {
                              receiveAcquisitionOrder(acq.id)
                              notify(`Order ${acq.id} received into Warehouse Inventory.`)
                            }}
                          >
                            Mark Received
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
    </div>
  )
}
