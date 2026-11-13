import { useRef, useState, type FormEvent } from "react"
import {
  ChevronDown,
  ImagePlus,
  LayoutGrid,
  List,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { fieldCls } from "../../../components/admin/AdminKit"
import Modal from "../../../components/overlay/Modal"
import Dropdown from "../../../components/ui/Dropdown"
import SearchableDropdown from "../../../components/ui/SearchableDropdown"
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  cx,
} from "../../../components/ui/ui"
import { coverFromFile } from "../../event-manager/mood-board/theme-boards"
import { rentalCatalogOptions } from "../../event-manager/rentals/rental-catalog"
import {
  FALLBACK_COVER,
  FieldError,
  Visual,
  textareaCls,
} from "../../event-manager/shared"
import {
  createAcquisitionOrder,
  createWarehouseInventoryItem,
  useOperationsStore,
  validateWarehouseInventoryItemInput,
  type OpsActor,
  type WarehouseInventoryItem,
  type WarehouseInventoryValidationErrors,
} from "../../../operations/store"
import { useNotify } from "../warehouse-shared"

const INVENTORY_CATEGORY_OPTIONS = [
  "Florals",
  "Foliage",
  "Vessels",
  "Candles",
  "Furniture",
  "Lighting",
  "Structure",
  "Decor",
  "Tabletop",
  "Linens",
]

type NewItemDraft = {
  image: string
  name: string
  category: string
  description: string
  height: string
  width: string
  weight: string
  material: string
  color: string
  stock: string
  primaryVendorId: string
}

const emptyDraft = (): NewItemDraft => ({
  image: "",
  name: "",
  category: "",
  description: "",
  height: "",
  width: "",
  weight: "",
  material: "",
  color: "",
  stock: "",
  primaryVendorId: "",
})

async function readUploadedPhoto(file: File): Promise<string> {
  if (typeof createImageBitmap === "function") {
    return coverFromFile(file)
  }
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Use a PNG, JPEG or WebP image.")
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("The maximum original size is 15 MB.")
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("This image could not be read."))
    }
    reader.onerror = () => reject(new Error("This image could not be read."))
    reader.readAsDataURL(file)
  })
}

