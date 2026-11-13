import { rentalVendors } from "../features/event-manager/rentals/rental-catalog"
import type { AcquisitionOrder, WarehouseInventoryItem } from "./types"
import { mutateOperationsStore, zoneForInventoryCategory } from "./store-core"

export type WarehouseInventoryItemInput = {
  name: string
  category: string
  description?: string
  height?: string | number
  width?: string | number
  weight?: string | number
  material?: string
  color?: string
  stock: string | number
  primaryVendorId?: string
  image?: string
}

export type WarehouseInventoryValidationErrors = Partial<
  Record<
    "name" | "category" | "stock" | "height" | "width" | "weight" | "primaryVendorId" | "image",
    string
  >
>

function parseOptionalNonNegativeNumber(
  raw: string | number | undefined,
  label: string,
): { value?: number; error?: string } {
  if (raw === undefined || raw === null) return {}
  const trimmed = String(raw).trim()
  if (trimmed === "") return {}
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) {
    return { error: `${label} must be 0 or greater.` }
  }
  return { value: num }
}

export function validateWarehouseInventoryItemInput(
  payload: WarehouseInventoryItemInput,
): {
  errors: WarehouseInventoryValidationErrors
  parsed?: {
    name: string
    category: string
    description?: string
    height?: number
    width?: number
    weight?: number
    material?: string
    color?: string
    stock: number
    primaryVendorId?: string
    image: string
  }
} {
  const errors: WarehouseInventoryValidationErrors = {}
  const name = String(payload.name ?? "").trim()
  const category = String(payload.category ?? "").trim()
  const description = String(payload.description ?? "").trim()
  const material = String(payload.material ?? "").trim()
  const color = String(payload.color ?? "").trim()
  const primaryVendorId = String(payload.primaryVendorId ?? "").trim()
  const image = String(payload.image ?? "").trim() || "/event-manager-images/planning.jpg"

  if (!name) {
    errors.name = "Enter an item name."
  } else if (name.length > 120) {
    errors.name = "Keep the item name to 120 characters or fewer."
  }

  if (!category) {
    errors.category = "Select a category."
  }

  const rawStock =
    typeof payload.stock === "number"
      ? String(payload.stock)
      : String(payload.stock ?? "").trim()
  let stock = 0
  if (rawStock === "") {
    errors.stock = "Enter a stock quantity."
  } else {
    const parsedStock = Number(rawStock)
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      errors.stock = "Stock must be 0 or greater."
    } else if (!Number.isInteger(parsedStock)) {
      errors.stock = "Stock must be a whole number."
    } else {
      stock = parsedStock
    }
  }

  const heightRes = parseOptionalNonNegativeNumber(payload.height, "Height")
  if (heightRes.error) errors.height = heightRes.error

  const widthRes = parseOptionalNonNegativeNumber(payload.width, "Width")
  if (widthRes.error) errors.width = widthRes.error

  const weightRes = parseOptionalNonNegativeNumber(payload.weight, "Weight")
  if (weightRes.error) errors.weight = weightRes.error

  if (primaryVendorId && !rentalVendors.some((v) => v.id === primaryVendorId)) {
    errors.primaryVendorId = "Choose a valid supplier from the catalog."
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  return {
    errors,
    parsed: {
      name,
      category,
      ...(description ? { description } : {}),
      ...(heightRes.value !== undefined ? { height: heightRes.value } : {}),
      ...(widthRes.value !== undefined ? { width: widthRes.value } : {}),
      ...(weightRes.value !== undefined ? { weight: weightRes.value } : {}),
      ...(material ? { material } : {}),
      ...(color ? { color } : {}),
      stock,
      ...(primaryVendorId ? { primaryVendorId } : {}),
      image,
    },
  }
}

