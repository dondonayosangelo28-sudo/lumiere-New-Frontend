import { useEffect, useState } from "react"
import {
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  PackageOpen,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react"
import Modal from "../../../components/overlay/Modal"
import { Badge, Button, Field, Input, cx } from "../../../components/ui/ui"
import { fieldCls, ghostBtn } from "../../../components/admin/AdminKit"
import SearchableDropdown from "../../../components/ui/SearchableDropdown"
import { useOperationsStore } from "../../../operations/store"
import {
  assets,
  displayDate,
  type Availability,
  type Brief,
  type CustomItemRequirement,
  type Rental,
} from "../model"
import { previewStudio } from "../preview-data"
import RentalEntry from "../rentals/RentalEntry"
import { addEventSupplier, isSupplierAdded } from "../rentals/event-rentals"
import { rentalCatalogOptions } from "../rentals/rental-catalog"
import {
  FieldError,
  Visual,
  datePart,
  textareaCls,
  type StudioUser,
} from "../shared"
import {
  stockConfirmationKey,
  stockThreshold,
  stockWarning,
} from "../stock-policy"
import StepHead from "./StepHead"

export function AssetStep({
  brief,
  update,
  avail,
  readOnly,
  user,
  savedId,
  onRefresh,
}: {
  brief: Brief
  update: (p: Partial<Brief>) => void
  avail: Availability[]
  readOnly: boolean
  user: StudioUser
  savedId?: string
  onRefresh: () => void
}) {
  const [rental, setRental] = useState("")
  const [rentalError, setRentalError] = useState("")
  const [requestPrompt, setRequestPrompt] = useState<{ id: string; quantity: number; available: number; shortage: number } | null>(null)
  const [localPickerRequest, setLocalPickerRequest] = useState(0)
  const [pick, setPick] = useState("")
  const [sameDay, setSameDay] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const day = datePart(brief.start)

  useEffect(() => {
    let live = true
    if (!day) {
      setSameDay(null)
      return
    }
    previewStudio(user)
      .then(
        (all) =>
          live &&
          setSameDay(
            all.filter(
              (p) =>
                p.status === "approved" &&
                p.id !== savedId &&
                datePart(p.brief.start) === day,
            ).length,
          ),
      )
      .catch(() => live && setSameDay(null))
    return () => {
      live = false
    }
  }, [day, savedId, user, tick])

  const setQty = (id: string, n: number, confirmed = false) => {
    const usedOnBoard = brief.requirements.find((r) => r.assetId === id)?.boardQuantity ?? 0
    const quantity = Math.max(usedOnBoard, 1, Math.min(9999, Math.round(n) || 1))
    const available = avail.find((entry) => entry.assetId === id)?.available
    const stockConfirmation = confirmed && available !== undefined ? stockConfirmationKey(brief, id, quantity, available) : undefined
    const exists = brief.requirements.some((r) => r.assetId === id)
    update({
      requirements: exists
        ? brief.requirements.map((r) =>
            r.assetId === id ? { ...r, quantity, manualQuantity: quantity, stockConfirmation } : r,
          )
        : [...brief.requirements, { assetId: id, quantity, manualQuantity: quantity, stockConfirmation }].sort(
            (a, b) =>
              assets.findIndex((x) => x.id === a.assetId) -
              assets.findIndex((x) => x.id === b.assetId),
          ),
    })
  }
  const removeReq = (id: string) =>
    update({ requirements: brief.requirements.filter((r) => r.assetId !== id) })
  const setRentals = (rentals: Rental[]) => update({ rentals })
  const patchRental = (id: string, p: Partial<Rental>) =>
    setRentals(brief.rentals.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const opsState = useOperationsStore()
  const warehouseOrder = savedId
    ? opsState.orderRequests.find((o) => o.eventId === savedId)
    : undefined
  const customItems = brief.customItems ?? []
  const setCustomItems = (next: CustomItemRequirement[]) => update({ customItems: next })
  const [newCustomOpen, setNewCustomOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState({
    name: "",
    quantity: 1,
    dimensions: "",
    materials: "",
    colors: "",
    finish: "",
    instructions: "",
    referenceImage: "/event-manager-images/garden.jpg",
  })

  const addCustomItem = () => {
    if (!customDraft.name.trim()) return
    const item: CustomItemRequirement = {
      id: `cust-${crypto.randomUUID().slice(0, 8)}`,
      name: customDraft.name.trim(),
      quantity: Math.max(1, Math.round(Number(customDraft.quantity) || 1)),
      dimensions: customDraft.dimensions.trim() || "Custom dimensions per venue plan",
      materials: customDraft.materials.trim() || "Specified per mood board",
      colors: customDraft.colors.trim() || "Event theme palette",
      finish: customDraft.finish.trim() || "Satin protective finish",
      instructions:
        customDraft.instructions.trim() ||
        "Fabricate and finish according to approved Event Manager specifications.",
      referenceImages: [customDraft.referenceImage.trim() || "/event-manager-images/garden.jpg"],
    }
    setCustomItems([...customItems, item])
    setCustomDraft({
      name: "",
      quantity: 1,
      dimensions: "",
      materials: "",
      colors: "",
      finish: "",
      instructions: "",
      referenceImage: "/event-manager-images/garden.jpg",
    })
    setNewCustomOpen(false)
  }

  const open = assets.filter(
    (a) => !brief.requirements.some((r) => r.assetId === a.id),
  )
  const datesKnown = !!brief.start && !!brief.end
  const pax = Math.max(0, brief.pax || 0)
  const crew = [Math.max(2, Math.ceil(pax / 25)), Math.max(2, Math.ceil(pax / 15))]

  return (
    <div className="em-step-grid">
      <div className="min-w-0 space-y-6">
        <section className="em-panel em-step-panel">
          <StepHead
            eyebrow="03 / The practical magic"
            title="The pieces behind the picture."
            description="Read-only availability previews. Stock is reserved only after client approval."
          />
          {!datesKnown && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
              <CircleAlert size={14} aria-hidden /> Add start and end times to
              check against approved events.
            </p>
          )}
          {!readOnly && (
            <div className="em-pick-row">
              <div className="relative min-w-0 flex-1">
                <SearchableDropdown
                  openRequest={localPickerRequest}
                  aria-label="Choose a piece from the library"
                  value={pick}
                  onChange={setPick}
                  disabled={open.length === 0}
                  placeholder={open.length ? "Choose a piece from the library" : "Every library piece is in the plan"}
                  options={open.map((a) => ({ value: a.id, label: `${a.name} · ${a.category}` }))}
                  className={cx(fieldCls, "appearance-none pr-9 text-left")}
                />
                <ChevronDown
                  size={16}
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              <button
                type="button"
                className="em-btn em-btn--outline em-btn--sm"
                disabled={!pick}
                onClick={() => {
                  setQty(pick, 1)
                  setPick("")
                }}
              >
                <Plus size={14} strokeWidth={1.5} aria-hidden /> Add asset
              </button>
            </div>
          )}

          <div className="em-req" role="table" aria-label="Asset requirements and sample stock availability">
            <div className="em-req-head" role="row">
              <span role="columnheader">Asset</span>
              <span role="columnheader">{readOnly ? "Approved requested" : "Requested"}</span>
              <span role="columnheader">Available</span>
              <span role="columnheader">Deficit</span>
              <span role="columnheader" className="sr-only">
                Actions
              </span>
            </div>
            {brief.requirements.length === 0 ? (
              <div className="em-req-empty" role="row">
                <span role="cell">
                  <Boxes size={20} strokeWidth={1.5} aria-hidden />
                  Add the company assets this event will need.
                </span>
              </div>
            ) : (
              brief.requirements.map((r) => {
                const a = assets.find((x) => x.id === r.assetId)
                if (!a) return null
                const av = avail.find((x) => x.assetId === a.id)
                const whLine = warehouseOrder?.stockLines.find((s) => s.assetId === a.id)
                const approvedQty = whLine?.approvedRequestedQty ?? r.quantity
                const warning = av ? stockWarning(a.id, r.quantity, av.available) : null
                const short = av && r.quantity > av.available ? r.quantity - av.available : 0
                const confirmedRequest =
                  !!av &&
                  !!warning &&
                  r.stockConfirmation === stockConfirmationKey(brief, a.id, r.quantity, av.available)
                return (
                  <div className={cx("em-req-row", warning && "bg-amber-500/5 ring-1 ring-inset ring-amber-500/25")} role="row" key={a.id}>
                    <span role="cell" className="em-req-asset">
                      <Visual
                        src={a.image}
                        label={a.name}
                        icon={PackageOpen}
                        className="size-10 shrink-0 rounded-md"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">
                          {a.name}
                        </span>
                        <span className="block text-[12px] text-muted-foreground tabular-nums">
                          {a.category} · {a.stock} in stock
                          {readOnly && whLine ? ` · Warehouse allocated: ${whLine.allocatedQty}/${approvedQty}` : ""}
                        </span>
                        {!!r.boardQuantity && <span className="block text-xs text-muted-foreground">{r.boardQuantity} used on mood board</span>}
                      </span>
                    </span>
                    <span role="cell">
                      {readOnly ? (
                        <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold tabular-nums">
                          {approvedQty} <span className="text-xs font-normal text-muted-foreground">{a.unit}</span>
                        </span>
                      ) : (
                        <Input
                          type="number"
                          min={Math.max(1, r.boardQuantity ?? 0)}
                          max={9999}
                          inputMode="numeric"
                          aria-label={`${a.name} quantity`}
                          value={r.quantity || ""}
                          placeholder="0"
                          onChange={(e) => setQty(a.id, Number(e.target.value))}
                          className="w-20"
                        />
                      )}
                    </span>
                    <span role="cell" className="tabular-nums">
                      <span className="em-req-label" aria-hidden>
                        Available{" "}
                      </span>
                      {av ? av.available : "—"}
                    </span>
                    <span role="cell" className="em-req-deficit">
                      <span className="em-req-label" aria-hidden>
                        Deficit{" "}
                      </span>
                      {short ? (
                        <>
                          <Badge tone="danger">Short by {short}</Badge>
                          {confirmedRequest ? (
                            <Badge tone="info">Request created</Badge>
                          ) : !readOnly && av ? (
                            <button
                              type="button"
                              className={ghostBtn}
                              onClick={() =>
                                setRequestPrompt({ id: a.id, quantity: r.quantity, available: av.available, shortage: short })
                              }
                            >
                              <Plus size={14} aria-hidden /> Request
                            </button>
                          ) : null}
                        </>
                      ) : warning?.reason === "low_stock" ? (
                        <>
                          <Badge tone="warning">Low stock</Badge>
                          {confirmedRequest ? (
                            <Badge tone="info">Request created</Badge>
                          ) : !readOnly && av ? (
                            <button
                              type="button"
                              className={ghostBtn}
                              onClick={() =>
                                setRequestPrompt({ id: a.id, quantity: r.quantity, available: av.available, shortage: 0 })
                              }
                            >
                              <Plus size={14} aria-hidden /> Request
                            </button>
                          ) : null}
                        </>
                      ) : r.quantity > 0 ? (
                        <span className="em-req-ok">
                          <Check size={13} strokeWidth={2} aria-hidden /> None
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <span role="cell" className="em-req-remove">
                      {!readOnly && (
                        <button
                          type="button"
                          className="em-icon-btn"
                          onClick={() => removeReq(a.id)}
                          disabled={!!r.boardQuantity}
                          title={r.boardQuantity ? "Remove this asset from the mood board first." : `Remove ${a.name}`}
                          aria-label={`Remove ${a.name}`}
                        >
                          <X size={15} strokeWidth={1.5} aria-hidden />
                        </button>
                      )}
                    </span>
                  </div>
                )
              })
            )}
          </div>
          <div className="em-req-foot">
            <span>Includes one preparation day and one return day.</span>
            <button
              type="button"
              className="em-btn em-btn--quiet em-btn--sm"
              onClick={() => {
                onRefresh()
                setTick((t) => t + 1)
              }}
            >
              <RefreshCw size={14} strokeWidth={1.5} aria-hidden /> Refresh
            </button>
          </div>
        </section>

        <section className="em-panel em-step-panel">
          <StepHead
            eyebrow="Custom fabrication (D02)"
            title="Custom-built structures & bespoke pieces"
            description="Register custom items under the same event Asset Plan with dimensions, reference imagery, materials, colors, finish, and build instructions for Warehouse production verification."
            actions={
              !readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  icon={Plus}
                  onClick={() => setNewCustomOpen((v) => !v)}
                >
                  {newCustomOpen ? "Cancel" : "Add custom item"}
                </Button>
              ) : undefined
            }
          />
          {!readOnly && newCustomOpen && (
            <div className="mt-4 rounded-xl border border-line bg-fg/[0.03] p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_130px]">
                <Field label="Custom item name">
                  <Input
                    value={customDraft.name}
                    onChange={(e) => setCustomDraft({ ...customDraft, name: e.target.value })}
                    placeholder="e.g. Bespoke Brass & Travertine Monogram Arch"
                  />
                </Field>
                <Field label="Requested qty">
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={customDraft.quantity}
                    onChange={(e) =>
                      setCustomDraft({
                        ...customDraft,
                        quantity: Math.max(1, Math.round(Number(e.target.value) || 1)),
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dimensions">
                  <Input
                    value={customDraft.dimensions}
                    onChange={(e) => setCustomDraft({ ...customDraft, dimensions: e.target.value })}
                    placeholder="e.g. 2.4m H × 0.9m W × 0.6m D"
                  />
                </Field>
                <Field label="Materials">
                  <Input
                    value={customDraft.materials}
                    onChange={(e) => setCustomDraft({ ...customDraft, materials: e.target.value })}
                    placeholder="e.g. Brushed brass frame, travertine panels, steel base"
                  />
                </Field>
                <Field label="Colors">
                  <Input
                    value={customDraft.colors}
                    onChange={(e) => setCustomDraft({ ...customDraft, colors: e.target.value })}
                    placeholder="e.g. Warm Champagne Gold & Ivory"
                  />
                </Field>
                <Field label="Finish">
                  <Input
                    value={customDraft.finish}
                    onChange={(e) => setCustomDraft({ ...customDraft, finish: e.target.value })}
                    placeholder="e.g. Satin matte weather-sealed lacquer"
                  />
                </Field>
              </div>
              <Field label="Reference image URL">
                <Input
                  value={customDraft.referenceImage}
                  onChange={(e) => setCustomDraft({ ...customDraft, referenceImage: e.target.value })}
                  placeholder="/event-manager-images/garden.jpg"
                />
              </Field>
              <Field label="Construction & assembly instructions">
                <textarea
                  className={textareaCls}
                  rows={3}
                  value={customDraft.instructions}
                  onChange={(e) => setCustomDraft({ ...customDraft, instructions: e.target.value })}
                  placeholder="Describe structural requirements, electrical/lighting channels, branding placement, and assembly tolerances…"
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setNewCustomOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!customDraft.name.trim()}
                  onClick={addCustomItem}
                >
                  Save custom item to Asset Plan
                </Button>
              </div>
            </div>
          )}

          {customItems.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {customItems.map((ci) => {
                const prodJob = savedId
                  ? opsState.fabricationJobs.find(
                      (j) => j.eventId === savedId && j.customItemId === ci.id,
                    )
                  : undefined
                return (
                  <li key={ci.id} className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <Visual
                          src={ci.referenceImages?.[0] || "/event-manager-images/garden.jpg"}
                          label={ci.name}
                          className="size-12 shrink-0 rounded-md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{ci.name}</span>
                            <Badge tone="info">
                              {readOnly ? `Approved qty: ${ci.quantity}` : `Qty: ${ci.quantity}`}
                            </Badge>
                            {prodJob && (
                              <Badge
                                tone={
                                  prodJob.status === "Ready to Load"
                                    ? "success"
                                    : prodJob.status === "Needs Correction"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                Warehouse job: {prodJob.status}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1.5 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <span>
                              <strong className="text-foreground">Dimensions:</strong> {ci.dimensions}
                            </span>
                            <span>
                              <strong className="text-foreground">Materials:</strong> {ci.materials}
                            </span>
                            <span>
                              <strong className="text-foreground">Colors:</strong> {ci.colors}
                            </span>
                            <span>
                              <strong className="text-foreground">Finish:</strong> {ci.finish}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            <strong className="text-foreground">Build instructions:</strong>{" "}
                            {ci.instructions}
                          </p>
                        </div>
                      </div>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          icon={X}
                          onClick={() =>
                            setCustomItems(customItems.filter((item) => item.id !== ci.id))
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No custom fabrication items registered for this event yet.
            </p>
          )}
        </section>

        <section className="em-panel em-step-panel">
          <StepHead
            eyebrow="The extras"
            title="Rentals & technical services"
            description="Record rental suppliers, requested quantities, and view Warehouse supplier confirmation status."
          />
          {!readOnly && (
            <>
              <div className="em-pick-row items-end">
                <div className="relative min-w-0 basis-64 flex-1">
                  <SearchableDropdown
                    aria-label="Choose a rental supplier"
                    value={rental}
                    onChange={(value) => { setRental(value); setRentalError("") }}
                    placeholder="Choose a rental supplier."
                    searchPlaceholder="Search company name or supplier type…"
                    emptyMessage="No matching suppliers."
                    options={rentalCatalogOptions().filter((option) => !isSupplierAdded(brief.rentals, option.value))}
                    className={cx(fieldCls, "appearance-none pr-9 text-left")}
                  />
                  <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Button type="button" variant="outline" icon={Plus} disabled={!rental || isSupplierAdded(brief.rentals, rental)} onClick={() => {
                  try {
                    setRentals(addEventSupplier(brief.rentals, rental))
                    setRental("")
                    setRentalError("")
                  } catch (error) {
                    setRentalError(error instanceof Error ? error.message : "The supplier could not be added.")
                  }
                }}>Add supplier</Button>
              </div>
              <FieldError id="em-rental-error" text={rentalError} />
            </>
          )}
          {brief.rentals.length > 0 ? (
            <ul className="em-rentals">
              {brief.rentals.map((r) => {
                const whRental = warehouseOrder?.rentals.find(
                  (wr) => wr.id === r.id || (r.vendorId && wr.vendorId === r.vendorId),
                )
                return (
                  <RentalEntry
                    key={r.id}
                    entry={r}
                    readOnly={readOnly}
                    warehouseRental={whRental}
                    onChange={(patch) => patchRental(r.id, patch)}
                    onRemove={() => setRentals(brief.rentals.filter((entry) => entry.id !== r.id))}
                  />
                )
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No rental suppliers discussed yet.
            </p>
          )}
        </section>
      </div>

      <aside className="em-step-aside">
        <div className="em-aside-card em-crew">
          <Users size={20} strokeWidth={1.5} aria-hidden />
          <p className="em-eyebrow mt-5">People behind the moment</p>
          <p className="em-aside-card-title em-aside-card-title--lg">
            A little help bringing it to life.
          </p>
          <p className="em-crew-range tabular-nums">
            {crew[0] === crew[1] ? crew[0] : `${crew[0]}–${crew[1]}`}
          </p>
          <p className="em-crew-label">estimated personnel</p>
          <p className="em-aside-card-meta">
            For {pax} guests
            {day ? ` on ${displayDate(brief.start)}` : ", date to be decided"}.
          </p>
          <hr className="em-crew-rule" />
          <p className="em-aside-card-meta">
            {sameDay === null
              ? "Add a date to see other approved events that day."
              : sameDay === 0
                ? "No other approved events on this date in your studio."
                : `${sameDay} other approved ${sameDay === 1 ? "event" : "events"} on this date in your studio.`}
          </p>
          <p className="em-aside-card-meta mt-4">
            Planning assumption: 1 person per 15–25 guests, minimum 2. Setup,
            venue and technical needs may change this range. This Site has no
            live crew roster and does not assign staff.
          </p>
        </div>
      </aside>
      <Modal open={!!requestPrompt} onClose={() => setRequestPrompt(null)} title="Request replenishment" compact>
        <p className="text-sm text-muted-foreground">
          {requestPrompt && assets.find((a) => a.id === requestPrompt.id)?.name}:{" "}
          {requestPrompt?.shortage
            ? `${requestPrompt.quantity} requested (${requestPrompt.available} available, short by ${requestPrompt.shortage}).`
            : `${requestPrompt?.quantity} requested, leaving ${requestPrompt ? requestPrompt.available - requestPrompt.quantity : 0} available (at or below the configured threshold of ${requestPrompt ? stockThreshold(assets.find((a) => a.id === requestPrompt.id)?.stock ?? 0) : 0} pieces).`}{" "}
          Confirming saves a replenishment request linked to this event and asset for Warehouse Ops → Replenishment. Available stock does not increase.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { setRequestPrompt(null); requestAnimationFrame(() => setLocalPickerRequest((n) => n + 1)) }}>Choose alternatives</Button>
          <Button type="button" onClick={() => { if (!requestPrompt) return; setQty(requestPrompt.id, requestPrompt.quantity, true); setRequestPrompt(null) }}>Confirm request</Button>
        </div>
      </Modal>
    </div>
  )
}

export default AssetStep

