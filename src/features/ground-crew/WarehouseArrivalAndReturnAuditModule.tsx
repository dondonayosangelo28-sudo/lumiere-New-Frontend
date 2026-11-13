import { useState } from "react"
import { ClipboardCheck, FileWarning, UserCheck, Warehouse } from "lucide-react"
import { Badge, Button, Card, Field, Input, PageHeader } from "../../components/ui/ui"
import { fmtStamp } from "../event-manager/shared"
import {
  getEventManifestLines,
  recordDirectVenueRentalReturn,
  submitArrivalCheckpoint,
  submitFieldIncidentReport,
  submitFinalReturnChecklist,
  updateManifestReturnedQuantity,
  useOperationsStore,
  type OpsActor,
} from "../../operations/store"
import { EventSelectorHeader, useNotify } from "./ground-crew-shared"

export default function WarehouseArrivalAndReturnAuditModule({ actor }: { actor: OpsActor }) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [selectedEventId, setSelectedEventId] = useState(
    () => state.orderRequests[0]?.eventId ?? "",
  )
  const [whPhotoUrl, setWhPhotoUrl] = useState("/event-manager-images/planning.jpg")
  const [whNotes, setWhNotes] = useState("")
  const [returnChecklistNotes, setReturnChecklistNotes] = useState("")

  // Incident filing on return
  const [incType, setIncType] = useState<"Missing" | "Damage">("Missing")
  const [incItem, setIncItem] = useState("")
  const [incQty, setIncQty] = useState(1)
  const [incDesc, setIncDesc] = useState("")
  const [incPhoto, setIncPhoto] = useState("/event-manager-images/planning.jpg")

  // Direct-to-venue rental return handback state
  const [handbackQty, setHandbackQty] = useState<Record<string, number>>({})
  const [missingRentalQty, setMissingRentalQty] = useState<Record<string, number>>({})
  const [damagedRentalQty, setDamagedRentalQty] = useState<Record<string, number>>({})
  const [returnRentalNotes, setReturnRentalNotes] = useState<Record<string, string>>({})

  const order =
    state.orderRequests.find((o) => o.eventId === selectedEventId) ?? state.orderRequests[0]
  if (!order) return null

  const manifestLines = getEventManifestLines(state, order.eventId)

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Ground Crew", "Post-event Asset Audits"]}
        title="Warehouse Arrival & Returns"
        subtitle="Confirm arrival with a photo, count returns, and report discrepancies."
      />

      <EventSelectorHeader
        actor={actor}
        selectedEventId={order.eventId}
        onSelect={setSelectedEventId}
      />

      {/* Step 1: Warehouse Arrival Confirmation */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Arrived at warehouse
            </h3>
            <p className="text-xs text-muted-foreground">
              The currently designated Team Lead ({order.teamLeadName || "Unassigned"}) selects
              Arrived at Warehouse and submits a photo taken at the warehouse unloading bay.
            </p>
          </div>
          {order.warehouseArrival ? (
            <Badge tone="success">
              Confirmed by {order.warehouseArrival.submittedByName} at{" "}
              {fmtStamp(order.warehouseArrival.submittedAt)}
            </Badge>
          ) : (
            <Badge tone="warning">Pending Warehouse Arrival</Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end">
          <Field label="Mandatory Warehouse Arrival Photo URL">
            <Input
              value={whPhotoUrl}
              onChange={(e) => setWhPhotoUrl(e.target.value)}
              placeholder="/event-manager-images/planning.jpg"
            />
          </Field>
          <Field label="Unloading Bay Notes">
            <Input
              value={whNotes}
              onChange={(e) => setWhNotes(e.target.value)}
              placeholder="e.g. Arrived at Warehouse Bay 2; return count in progress."
            />
          </Field>
          <Button
            type="button"
            icon={Warehouse}
            onClick={() => {
              const res = submitArrivalCheckpoint(actor, {
                eventId: order.eventId,
                checkpoint: "Warehouse Arrival",
                photoUrl: whPhotoUrl,
                notes: whNotes,
              })
              if (!res.ok) notify(res.error)
              else notify("Arrived at Warehouse confirmed with warehouse photo.")
            }}
          >
            Confirm Arrived at Warehouse (Team Lead)
          </Button>
        </div>
      </Card>

      {/* Step 2: Return Count vs Outbound Loaded Quantities & Final Return Checklist */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Step 2 — Return Count Against Outbound Loaded Quantities & Final Return Checklist
            </h3>
            <p className="text-xs text-muted-foreground">
              Count returned items against the quantities that actually left. Any return shortfall
              requires a Missing Item Report or Damage Report for Warehouse reconciliation.
            </p>
          </div>
          {order.returnChecklist && (
            <Badge tone="success">
              Return Checklist Submitted by {order.returnChecklist.submittedByName}
            </Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4">Asset</th>
                <th className="py-3 pr-4">Outbound Actual Loaded</th>
                <th className="py-3 pr-4">Physical Returned Qty</th>
                <th className="py-3 pr-4">Discrepancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {manifestLines.map((line) => {
                const outbound = line.loadedQty > 0 ? line.loadedQty : line.plannedQty
                const diff = Math.max(0, outbound - line.returnedQty)
                return (
                  <tr key={line.lineId}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-foreground">{line.name}</div>
                      <div className="text-xs text-muted-foreground">{line.code}</div>
                    </td>
                    <td className="py-3 pr-4 font-semibold tabular-nums">
                      {outbound} {line.unit}
                    </td>
                    <td className="py-3 pr-4">
                      <Input
                        type="number"
                        min={0}
                        max={outbound}
                        value={line.returnedQty}
                        onChange={(e) => {
                          updateManifestReturnedQuantity(
                            order.eventId,
                            line.sourceId,
                            Number(e.target.value),
                          )
                        }}
                        className="w-24 tabular-nums"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {diff > 0 ? (
                        <Badge tone="danger">Missing / Unaccounted: {diff}</Badge>
                      ) : (
                        <Badge tone="success">100% Returned</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-line pt-4 space-y-3">
          <Field label="Final Return Checklist Notes">
            <Input
              value={returnChecklistNotes}
              onChange={(e) => setReturnChecklistNotes(e.target.value)}
              placeholder="Summary of post-event return count for Warehouse reconciliation…"
            />
          </Field>
          <Button
            type="button"
            icon={ClipboardCheck}
            onClick={() => {
              const res = submitFinalReturnChecklist(
                actor,
                order.eventId,
                returnChecklistNotes,
              )
              if (!res.ok) notify(res.error)
              else {
                notify(
                  `Final Return Checklist submitted to Warehouse${res.autoCreatedMissingReports > 0 ? ` (${res.autoCreatedMissingReports} Missing Item Report(s) automatically logged for return discrepancies)` : ""}.`,
                )
              }
            }}
          >
            Submit Final Return Checklist to Warehouse (Team Lead)
          </Button>
        </div>
      </Card>

      {/* Step 3: File Missing Item Report or Damage Report at Warehouse Arrival */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground">
          Step 3 — File Missing Item Report or Return Damage Report (Warehouse Arrival)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Report Type">
            <select
              className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
              value={incType}
              onChange={(e) => setIncType(e.target.value as "Missing" | "Damage")}
            >
              <option value="Missing">Missing Item Report</option>
              <option value="Damage">Damage Report</option>
            </select>
          </Field>
          <Field label="Affected Item">
            <select
              className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
              value={incItem}
              onChange={(e) => setIncItem(e.target.value)}
            >
              <option value="">Choose manifest asset…</option>
              {manifestLines.map((l) => (
                <option key={l.lineId} value={`${l.code}|${l.name}`}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Affected Quantity">
            <Input
              type="number"
              min={1}
              value={incQty}
              onChange={(e) => setIncQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discrepancy / Damage Description">
            <Input
              value={incDesc}
              onChange={(e) => setIncDesc(e.target.value)}
              placeholder="Describe missing item or return damage details…"
            />
          </Field>
          <Field label="Evidence Photo URL">
            <Input value={incPhoto} onChange={(e) => setIncPhoto(e.target.value)} />
          </Field>
        </div>
        <Button
          type="button"
          variant="outline"
          icon={FileWarning}
          onClick={() => {
            const [code = "AST-0001", name = manifestLines[0]?.name || "Event Asset"] = incItem
              ? incItem.split("|")
              : ["AST-0001", manifestLines[0]?.name || "Event Asset"]
            const res = submitFieldIncidentReport(actor, {
              eventId: order.eventId,
              reportType: incType,
              checkpoint: "Warehouse Arrival",
              itemCode: code,
              itemName: name,
              quantity: incQty,
              description: incDesc,
              photoUrl: incPhoto,
            })
            if (!res.ok) notify(res.error)
            else {
              notify(`Filed ${incType} Report at Warehouse Arrival for ${name}.`)
              setIncDesc("")
            }
          }}
        >
          File {incType} Report (Warehouse Arrival)
        </Button>
      </Card>

      {/* Step 4: D08 Direct-to-Venue Rental Return Verification */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground">
          Rental return to supplier
        </h3>
        <p className="text-xs text-muted-foreground">
          After the event, the Team Lead verifies the items handed back to the supplier and records
          any missing or damaged rental items. Warehouse reviews this record during reconciliation.
        </p>

        {order.rentals.map((r) => {
          const baseQty = r.venueReceipt?.deliveredQty ?? r.ApprovedRequestedQty
          const hbVal = handbackQty[r.id] ?? baseQty
          const misVal = missingRentalQty[r.id] ?? 0
          const dmgVal = damagedRentalQty[r.id] ?? 0
          const notesVal = returnRentalNotes[r.id] ?? ""

          return (
            <div
              key={r.id}
              className="rounded-xl border border-line bg-fg/[0.02] p-4 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-foreground">
                  {r.vendorName} — {r.itemName} (Delivered Qty: {baseQty})
                </span>
                {r.supplierReturn ? (
                  <Badge tone={r.supplierReturn.hasDiscrepancy ? "danger" : "success"}>
                    Supplier Return Verified by {r.supplierReturn.verifiedByName}
                  </Badge>
                ) : (
                  <Badge tone="warning">Pending Supplier Return Verification</Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Handed Back Qty">
                  <Input
                    type="number"
                    min={0}
                    value={hbVal}
                    onChange={(e) =>
                      setHandbackQty({
                        ...handbackQty,
                        [r.id]: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </Field>
                <Field label="Missing Qty">
                  <Input
                    type="number"
                    min={0}
                    value={misVal}
                    onChange={(e) =>
                      setMissingRentalQty({
                        ...missingRentalQty,
                        [r.id]: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </Field>
                <Field label="Damaged Qty">
                  <Input
                    type="number"
                    min={0}
                    value={dmgVal}
                    onChange={(e) =>
                      setDamagedRentalQty({
                        ...damagedRentalQty,
                        [r.id]: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </Field>
                <Field label="Handback Notes / Discrepancy">
                  <Input
                    value={notesVal}
                    onChange={(e) =>
                      setReturnRentalNotes({ ...returnRentalNotes, [r.id]: e.target.value })
                    }
                    placeholder="Notes on supplier handback…"
                  />
                </Field>
              </div>

              <Button
                type="button"
                icon={UserCheck}
                onClick={() => {
                  const res = recordDirectVenueRentalReturn(actor, {
                    eventId: order.eventId,
                    rentalId: r.id,
                    handedBackQty: hbVal,
                    missingQty: misVal,
                    damagedQty: dmgVal,
                    discrepancyNotes: notesVal,
                  })
                  if (!res.ok) notify(res.error)
                  else notify(`Recorded supplier return confirmation for ${r.vendorName}.`)
                }}
              >
                Confirm Rental Handback to Supplier (Team Lead)
              </Button>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

export { WarehouseArrivalAndReturnAuditModule }