export default function AssetInventoryModule({
  actor,
}: {
  actor: OpsActor
  onNavigate: (route: string) => void
}) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [query, setQuery] = useState("")
  const [catFilter, setCatFilter] = useState("All")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [draft, setDraft] = useState<NewItemDraft>(emptyDraft)
  const [errors, setErrors] = useState<WarehouseInventoryValidationErrors>({})
  const [photoBusy, setPhotoBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supplierOptions = rentalCatalogOptions()
  const categories = [
    "All",
    ...Array.from(new Set(state.inventory.map((i) => i.category))),
  ]
  const modalCategories = Array.from(
    new Set([
      ...INVENTORY_CATEGORY_OPTIONS,
      ...state.inventory.map((i) => i.category),
    ]),
  )

  const filtered = state.inventory.filter((item) => {
    if (catFilter !== "All" && item.category !== catFilter) return false
    if (
      query.trim() &&
      !`${item.name} ${item.assetCode} ${item.category} ${item.zone} ${item.material ?? ""} ${item.color ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    )
      return false
    return true
  })

  const handleQuickReplenish = (item: WarehouseInventoryItem) => {
    const res = createAcquisitionOrder({
      assetId: item.assetId,
      supplierName: "Lumière Preferred Supply Partner",
      quantity: 20,
      unitCost: 1200,
      actorName: actor.name,
      receiveImmediately: true,
    })
    if (res.ok) {
      notify(`Received +20 ${item.name} into available stock.`)
    }
  }

  const openAddModal = () => {
    setErrors({})
    setAddModalOpen(true)
  }

  const closeAddModal = () => {
    if (submittingRef.current) return
    setAddModalOpen(false)
  }

  const updateField = <K extends keyof NewItemDraft>(
    key: K,
    value: NewItemDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as keyof WarehouseInventoryValidationErrors]
        return next
      })
    }
  }

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return
    setPhotoBusy(true)
    setErrors((prev) => ({ ...prev, image: undefined }))
    try {
      const dataUrl = await readUploadedPhoto(file)
      setDraft((prev) => ({ ...prev, image: dataUrl }))
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        image:
          err instanceof Error ? err.message : "This image could not be read.",
      }))
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleCreateItem = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submittingRef.current || photoBusy) return

    const check = validateWarehouseInventoryItemInput({
      name: draft.name,
      category: draft.category,
      description: draft.description,
      height: draft.height,
      width: draft.width,
      weight: draft.weight,
      material: draft.material,
      color: draft.color,
      stock: draft.stock,
      primaryVendorId: draft.primaryVendorId,
      image: draft.image || undefined,
    })

    if (!check.parsed) {
      setErrors(check.errors)
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      const res = createWarehouseInventoryItem({
        name: draft.name,
        category: draft.category,
        description: draft.description,
        height: draft.height,
        width: draft.width,
        weight: draft.weight,
        material: draft.material,
        color: draft.color,
        stock: draft.stock,
        primaryVendorId: draft.primaryVendorId,
        image: draft.image || undefined,
      })

      if (!res.ok) {
        setErrors(res.errors)
        return
      }

      setDraft(emptyDraft())
      setErrors({})
      setAddModalOpen(false)
      notify(`Added ${res.item.name} (${res.item.assetCode}) to inventory.`)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Warehouse Operations Manager", "Asset Inventory"]}
        title="Asset Inventory"
        subtitle="Review available, allocated, and dispatched stock."
        actions={
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            <div
              role="group"
              aria-label="Inventory view"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-card p-1"
            >
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                className={cx(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors",
                  viewMode === "grid"
                    ? "bg-invert text-invert-fg"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid size={14} aria-hidden />
                Grid
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={cx(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors",
                  viewMode === "list"
                    ? "bg-invert text-invert-fg"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List size={14} aria-hidden />
                List
              </button>
            </div>
            <Button type="button" icon={Plus} onClick={openAddModal}>
              Add item
            </Button>
          </div>
        }
      />

      <div className="em-toolbar">
        <div role="group" aria-label="Category" className="em-chips">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={catFilter === cat}
              className="em-chip"
              onClick={() => setCatFilter(cat)}
            >
              {cat === "All" ? "All categories" : cat}
            </button>
          ))}
        </div>
        <label className="em-search">
          <Search size={15} strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Search assets</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted-foreground">
          No matching inventory items.
        </div>
      ) : viewMode === "grid" ? (
        <ul
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          aria-label="Warehouse asset inventory"
        >
          {filtered.map((item) => {
            const isLow = item.availableStock <= item.reorderThreshold
            const isCutout = item.image.includes("/cutouts/")
            const freeRatio =
              item.totalStock > 0
                ? Math.min(
                    100,
                    Math.max(0, (item.availableStock / item.totalStock) * 100),
                  )
                : 0
            return (
              <li key={item.assetId} className="em-asset-card">
                <div className="relative">
                  <Visual
                    src={item.image}
                    fallbackSrc={FALLBACK_COVER}
                    label={item.name}
                    icon={PackageOpen}
                    className={cx(
                      "em-asset-card-media em-product",
                      isCutout && "em-product--cutout",
                    )}
                  />
                  {isLow && (
                    <div className="absolute right-3 top-3">
                      <Badge tone="warning">Low Stock</Badge>
                    </div>
                  )}
                </div>
                <div className="em-pitch-card-body">
                  <div className="flex items-center justify-between gap-2">
                    <p className="em-eyebrow">{item.category}</p>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {item.assetCode}
                    </span>
                  </div>
                  <p className="em-card-title mt-1.5">{item.name}</p>
                  <dl className="em-asset-stats">
                    <div>
                      <dt>Available / Total</dt>
                      <dd>
                        {item.availableStock} / {item.totalStock} {item.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Allocated · Dispatched</dt>
                      <dd>
                        {item.allocatedStock} · {item.dispatchedStock}
                      </dd>
                    </div>
                  </dl>
                  <div
                    className="em-meter"
                    role="img"
                    aria-label={`${item.availableStock} of ${item.totalStock} available`}
                  >
                    <span style={{ width: `${freeRatio}%` }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Card className="mt-5 p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">Asset</th>
                  <th className="py-3 pr-4">Warehouse Zone</th>
                  <th className="py-3 pr-4">Total Stock</th>
                  <th className="py-3 pr-4">Available</th>
                  <th className="py-3 pr-4">Allocated</th>
                  <th className="py-3 pr-4">Dispatched</th>
                  <th className="py-3 pr-4">Damaged / Missing</th>
                  <th className="py-3 text-right">Quick Replenish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item) => {
                  const isLow = item.availableStock <= item.reorderThreshold
                  return (
                    <tr key={item.assetId} className="hover:bg-fg/[0.02]">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Visual
                            src={item.image}
                            label={item.name}
                            className="size-10 shrink-0 rounded-md"
                          />
                          <div>
                            <div className="font-semibold text-foreground">
                              {item.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.assetCode} · {item.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {item.zone}
                      </td>
                      <td className="py-3 pr-4 font-semibold tabular-nums">
                        {item.totalStock}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        <span className="mr-2 font-semibold">
                          {item.availableStock}
                        </span>
                        {isLow && <Badge tone="warning">Low Stock</Badge>}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        {item.allocatedStock}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        {item.dispatchedStock}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-xs">
                        {item.damagedCount > 0 || item.missingCount > 0 ? (
                          <Badge tone="danger">
                            {item.damagedCount} dmg · {item.missingCount} mis
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickReplenish(item)}
                        >
                          +20 Stock
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={addModalOpen}
        onClose={closeAddModal}
        title="Add New Item"
        panelClassName="max-w-2xl !p-0 flex flex-col !overflow-hidden [&>div:first-child]:px-6 [&>div:first-child]:pt-5 [&>div:first-child]:pb-4 [&>div:first-child]:!mb-0 [&>div:first-child]:border-b [&>div:first-child]:border-line [&>div:first-child]:shrink-0"
      >
        <form
          onSubmit={handleCreateItem}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <span className="mb-2 block text-[14px] font-semibold text-foreground">
                  Photo
                </span>
                <div className="space-y-2.5">
                  <Visual
                    src={draft.image || undefined}
                    label={
                      draft.image
                        ? `${draft.name || "New item"} preview`
                        : "Item photo preview"
                    }
                    icon={ImagePlus}
                    className="aspect-4/3 w-full rounded-xl border border-line bg-elev"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      icon={photoBusy ? Loader2 : ImagePlus}
                      disabled={photoBusy || submitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 px-3 text-xs"
                    >
                      {photoBusy
                        ? "Uploading…"
                        : draft.image
                          ? "Change photo"
                          : "Upload photo"}
                    </Button>
                    {draft.image && (
                      <Button
                        type="button"
                        variant="ghost"
                        icon={Trash2}
                        disabled={photoBusy || submitting}
                        onClick={() => updateField("image", "")}
                        className="h-8 px-2.5 text-xs"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Upload item photo"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      void handlePhotoUpload(file)
                    }}
                  />
                  <FieldError id="inv-err-image" text={errors.image} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Field label="Item Name">
                    <Input
                      id="inv-item-name"
                      value={draft.name}
                      maxLength={120}
                      placeholder="e.g. Fluted Glass Hurricane Vase"
                      aria-invalid={!!errors.name || undefined}
                      aria-describedby={errors.name ? "inv-err-name" : undefined}
                      className={cx(errors.name && "border-red-400")}
                      onChange={(e) => updateField("name", e.target.value)}
                    />
                  </Field>
                  <FieldError id="inv-err-name" text={errors.name} />
                </div>

                <div>
                  <Field label="Category">
                    <div className="relative">
                      <Dropdown
                        id="inv-item-category"
                        aria-label="Category"
                        value={draft.category}
                        aria-invalid={!!errors.category || undefined}
                        aria-describedby={
                          errors.category ? "inv-err-category" : undefined
                        }
                        onChange={(e) => updateField("category", e.target.value)}
                        className={cx(
                          fieldCls,
                          "appearance-none pr-9",
                          errors.category && "border-red-400",
                        )}
                      >
                        <option value="">Select category</option>
                        {modalCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Dropdown>
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                    </div>
                  </Field>
                  <FieldError id="inv-err-category" text={errors.category} />
                </div>
              </div>
            </div>

            <div>
              <Field label="Description">
                <textarea
                  id="inv-item-description"
                  rows={3}
                  value={draft.description}
                  placeholder="Describe styling notes, condition details, or handling guidance…"
                  className={textareaCls}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Field label="Height">
                  <Input
                    id="inv-item-height"
                    type="number"
                    min={0}
                    step="any"
                    value={draft.height}
                    placeholder="0"
                    aria-invalid={!!errors.height || undefined}
                    aria-describedby={
                      errors.height ? "inv-err-height" : undefined
                    }
                    className={cx(errors.height && "border-red-400")}
                    onChange={(e) => updateField("height", e.target.value)}
                  />
                </Field>
                <FieldError id="inv-err-height" text={errors.height} />
              </div>

              <div>
                <Field label="Width">
                  <Input
                    id="inv-item-width"
                    type="number"
                    min={0}
                    step="any"
                    value={draft.width}
                    placeholder="0"
                    aria-invalid={!!errors.width || undefined}
                    aria-describedby={errors.width ? "inv-err-width" : undefined}
                    className={cx(errors.width && "border-red-400")}
                    onChange={(e) => updateField("width", e.target.value)}
                  />
                </Field>
                <FieldError id="inv-err-width" text={errors.width} />
              </div>

              <div>
                <Field label="Weight">
                  <Input
                    id="inv-item-weight"
                    type="number"
                    min={0}
                    step="any"
                    value={draft.weight}
                    placeholder="0"
                    aria-invalid={!!errors.weight || undefined}
                    aria-describedby={
                      errors.weight ? "inv-err-weight" : undefined
                    }
                    className={cx(errors.weight && "border-red-400")}
                    onChange={(e) => updateField("weight", e.target.value)}
                  />
                </Field>
                <FieldError id="inv-err-weight" text={errors.weight} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Material">
                  <Input
                    id="inv-item-material"
                    value={draft.material}
                    placeholder="e.g. Hand-blown glass, brushed brass"
                    onChange={(e) => updateField("material", e.target.value)}
                  />
                </Field>
              </div>

              <div>
                <Field label="Color">
                  <Input
                    id="inv-item-color"
                    value={draft.color}
                    placeholder="e.g. Warm Champagne Gold"
                    onChange={(e) => updateField("color", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Stock">
                  <Input
                    id="inv-item-stock"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.stock}
                    placeholder="0"
                    aria-invalid={!!errors.stock || undefined}
                    aria-describedby={errors.stock ? "inv-err-stock" : undefined}
                    className={cx(errors.stock && "border-red-400")}
                    onChange={(e) => updateField("stock", e.target.value)}
                  />
                </Field>
                <FieldError id="inv-err-stock" text={errors.stock} />
              </div>

              <div>
                <span className="mb-2 block text-[14px] font-semibold text-foreground">
                  Primary Vendor
                </span>
                <div className="relative">
                  <SearchableDropdown
                    aria-label="Primary Vendor"
                    value={draft.primaryVendorId}
                    onChange={(value) => updateField("primaryVendorId", value)}
                    options={supplierOptions}
                    placeholder="Select primary vendor"
                    searchPlaceholder="Search supplier name or type..."
                    emptyMessage="No matching suppliers."
                    className={cx(
                      fieldCls,
                      "appearance-none pr-9 text-left",
                      errors.primaryVendorId && "border-red-400",
                    )}
                  />
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
                <FieldError id="inv-err-vendor" text={errors.primaryVendorId} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line bg-card px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={closeAddModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || photoBusy}
            >
              {submitting ? "Saving…" : "Save Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
