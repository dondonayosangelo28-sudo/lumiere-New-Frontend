import { useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Hammer,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
} from "lucide-react"
import { Badge, Button, Card, Field, Input, PageHeader } from "../../../components/ui/ui"
import { Visual, fmtStamp, TabBar, textareaCls } from "../../event-manager/shared"
import {
  allocateAllStockForEvent,
  allocateStockForOrderLine,
  closeWarehouseEventAccountability,
  confirmOutboundDeparture,
  getEventManifestLines,
  recordRentalSupplierAcceptance,
  resolveFieldIncidentReport,
  resolveRentalDiscrepancy,
  saveRentalELetterAndBookingRef,
  useOperationsStore,
  getWarehouseSelectedEventId,
  setWarehouseSelectedEventId,
  type OpsActor,
} from "../../../operations/store"
import type { IssueResolutionType, RentalSupplierAcceptance } from "../../../operations/types"
import { useNotify, RESOLUTION_OPTIONS } from "../warehouse-shared"

export default function OrderRequestsModule({
  actor,
  onNavigate,
}: {
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    const passed = getWarehouseSelectedEventId()
    if (passed && state.orderRequests.some((o) => o.eventId === passed)) {
      setWarehouseSelectedEventId("")
      return passed
    }
    return state.orderRequests[0]?.eventId ?? ""
  })
  const [subTab, setSubTab] = useState<"allocation" | "rentals" | "reconciliation">("allocation")

  const order =
    state.orderRequests.find((o) => o.eventId === selectedEventId) ?? state.orderRequests[0]

  // Dispatch outbound form state
  const [vehiclePlate, setVehiclePlate] = useState("NGA-4821 (Lumière Box Truck 02)")
  const [driverName, setDriverName] = useState("R. Santos")
  const [departureNotes, setDepartureNotes] = useState("")

  // Rental E-Letter & Confirmation state
  const [activeRentalId, setActiveRentalId] = useState<string>("")
  const [bookingRefInput, setBookingRefInput] = useState("")
  const [deliveryLocInput, setDeliveryLocInput] = useState("")
  const [deliveryArrInput, setDeliveryArrInput] = useState("")
  const [returnArrInput, setReturnArrInput] = useState("")
  const [directToVenueInput, setDirectToVenueInput] = useState(true)
  const [acceptanceType, setAcceptanceType] =
    useState<RentalSupplierAcceptance["evidenceType"]>("Accepted E-Letter")
  const [acceptanceRef, setAcceptanceRef] = useState("")
  const [acceptanceNotes, setAcceptanceNotes] = useState("")

  // Closeout state
  const [closeoutNotes, setCloseoutNotes] = useState("")
  const [inlineResolutions, setInlineResolutions] = useState<
    Record<string, { type: IssueResolutionType; notes: string }>
  >({})

  if (!order) {
    return (
      <div>
        <PageHeader
          crumbs={["Dashboard", "Order Requests"]}
          title="Order Requests"
          subtitle="Approve an event in Event Manager to publish its asset request here."
        />
        <Card className="p-8 text-center text-muted-foreground">
          No approved event Order Requests have been published yet.
        </Card>
      </div>
    )
  }

  const manifestLines = getEventManifestLines(state, order.eventId)
  const shortfalls = manifestLines.filter((l) => l.loadedQty < l.plannedQty)
  const eventIncidents = state.incidentReports.filter((r) => r.eventId === order.eventId)
  const eventFabJobs = state.fabricationJobs.filter((j) => j.eventId === order.eventId)

  const openRentalEditor = (rentalId: string) => {
    const r = order.rentals.find((x) => x.id === rentalId)
    if (!r) return
    setActiveRentalId(rentalId)
    setBookingRefInput(r.bookingReference || "")
    setDeliveryLocInput(r.eLetter?.deliveryLocation || `Direct-to-Venue — ${order.venue}`)
    setDeliveryArrInput(
      r.eLetter?.deliveryArrangements ||
        `Supplier delivers directly to ${order.venue} before ingress; Ground Crew Team Lead verifies receipt at Venue Arrival.`,
    )
    setReturnArrInput(
      r.eLetter?.returnArrangements ||
        "Supplier pickup at venue post-event strike; Team Lead verifies handback count and condition.",
    )
    setDirectToVenueInput(r.directToVenue ?? true)
    setAcceptanceRef(r.supplierAcceptance?.referenceOrUrl || `ACK-${r.bookingReference || "2026-01"}`)
    setAcceptanceNotes(
      r.supplierAcceptance?.notes ||
        "Supplier signed and returned the rental e-letter confirming items, quantities, and direct-to-venue schedule.",
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Warehouse Operations Manager", "Order Requests"]}
        title="Order Requests"
        subtitle="Prepare assets, confirm rentals, and reconcile returns for approved events."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              icon={Hammer}
              onClick={() => onNavigate("module-custom-fabrication")}
            >
              Custom Fabrication ({eventFabJobs.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              icon={Users}
              onClick={() => onNavigate("module-personnel-deployment")}
            >
              Personnel Deployment
            </Button>
          </div>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-semibold tracking-tight">{order.eventTitle}</h2>
              <Badge tone={order.warehouseClosed ? "success" : "neutral"}>{order.warehouseClosed ? "Closed" : "Open"}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{order.venue} · {fmtStamp(order.startDateTime)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.clientName} · {order.pax} guests · Team Lead: {order.teamLeadName || "Unassigned"} · {order.crewAssignments.length} crew assigned
            </p>
          </div>
          <div className="w-full sm:max-w-64">
            <Field label="Order request">
              <select
                className="h-10 w-full rounded-md border border-line bg-elev px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
                value={order.eventId}
                onChange={(event) => {
                  setSelectedEventId(event.target.value)
                  setActiveRentalId("")
                }}
              >
                {state.orderRequests.map((item) => <option key={item.id} value={item.eventId}>{item.eventTitle}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer font-medium">Order details</summary>
          <dl className="mt-2 space-y-1">
            <div><dt className="inline font-semibold">Order: </dt><dd className="inline">{order.id}</dd></div>
            <div><dt className="inline font-semibold">Event ends: </dt><dd className="inline">{fmtStamp(order.endDateTime)}</dd></div>
            <div><dt className="inline font-semibold">Approved by: </dt><dd className="inline">{order.approvedByName} · {fmtStamp(order.approvedAt)}</dd></div>
            <div><dt className="inline font-semibold">Client approval: </dt><dd className="inline break-words">{order.approvalNote}</dd></div>
            {order.isPreviewSeed && <div><dt className="inline font-semibold">Source: </dt><dd className="inline">Sample event</dd></div>}
          </dl>
        </details>
        <div className="mt-5">
          <TabBar
            label="Order Request fulfillment sections"
            idPrefix="wh-order"
            value={subTab}
            onChange={setSubTab}
            tabs={[
              {
                key: "allocation",
                label: "Assets & dispatch",
                count: order.stockLines.length,
              },
              {
                key: "rentals",
                label: "Rentals",
                count: order.rentals.length,
              },
              {
                key: "reconciliation",
                label: "Returns & closeout",
                count: eventIncidents.filter((i) => i.resolutionStatus !== "Resolved").length,
              },
            ]}
          />
        </div>
      </Card>

      {/* SUBTAB 1: STOCK ALLOCATION & DISPATCH MANIFEST */}
      {subTab === "allocation" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Asset plan
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved requested quantities, Warehouse allocated quantities, and Ground Crew
                  actual loaded quantities are tracked distinctly. Shortages automatically sync to
                  Deficit Queue.
                </p>
              </div>
              {!order.warehouseClosed && (
                <Button
                  type="button"
                  icon={PackageCheck}
                  onClick={() => {
                    const res = allocateAllStockForEvent(order.eventId)
                    notify(
                      `Allocated stock across ${res.allocatedLines} lines (${res.deficitsCreated} shortage entries queued) and prepared dispatch manifest.`,
                    )
                  }}
                >
                  Allocate All Available Stock & Prepare Manifest
                </Button>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">Asset</th>
                    <th className="py-3 pr-4">Whse Available</th>
                    <th className="py-3 pr-4">Approved Requested</th>
                    <th className="py-3 pr-4">Allocated Qty</th>
                    <th className="py-3 pr-4">Actual Loaded Qty</th>
                    <th className="py-3 pr-4">Returned Qty</th>
                    <th className="py-3 text-right">Allocation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.stockLines.map((line) => {
                    const inv = state.inventory.find((i) => i.assetId === line.assetId)
                    const isCustom = line.category === "Custom Fabrication"
                    return (
                      <tr key={line.assetId}>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <Visual
                              src={line.image}
                              label={line.name}
                              className="size-10 shrink-0 rounded-md"
                            />
                            <div>
                              <div className="font-semibold text-foreground">{line.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.assetCode} · {line.category}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums text-xs">
                          {isCustom ? (
                            <Badge tone="info">Ready to Load (Custom)</Badge>
                          ) : inv ? (
                            <span>
                              <strong>{inv.availableStock}</strong> free / {inv.totalStock} total
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3.5 pr-4 font-semibold tabular-nums">
                          {line.approvedRequestedQty} {line.unit}
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={line.approvedRequestedQty}
                              disabled={order.warehouseClosed || isCustom}
                              value={line.allocatedQty}
                              onChange={(e) => {
                                const res = allocateStockForOrderLine(
                                  order.eventId,
                                  line.assetId,
                                  Number(e.target.value),
                                  true,
                                )
                                if (!res.ok) notify(res.error)
                              }}
                              className="w-20"
                            />
                            {line.deficitQty > 0 && (
                              <Badge tone="danger">Deficit: {line.deficitQty}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums">
                          <Badge
                            tone={
                              line.loadedQty >= line.allocatedQty && line.allocatedQty > 0
                                ? "success"
                                : "warning"
                            }
                          >
                            {line.loadedQty} / {line.allocatedQty} loaded
                          </Badge>
                        </td>
                        <td className="py-3.5 pr-4 tabular-nums text-xs">
                          {line.returnedQty} / {line.loadedQty} returned
                        </td>
                        <td className="py-3.5 text-right">
                          {!isCustom && !order.warehouseClosed && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const res = allocateStockForOrderLine(
                                  order.eventId,
                                  line.assetId,
                                  line.approvedRequestedQty,
                                  true,
                                )
                                if (!res.ok) notify(res.error)
                                else notify(`Allocated ${line.approvedRequestedQty} for ${line.name}.`)
                              }}
                            >
                              Allocate full ({line.approvedRequestedQty})
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Custom Fabrication Summary inside Order Request */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Custom fabrication
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Custom items registered under this event require Ground Crew after-shift photo
                  verification before Warehouse marks them Ready to Load.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                icon={Hammer}
                onClick={() => onNavigate("module-custom-fabrication")}
              >
                Manage & Verify in Custom Fabrication
              </Button>
            </div>
            {eventFabJobs.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No custom fabrication items on this event.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {eventFabJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-line bg-fg/[0.02] p-4 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground">{job.spec.name}</span>
                      <Badge
                        tone={
                          job.status === "Ready to Load"
                            ? "success"
                            : job.status === "Needs Correction"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      Qty: <strong className="text-foreground">{job.spec.requestedQty}</strong> ·
                      Dimensions: <strong className="text-foreground">{job.spec.dimensions}</strong>
                    </div>
                    <div className="text-muted-foreground">
                      Materials: {job.spec.materials} · Finish: {job.spec.finish}
                    </div>
                    <div className="text-muted-foreground">
                      Linked Ground Crew shift photos:{" "}
                      <strong className="text-foreground">{job.linkedShiftPhotoIds.length}</strong>
                      {job.verifiedByName && ` · Verified by ${job.verifiedByName}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* D03 Outbound Dispatch Clearance & Departure Confirmation */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Dispatch manifest
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  A shortfall on any planned line blocks departure. The vehicle is cleared to leave
                  only after every planned item is loaded in its full planned quantity and the Team
                  Lead submits the final Loading Checklist.
                </p>
              </div>
              <Badge
                tone={
                  order.outboundDeparture
                    ? "success"
                    : order.loadingChecklist && shortfalls.length === 0
                      ? "info"
                      : "warning"
                }
              >
                {order.outboundDeparture
                  ? "Outbound Departure Confirmed"
                  : order.loadingChecklist && shortfalls.length === 0
                    ? "Cleared for Departure"
                    : "Blocked — Awaiting Full Load & Team Lead Checklist"}
              </Badge>
            </div>

            {shortfalls.length > 0 && (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs text-danger">
                <div className="font-bold">
                  Departure blocked · {shortfalls.length} items below plan
                </div>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {shortfalls.map((s) => (
                    <li key={s.lineId}>
                      <strong>{s.name}</strong>: Planned {s.plannedQty}, Physically Loaded{" "}
                      {s.loadedQty} (Shortfall of {s.shortfallQty}). Load remaining items and have
                      Ground Crew recheck.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-line bg-fg/[0.02] p-4 text-xs space-y-2">
                <div className="font-semibold text-foreground">
                  1. Team Lead Final Loading Checklist Status
                </div>
                {order.loadingChecklist ? (
                  <div className="space-y-1 text-muted-foreground">
                    <div>
                      <Badge tone="success">Submitted</Badge> by{" "}
                      <strong className="text-foreground">
                        {order.loadingChecklist.submittedByName}
                      </strong>{" "}
                      ({order.loadingChecklist.submittedByEmail})
                    </div>
                    <div>Timestamp: {fmtStamp(order.loadingChecklist.submittedAt)}</div>
                    <div>Notes: “{order.loadingChecklist.notes}”</div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    Pending submission by current Team Lead (
                    <strong className="text-foreground">
                      {order.teamLeadName || "Unassigned"}
                    </strong>
                    ) in Ground Crew → Dispatch Loading Checks.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-line bg-fg/[0.02] p-4 text-xs space-y-3">
                <div className="font-semibold text-foreground">
                  2. Warehouse Outbound Departure Confirmation
                </div>
                {order.outboundDeparture ? (
                  <div className="space-y-1 text-muted-foreground">
                    <div>
                      <Badge tone="success">Departed</Badge> Confirmed by{" "}
                      <strong className="text-foreground">
                        {order.outboundDeparture.confirmedByName}
                      </strong>{" "}
                      at {fmtStamp(order.outboundDeparture.confirmedAt)}
                    </div>
                    <div>
                      Vehicle: <strong className="text-foreground">{order.outboundDeparture.vehiclePlate}</strong>{" "}
                      · Driver: <strong className="text-foreground">{order.outboundDeparture.driverName}</strong>
                    </div>
                    <div>Notes: “{order.outboundDeparture.notes}”</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        placeholder="Vehicle plate / truck ID"
                      />
                      <Input
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="Driver name"
                      />
                    </div>
                    <Input
                      value={departureNotes}
                      onChange={(e) => setDepartureNotes(e.target.value)}
                      placeholder="Gate clearance notes…"
                    />
                    <Button
                      type="button"
                      icon={Truck}
                      disabled={!order.loadingChecklist || shortfalls.length > 0}
                      onClick={() => {
                        const res = confirmOutboundDeparture(actor, order.eventId, {
                          vehiclePlate,
                          driverName,
                          notes: departureNotes,
                        })
                        if (!res.ok) notify(res.error)
                        else notify("Outbound vehicle departure confirmed.")
                      }}
                    >
                      Confirm Outbound Vehicle Departure
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SUBTAB 2: RENTALS, E-LETTER & SUPPLIER CONFIRMATION (D07 & D08) */}
      {subTab === "rentals" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-bold text-foreground">
              Event rentals
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Recording a booking reference keeps the rental in{" "}
              <strong className="text-foreground">Pending Confirmation</strong>. Mark the rental{" "}
              <strong className="text-foreground">Confirmed</strong> only after recording explicit
              supplier acceptance of the e-letter terms. Direct-to-venue rentals are verified at the
              venue and on supplier handback by the Ground Crew Team Lead.
            </p>

            {order.rentals.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No rentals registered for this event.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {order.rentals.map((r) => {
                  const isEditing = activeRentalId === r.id
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-line bg-fg/[0.02] p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-foreground">
                              {r.vendorName}
                            </span>
                            <Badge
                              tone={r.confirmationStatus === "Confirmed" ? "success" : "warning"}
                            >
                              {r.confirmationStatus}
                            </Badge>
                            {r.directToVenue && (
                              <Badge tone="info">Direct to venue</Badge>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-foreground">
                            Item: <strong>{r.itemName}</strong> · Approved Requested Quantity:{" "}
                            <strong className="tabular-nums">{r.ApprovedRequestedQty}</strong>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Category: {r.category} · Contact: {r.contact} · Booking Reference:{" "}
                            <strong className="text-foreground">
                              {r.bookingReference || "Not recorded yet"}
                            </strong>
                          </div>
                        </div>
                        {!order.warehouseClosed && (
                          <Button
                            type="button"
                            variant="outline"
                            icon={FileText}
                            onClick={() =>
                              isEditing ? setActiveRentalId("") : openRentalEditor(r.id)
                            }
                          >
                            {isEditing
                              ? "Close E-Letter & Confirmation Panel"
                              : "Manage E-Letter & Supplier Confirmation"}
                          </Button>
                        )}
                      </div>

                      {/* E-Letter & Supplier Acceptance Summary */}
                      <div className="grid gap-3 md:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-line bg-card p-3 space-y-1">
                          <div className="font-semibold text-foreground">
                            1. Rental E-Letter & Booking Ref
                          </div>
                          {r.eLetter ? (
                            <>
                              <div>
                                Prepared by <strong>{r.eLetter.preparedByName}</strong> (
                                {fmtStamp(r.eLetter.preparedAt)})
                              </div>
                              <div className="text-muted-foreground">
                                Delivery: {r.eLetter.deliveryLocation}
                              </div>
                              <div className="text-muted-foreground">
                                Return: {r.eLetter.returnArrangements}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">E-Letter not prepared yet.</div>
                          )}
                        </div>

                        <div className="rounded-lg border border-line bg-card p-3 space-y-1">
                          <div className="font-semibold text-foreground">
                            2. Supplier confirmation
                          </div>
                          {r.supplierAcceptance ? (
                            <>
                              <div>
                                <Badge tone="success">{r.supplierAcceptance.evidenceType}</Badge>{" "}
                                Ref: <strong>{r.supplierAcceptance.referenceOrUrl}</strong>
                              </div>
                              <div className="text-muted-foreground">
                                {r.supplierAcceptance.notes}
                              </div>
                              <div className="text-muted-foreground">
                                Recorded by {r.supplierAcceptance.recordedByName} at{" "}
                                {fmtStamp(r.supplierAcceptance.recordedAt)}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">
                              Awaiting explicit supplier acceptance. Status remains{" "}
                              <strong>Pending Confirmation</strong> even when booking reference is
                              set.
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-line bg-card p-3 space-y-1">
                          <div className="font-semibold text-foreground">
                            3. Venue receipt and return
                          </div>
                          {r.venueReceipt ? (
                            <div>
                              Venue Receipt: <strong>{r.venueReceipt.deliveredQty}</strong>/
                              {r.ApprovedRequestedQty} delivered (Verified by{" "}
                              {r.venueReceipt.verifiedByName})
                              {r.venueReceipt.hasDiscrepancy && (
                                <span className="ml-1 text-danger">
                                  · Discrepancy: {r.venueReceipt.discrepancyNotes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">
                              Venue receipt not yet recorded by Team Lead.
                            </div>
                          )}
                          {r.supplierReturn ? (
                            <div className="mt-1">
                              Supplier Return: <strong>{r.supplierReturn.handedBackQty}</strong>{" "}
                              handed back (Missing: {r.supplierReturn.missingQty}, Damaged:{" "}
                              {r.supplierReturn.damagedQty}) — Verified by{" "}
                              {r.supplierReturn.verifiedByName}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">
                              Supplier post-event return not yet recorded by Team Lead.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Interactive E-Letter & Supplier Acceptance Editor */}
                      {isEditing && (
                        <div className="grid gap-5 border-t border-line pt-4 lg:grid-cols-2">
                          <div className="space-y-3 rounded-xl border border-line bg-card p-4">
                            <div className="text-sm font-bold text-foreground">
                              Step A — Prepare Rental E-Letter & Booking Reference
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Saving a booking reference and e-letter keeps the status as{" "}
                              <strong>Pending Confirmation</strong> until supplier acceptance is
                              recorded in Step B.
                            </p>
                            <Field label="Supplier Booking Reference">
                              <Input
                                value={bookingRefInput}
                                onChange={(e) => setBookingRefInput(e.target.value)}
                                placeholder="e.g. SNG-2026-8841"
                              />
                            </Field>
                            <Field label="Delivery Location">
                              <Input
                                value={deliveryLocInput}
                                onChange={(e) => setDeliveryLocInput(e.target.value)}
                              />
                            </Field>
                            <Field label="Delivery Arrangements">
                              <textarea
                                className={textareaCls}
                                rows={2}
                                value={deliveryArrInput}
                                onChange={(e) => setDeliveryArrInput(e.target.value)}
                              />
                            </Field>
                            <Field label="Return Arrangements">
                              <textarea
                                className={textareaCls}
                                rows={2}
                                value={returnArrInput}
                                onChange={(e) => setReturnArrInput(e.target.value)}
                              />
                            </Field>
                            <Button
                              type="button"
                              variant="outline"
                              icon={FileText}
                              onClick={() => {
                                const res = saveRentalELetterAndBookingRef(actor, {
                                  eventId: order.eventId,
                                  rentalId: r.id,
                                  bookingReference: bookingRefInput,
                                  deliveryLocation: deliveryLocInput,
                                  deliveryArrangements: deliveryArrInput,
                                  returnArrangements: returnArrInput,
                                  directToVenue: directToVenueInput,
                                })
                                if (!res.ok) notify(res.error)
                                else
                                  notify(
                                    `Saved Rental E-Letter and Booking Ref (${bookingRefInput || "none"}). Status remains Pending Confirmation until supplier acceptance is recorded.`,
                                  )
                              }}
                            >
                              Save E-Letter & Booking Reference
                            </Button>
                          </div>

                          <div className="space-y-3 rounded-xl border border-line bg-card p-4">
                            <div className="text-sm font-bold text-foreground">
                              Step B — Record Explicit Supplier Acceptance (Marks Confirmed)
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Requires an accepted e-letter, written confirmation of its terms, or a
                              signed agreement. Updates both Warehouse and Event Manager views to{" "}
                              <strong>Confirmed</strong>.
                            </p>
                            <Field label="Supplier Acceptance Evidence Type">
                              <select
                                className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
                                value={acceptanceType}
                                onChange={(e) =>
                                  setAcceptanceType(
                                    e.target.value as RentalSupplierAcceptance["evidenceType"],
                                  )
                                }
                              >
                                <option value="Accepted E-Letter">Accepted E-Letter</option>
                                <option value="Written Confirmation">
                                  Written Confirmation of Terms
                                </option>
                                <option value="Signed Agreement">Signed Agreement</option>
                              </select>
                            </Field>
                            <Field label="Accepted E-Letter / Agreement Reference">
                              <Input
                                value={acceptanceRef}
                                onChange={(e) => setAcceptanceRef(e.target.value)}
                                placeholder="e.g. ACK-SNG-2026-8841-SIGNED.pdf"
                              />
                            </Field>
                            <Field label="Supplier Response Notes">
                              <textarea
                                className={textareaCls}
                                rows={2}
                                value={acceptanceNotes}
                                onChange={(e) => setAcceptanceNotes(e.target.value)}
                              />
                            </Field>
                            <Button
                              type="button"
                              icon={FileCheck2}
                              onClick={() => {
                                const res = recordRentalSupplierAcceptance(actor, {
                                  eventId: order.eventId,
                                  rentalId: r.id,
                                  evidenceType: acceptanceType,
                                  referenceOrUrl: acceptanceRef,
                                  notes: acceptanceNotes,
                                })
                                if (!res.ok) notify(res.error)
                                else {
                                  notify(
                                    `Supplier acceptance recorded for ${r.vendorName}. Rental is now Confirmed in Warehouse and Event Manager views.`,
                                  )
                                  setActiveRentalId("")
                                }
                              }}
                            >
                              Record Supplier Acceptance & Mark Confirmed
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SUBTAB 3: RETURN SIGN-OFF & EVENT CLOSEOUT (D05) */}
      {subTab === "reconciliation" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Return reconciliation
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Warehouse can close accountability for the event only after the Team Lead submits
                  the Return Checklist and every missing item, damage report, and rental return
                  discrepancy has a documented resolution.
                </p>
              </div>
              <Badge tone={order.warehouseClosed ? "success" : "warning"}>
                {order.warehouseClosed
                  ? `Closed by ${order.closedByName} (${fmtStamp(order.closedAt!)})`
                  : "Warehouse Accountability Open"}
              </Badge>
            </div>

            {/* Checkpoint Summary */}
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-xs">
              <div className="rounded-lg border border-line bg-fg/[0.02] p-3">
                <div className="font-semibold text-foreground">1. Dispatch Loading</div>
                {order.loadingChecklist ? (
                  <div className="mt-1 text-muted-foreground">
                    Submitted by{" "}
                    <strong className="text-foreground">
                      {order.loadingChecklist.submittedByName}
                    </strong>{" "}
                    at {fmtStamp(order.loadingChecklist.submittedAt)}
                  </div>
                ) : (
                  <div className="mt-1 text-muted-foreground">Not submitted yet</div>
                )}
              </div>
              <div className="rounded-lg border border-line bg-fg/[0.02] p-3">
                <div className="font-semibold text-foreground">2. Venue Arrival</div>
                {order.venueArrival ? (
                  <div className="mt-1 text-muted-foreground">
                    Photo confirmed by{" "}
                    <strong className="text-foreground">
                      {order.venueArrival.submittedByName}
                    </strong>{" "}
                    at {fmtStamp(order.venueArrival.submittedAt)}
                  </div>
                ) : (
                  <div className="mt-1 text-muted-foreground">Not confirmed yet</div>
                )}
              </div>
              <div className="rounded-lg border border-line bg-fg/[0.02] p-3">
                <div className="font-semibold text-foreground">4. Warehouse Arrival</div>
                {order.warehouseArrival ? (
                  <div className="mt-1 text-muted-foreground">
                    Photo confirmed by{" "}
                    <strong className="text-foreground">
                      {order.warehouseArrival.submittedByName}
                    </strong>{" "}
                    at {fmtStamp(order.warehouseArrival.submittedAt)}
                  </div>
                ) : (
                  <div className="mt-1 text-muted-foreground">Not confirmed yet</div>
                )}
              </div>
              <div className="rounded-lg border border-line bg-fg/[0.02] p-3">
                <div className="font-semibold text-foreground">Final Return Checklist</div>
                {order.returnChecklist ? (
                  <div className="mt-1 text-muted-foreground">
                    Submitted by{" "}
                    <strong className="text-foreground">
                      {order.returnChecklist.submittedByName}
                    </strong>{" "}
                    at {fmtStamp(order.returnChecklist.submittedAt)}
                  </div>
                ) : (
                  <div className="mt-1 text-muted-foreground">Pending Team Lead submission</div>
                )}
              </div>
            </div>

            {/* Missing & Damage Reports for this Event */}
            <div className="mt-6">
              <h4 className="text-sm font-bold text-foreground">
                Field Damage Reports & Missing Item Reports ({eventIncidents.length})
              </h4>
              {eventIncidents.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No damage or missing item reports filed for this event.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {eventIncidents.map((inc) => {
                    const draftRes = inlineResolutions[inc.id] ?? {
                      type: "Recovered",
                      notes: "",
                    }
                    return (
                      <div
                        key={inc.id}
                        className="rounded-xl border border-line bg-fg/[0.02] p-4 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={inc.reportType === "Damage" ? "danger" : "warning"}>
                                {inc.reportType} Report
                              </Badge>
                              <Badge tone="neutral">Checkpoint: {inc.checkpoint}</Badge>
                              <span className="font-bold text-sm text-foreground">
                                {inc.itemName} (×{inc.quantity})
                              </span>
                              <Badge
                                tone={inc.resolutionStatus === "Resolved" ? "success" : "danger"}
                              >
                                {inc.resolutionStatus}
                              </Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              Description: “{inc.description}” · Filed by{" "}
                              <strong className="text-foreground">{inc.submittedByName}</strong> at{" "}
                              {fmtStamp(inc.submittedAt)}
                            </p>
                            {inc.resolutionStatus === "Resolved" && (
                              <p className="mt-1 text-foreground">
                                <strong>Resolution ({inc.resolutionType}):</strong>{" "}
                                {inc.resolutionNotes} — Signed off by {inc.resolvedByName}
                              </p>
                            )}
                          </div>
                        </div>

                        {inc.resolutionStatus !== "Resolved" && !order.warehouseClosed && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto] items-center border-t border-line pt-3">
                            <select
                              className="h-9 rounded-md border border-fg/[0.06] bg-fg/[0.08] px-2.5 text-xs text-foreground"
                              value={draftRes.type}
                              onChange={(e) =>
                                setInlineResolutions({
                                  ...inlineResolutions,
                                  [inc.id]: {
                                    ...draftRes,
                                    type: e.target.value as IssueResolutionType,
                                  },
                                })
                              }
                            >
                              {RESOLUTION_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <Input
                              value={draftRes.notes}
                              onChange={(e) =>
                                setInlineResolutions({
                                  ...inlineResolutions,
                                  [inc.id]: { ...draftRes, notes: e.target.value },
                                })
                              }
                              placeholder="Document resolution (e.g. item recovered, repair order #41, approved write-off)…"
                            />
                            <Button
                              type="button"
                              onClick={() => {
                                const res = resolveFieldIncidentReport(actor, inc.id, {
                                  resolutionType: draftRes.type,
                                  resolutionNotes: draftRes.notes,
                                })
                                if (!res.ok) notify(res.error)
                                else notify(`Resolved ${inc.reportType} report for ${inc.itemName}.`)
                              }}
                            >
                              Record Resolution
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Rental Return Discrepancies */}
            <div className="mt-6">
              <h4 className="text-sm font-bold text-foreground">
                Rental reconciliation
              </h4>
              <div className="mt-3 space-y-3">
                {order.rentals.map((r) => {
                  const receiptDisc =
                    r.venueReceipt?.hasDiscrepancy &&
                    r.venueReceipt.resolutionStatus !== "Resolved"
                  const returnDisc =
                    r.supplierReturn?.hasDiscrepancy &&
                    r.supplierReturn.resolutionStatus !== "Resolved"
                  const key = `rnt-res-${r.id}`
                  const draftRes = inlineResolutions[key] ?? {
                    type: "Supplier Settled",
                    notes: "",
                  }
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-line bg-fg/[0.02] p-4 text-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {r.vendorName} — {r.itemName} (Requested: {r.ApprovedRequestedQty})
                        </span>
                        <Badge
                          tone={
                            !r.supplierReturn
                              ? "warning"
                              : receiptDisc || returnDisc
                                ? "danger"
                                : "success"
                          }
                        >
                          {!r.supplierReturn
                            ? "Awaiting Team Lead Return Check"
                            : receiptDisc || returnDisc
                              ? "Unresolved Discrepancy"
                              : "Rental Return Reconciled"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        Venue Receipt:{" "}
                        {r.venueReceipt
                          ? `${r.venueReceipt.deliveredQty} delivered (${r.venueReceipt.discrepancyNotes}) — Verified by ${r.venueReceipt.verifiedByName}`
                          : "Not recorded yet"}
                      </div>
                      <div className="text-muted-foreground">
                        Supplier Return:{" "}
                        {r.supplierReturn
                          ? `${r.supplierReturn.handedBackQty} handed back, ${r.supplierReturn.missingQty} missing, ${r.supplierReturn.damagedQty} damaged (${r.supplierReturn.discrepancyNotes}) — Verified by ${r.supplierReturn.verifiedByName}`
                          : "Not recorded yet"}
                      </div>
                      {r.supplierReturn?.resolutionStatus === "Resolved" && (
                        <div className="text-foreground">
                          <strong>Return Discrepancy Resolution ({r.supplierReturn.resolutionType}):</strong>{" "}
                          {r.supplierReturn.resolutionNotes} (by {r.supplierReturn.resolvedByName})
                        </div>
                      )}
                      {(receiptDisc || returnDisc) && !order.warehouseClosed && (
                        <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto] items-center border-t border-line pt-3">
                          <select
                            className="h-9 rounded-md border border-fg/[0.06] bg-fg/[0.08] px-2.5 text-xs text-foreground"
                            value={draftRes.type}
                            onChange={(e) =>
                              setInlineResolutions({
                                ...inlineResolutions,
                                [key]: {
                                  ...draftRes,
                                  type: e.target.value as IssueResolutionType,
                                },
                              })
                            }
                          >
                            {RESOLUTION_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={draftRes.notes}
                            onChange={(e) =>
                              setInlineResolutions({
                                ...inlineResolutions,
                                [key]: { ...draftRes, notes: e.target.value },
                              })
                            }
                            placeholder="Document supplier settlement or recovery…"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              if (receiptDisc) {
                                resolveRentalDiscrepancy(actor, {
                                  eventId: order.eventId,
                                  rentalId: r.id,
                                  stage: "receipt",
                                  resolutionType: draftRes.type,
                                  resolutionNotes: draftRes.notes,
                                })
                              }
                              if (returnDisc) {
                                resolveRentalDiscrepancy(actor, {
                                  eventId: order.eventId,
                                  rentalId: r.id,
                                  stage: "return",
                                  resolutionType: draftRes.type,
                                  resolutionNotes: draftRes.notes,
                                })
                              }
                              notify(`Resolved rental discrepancy for ${r.vendorName}.`)
                            }}
                          >
                            Resolve Rental Discrepancy
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Separate Ground Crew Task Completion vs Warehouse Event Closeout */}
            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Ground Crew Task Completion (tracked separately from Warehouse Closeout):{" "}
                  <strong className="text-foreground">
                    {order.crewAssignments.filter((a) => a.taskStatus === "Completed").length}/
                    {order.crewAssignments.length} tasks completed
                  </strong>
                </span>
              </div>
              {order.warehouseClosed ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-foreground">
                  <div className="font-bold text-[#4ade80]">
                    Warehouse Accountability Closed for {order.eventTitle}
                  </div>
                  <div className="mt-1">
                    Closed by <strong>{order.closedByName}</strong> ({order.closedByEmail}) at{" "}
                    {fmtStamp(order.closedAt!)}
                  </div>
                  <div className="mt-1 text-muted-foreground">Notes: “{order.closeoutNotes}”</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label="Warehouse Event Closeout Sign-off Notes">
                    <textarea
                      className={textareaCls}
                      rows={2}
                      value={closeoutNotes}
                      onChange={(e) => setCloseoutNotes(e.target.value)}
                      placeholder="Final reconciliation remarks before closing warehouse accountability for this event…"
                    />
                  </Field>
                  <Button
                    type="button"
                    icon={CheckCircle2}
                    onClick={() => {
                      const res = closeWarehouseEventAccountability(
                        actor,
                        order.eventId,
                        closeoutNotes,
                      )
                      if (!res.ok) notify(res.error)
                      else notify(`Event ${order.eventTitle} reconciled and closed.`)
                    }}
                  >
                    Sign Off Return & Close Warehouse Event Accountability
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