export function createWarehouseInventoryItem(
  payload: WarehouseInventoryItemInput,
):
  | { ok: true; item: WarehouseInventoryItem }
  | { ok: false; error: string; errors: WarehouseInventoryValidationErrors } {
  const validation = validateWarehouseInventoryItemInput(payload)
  if (!validation.parsed) {
    const firstError =
      Object.values(validation.errors).find(Boolean) ?? "Check the highlighted fields."
    return { ok: false, error: firstError, errors: validation.errors }
  }

  const { parsed } = validation

  return mutateOperationsStore((draft) => {
    const maxExistingNum = draft.inventory.reduce((max, entry) => {
      const idMatch = entry.assetId.match(/(\d+)$/)
      const codeMatch = entry.assetCode.match(/(\d+)$/)
      const idNum = idMatch ? Number(idMatch[1]) : 0
      const codeNum = codeMatch ? Number(codeMatch[1]) : 0
      return Math.max(max, idNum, codeNum)
    }, 23)
    const nextNum = maxExistingNum + 1
    const assetId = `evtast-${String(nextNum).padStart(4, "0")}`
    const assetCode = `AST-${String(nextNum).padStart(4, "0")}`
    const isSeating = parsed.category === "Furniture"

    const newItem: WarehouseInventoryItem = {
      assetId,
      assetCode,
      name: parsed.name,
      category: parsed.category,
      zone: zoneForInventoryCategory(parsed.category),
      unit: "pieces",
      image: parsed.image,
      totalStock: parsed.stock,
      availableStock: parsed.stock,
      allocatedStock: 0,
      dispatchedStock: 0,
      damagedCount: 0,
      missingCount: 0,
      reorderThreshold: isSeating ? 30 : 8,
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.height !== undefined ? { height: parsed.height } : {}),
      ...(parsed.width !== undefined ? { width: parsed.width } : {}),
      ...(parsed.weight !== undefined ? { weight: parsed.weight } : {}),
      ...(parsed.material !== undefined ? { material: parsed.material } : {}),
      ...(parsed.color !== undefined ? { color: parsed.color } : {}),
      ...(parsed.primaryVendorId !== undefined
        ? { primaryVendorId: parsed.primaryVendorId }
        : {}),
    }

    draft.inventory.unshift(newItem)
    return { ok: true, item: newItem }
  })
}

/**
 * Deficit Queue & Asset Acquisition:
 * Creates an acquisition order from a deficit entry or directly for inventory replenishment,
 * and when received, adds the acquired quantity to Warehouse Inventory and fulfills the shortage.
 */
export function createAcquisitionOrder(payload: {
  deficitId?: string
  eventId?: string
  assetId: string
  supplierName: string
  quantity: number
  unitCost: number
  actorName: string
  receiveImmediately?: boolean
}): { ok: true; order: AcquisitionOrder } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const inv = draft.inventory.find((i) => i.assetId === payload.assetId)
    if (!inv) return { ok: false, error: "Inventory asset not found." }
    if (payload.quantity < 1) return { ok: false, error: "Quantity must be at least 1." }

    const deficit = payload.deficitId
      ? draft.deficitQueue.find((d) => d.id === payload.deficitId)
      : undefined

    const now = new Date().toISOString()
    const acq: AcquisitionOrder = {
      id: `ACQ-${Date.now().toString().slice(-5)}`,
      deficitId: deficit?.id,
      eventId: deficit?.eventId ?? payload.eventId,
      eventTitle: deficit?.eventTitle,
      assetId: inv.assetId,
      assetCode: inv.assetCode,
      assetName: inv.name,
      supplierName: payload.supplierName.trim() || "Lumière Preferred Supply Partner",
      quantity: payload.quantity,
      unitCost: Math.max(0, payload.unitCost),
      status: payload.receiveImmediately ? "Received & Stocked" : "Ordered",
      orderedByName: payload.actorName,
      createdAt: now,
      receivedAt: payload.receiveImmediately ? now : undefined,
    }

    draft.acquisitions.unshift(acq)

    if (deficit) {
      deficit.status = payload.receiveImmediately ? "Fulfilled" : "In Acquisition"
      if (payload.receiveImmediately) deficit.resolvedAt = now
    }

    if (payload.receiveImmediately) {
      inv.totalStock += payload.quantity
      inv.availableStock += payload.quantity
    }

    return { ok: true, order: acq }
  })
}

export function receiveAcquisitionOrder(acquisitionId: string): { ok: true } | { ok: false; error: string } {
  return mutateOperationsStore((draft) => {
    const acq = draft.acquisitions.find((a) => a.id === acquisitionId)
    if (!acq) return { ok: false, error: "Acquisition order not found." }
    if (acq.status === "Received & Stocked") return { ok: true }

    const now = new Date().toISOString()
    acq.status = "Received & Stocked"
    acq.receivedAt = now

    const inv = draft.inventory.find((i) => i.assetId === acq.assetId)
    if (inv) {
      inv.totalStock += acq.quantity
      inv.availableStock += acq.quantity
    }

    if (acq.deficitId) {
      const def = draft.deficitQueue.find((d) => d.id === acq.deficitId)
      if (def) {
        def.status = "Fulfilled"
        def.resolvedAt = now
      }
    }

    // If linked to an event with a shortage, automatically top up the allocation
    if (acq.eventId) {
      const order = draft.orderRequests.find((o) => o.eventId === acq.eventId)
      const line = order?.stockLines.find((s) => s.assetId === acq.assetId)
      if (line && line.deficitQty > 0 && inv) {
        const addAlloc = Math.min(line.deficitQty, inv.availableStock)
        line.allocatedQty += addAlloc
        line.releasedForLoadQty = line.allocatedQty
        line.deficitQty = Math.max(0, line.approvedRequestedQty - line.allocatedQty)
        inv.allocatedStock += addAlloc
        inv.availableStock = Math.max(0, inv.availableStock - addAlloc)
      }
    }

    return { ok: true }
  })
}
