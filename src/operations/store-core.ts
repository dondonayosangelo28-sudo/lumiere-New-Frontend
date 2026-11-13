import { useEffect, useState } from "react"
import { accountName, getState, subscribe } from "../auth/store"
import {
  assets as catalogAssets,
  syncCatalogAssetsFromInventory,
  type Brief,
  type Project,
} from "../features/event-manager/model"
import { rentalVendors } from "../features/event-manager/rentals/rental-catalog"
import { oldSystemApis, v51ContractApis } from "./apiClients"
import type {
  AcquisitionOrder,
  AfterShiftPhoto,
  CheckpointName,
  CrewTaskStatus,
  CustomFabricationSpec,
  DeficitQueueEntry,
  EventRentalRecord,
  FabricationJob,
  FieldIncidentReport,
  IssueResolutionType,
  ManifestLineItem,
  OperationsStoreState,
  RentalELetter,
  RentalSupplierAcceptance,
  StockAllocationLine,
  WarehouseInventoryItem,
  WarehouseOrderRequest,
} from "./types"

export const OPERATIONS_STORAGE_KEY = "lumiere.operations.store.v51"
export const OPERATIONS_EVENT = "lumiere:operations-store-updated"
export const WAREHOUSE_SELECTED_EVENT_KEY = "lumiere.warehouse.selectedEventId"

export function setWarehouseSelectedEventId(eventId: string) {
  if (typeof window !== "undefined") {
    if (eventId) {
      window.sessionStorage.setItem(WAREHOUSE_SELECTED_EVENT_KEY, eventId)
    } else {
      window.sessionStorage.removeItem(WAREHOUSE_SELECTED_EVENT_KEY)
    }
  }
}

export function getWarehouseSelectedEventId(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(WAREHOUSE_SELECTED_EVENT_KEY)
}

export type OpsActor = {
  email: string
  name: string
  role: string
}

const ZONES = [
  "Zone A — Seating & Tables",
  "Zone B — Structures & Backdrop",
  "Zone C — Lighting & Rigging",
  "Zone D — Tabletop & Decor",
]

export function zoneForInventoryCategory(category: string): string {
  const normalized = category.trim().toLowerCase()
  if (normalized === "furniture" || normalized === "seating" || normalized === "tables") {
    return ZONES[0]
  }
  if (normalized === "structure" || normalized === "structures" || normalized === "backdrop") {
    return ZONES[1]
  }
  if (normalized === "lighting" || normalized === "rigging" || normalized === "audio / visual") {
    return ZONES[2]
  }
  return ZONES[3]
}

function buildSeedInventory(): WarehouseInventoryItem[] {
  return catalogAssets.slice(0, 23).map((item, index) => {
    const isSeating = item.category === "Furniture"
    const totalStock = isSeating ? 160 : item.category === "Decor" ? 60 : 28
    const allocatedStock = item.id === "evtast-0001" ? 12 : item.id === "evtast-0010" ? 24 : item.id === "evtast-0018" ? 1 : 0
    return {
      assetId: item.id,
      assetCode: `AST-${String(index + 1).padStart(4, "0")}`,
      name: item.name,
      category: item.category,
      zone: ZONES[index % ZONES.length],
      unit: item.unit,
      image: item.image,
      totalStock,
      availableStock: totalStock - allocatedStock,
      allocatedStock,
      dispatchedStock: 0,
      damagedCount: 0,
      missingCount: 0,
      reorderThreshold: isSeating ? 30 : 8,
    }
  })
}

function buildInitialOperationsStore(): OperationsStoreState {
  const inventory = buildSeedInventory()
  const findCatalog = (id: string) => catalogAssets.find((a) => a.id === id)
  const chandelier = findCatalog("evtast-0001")
  const chair = findCatalog("evtast-0010")
  const arch = findCatalog("evtast-0018")

  const seedEventId = "evt-celeste-marcos"
  const seedEventTitle = "Celeste & Marcos Garden Reception"

  const customSpec1: CustomFabricationSpec = {
    id: "cust-celeste-monogram-arch",
    name: "Bespoke Brass & Travertine Monogram Plinth Pair",
    requestedQty: 2,
    dimensions: "2.4m H × 0.9m W × 0.6m D",
    materials: "Brushed brass framing, honed travertine panels, weighted steel baseplate",
    colors: "Warm Champagne Gold (#C8A96A) & Ivory Travertine (#F3EFE6)",
    finish: "Satin matte lacquer with weather-sealed seams",
    buildInstructions:
      "Weld internal steel baseplate for wind stability at Glasshouse Lawn. Mount laser-cut C&M monogram at 1.65m eye level and conceal warm LED uplight channel in base.",
    referenceImages: ["/event-manager-images/garden.jpg"],
  }

  const seedOrder: WarehouseOrderRequest = {
    id: "ORD-2026-0101",
    eventId: seedEventId,
    eventTitle: seedEventTitle,
    clientName: "Celeste Villanueva",
    clientEmail: "celeste.villanueva@velvetatelier.ph",
    venue: "The Glasshouse at Fernbrook, Alabang",
    startDateTime: "2026-04-25T16:00",
    endDateTime: "2026-04-25T23:00",
    theme: "Glasshouse Botanical",
    pax: 180,
    approvalNote:
      "Approved by Celeste Villanueva after live presentation; reserve arch, crystal chandeliers, and chairs.",
    approvedByName: "Event Manager",
    approvedByEmail: "eventmanager@demo.com",
    approvedAt: "2026-04-12T18:10:00.000Z",
    revisionAtApproval: 3,
    stockLines: [
      {
        assetId: "evtast-0001",
        assetCode: "AST-0001",
        name: chandelier?.name ?? "Empire Crystal Chandelier",
        category: chandelier?.category ?? "Lighting",
        image: chandelier?.image ?? "/event-assets/evtast-0001.png",
        unit: chandelier?.unit ?? "piece",
        approvedRequestedQty: 12,
        allocatedQty: 12,
        deficitQty: 0,
        releasedForLoadQty: 12,
        loadedQty: 12,
        loadingVerified: true,
        returnedQty: 12,
      },
      {
        assetId: "evtast-0010",
        assetCode: "AST-0010",
        name: chair?.name ?? "Gold Chiavari Dining Chair",
        category: chair?.category ?? "Furniture",
        image: chair?.image ?? "/event-assets/evtast-0010.png",
        unit: chair?.unit ?? "chair",
        approvedRequestedQty: 24,
        allocatedQty: 24,
        deficitQty: 0,
        releasedForLoadQty: 24,
        loadedQty: 24,
        loadingVerified: true,
        returnedQty: 24,
      },
      {
        assetId: "evtast-0018",
        assetCode: "AST-0018",
        name: arch?.name ?? "White Lattice Ceremony Arch",
        category: arch?.category ?? "Structure",
        image: arch?.image ?? "/event-assets/evtast-0018.png",
        unit: arch?.unit ?? "set",
        approvedRequestedQty: 1,
        allocatedQty: 1,
        deficitQty: 0,
        releasedForLoadQty: 1,
        loadedQty: 1,
        loadingVerified: true,
        returnedQty: 1,
      },
    ],
    customSpecs: [customSpec1],
      rentals: [
      {
        id: "rnt-celeste-1",
        eventId: seedEventId,
        vendorId: "sample-lighting",
        vendorName: "Sinag Stage Lighting",
        category: "Lighting supplier",
        itemName: "Low-profile aluminum box truss & warm architectural wash package (12m span)",
        contact: "ops@sinaglighting.ph · +63 917 555 0141",
        ApprovedRequestedQty: 4,
        directToVenue: true,
        notes: "Confirm low-profile chain hoist clearance with Fernbrook engineering before load-in.",
        bookingReference: "SNG-2026-8841",
        confirmationStatus: "Pending Confirmation",
        eLetter: {
          supplierName: "Sinag Stage Lighting",
          supplierContact: "ops@sinaglighting.ph · +63 917 555 0141",
          eventTitle: seedEventTitle,
          eventDates: "Apr 25, 2026, 4:00 PM – 11:00 PM",
          venue: "The Glasshouse at Fernbrook, Alabang",
          itemsSummary: "Low-profile aluminum box truss & warm architectural wash package (12m span)",
          quantity: 4,
          deliveryLocation: "Direct-to-Venue — Fernbrook Service Gate B, Alabang",
          deliveryArrangements: "Supplier delivers directly to venue by 09:00 AM on Apr 25, 2026; Ground Crew Team Lead verifies receipt at Venue Arrival.",
          returnArrangements: "Supplier strike pickup at venue at 11:45 PM after event; Team Lead verifies handback count and condition.",
          preparedByEmail: "warehouseops@demo.com",
          preparedByName: "Warehouse Operations Manager",
          preparedAt: "2026-04-13T09:30:00.000Z",
        },
      },
    ],
    crewAssignments: [
      {
        id: "asg-celeste-crew-1",
        eventId: seedEventId,
        crewEmail: "crew@demo.com",
        crewName: "Ground Crew",
        schedule: "Apr 25, 2026 · 07:00 AM – 11:59 PM",
        duties: "Lead dispatch loading verification, venue arrival inspection, direct-to-venue truss receipt check, and post-event return audit.",
        shiftLabel: "Shift 1 — Fabrication & Ingress Prep",
        taskStatus: "InProgress",
        startedAt: "2026-04-13T08:00:00.000Z",
        updatedAt: "2026-04-13T10:15:00.000Z",
      },
    ],
    teamLeadEmail: "crew@demo.com",
    teamLeadName: "Ground Crew",
    teamLeadHistory: [
      {
        id: "tlh-celeste-1",
        newLeadEmail: "crew@demo.com",
        newLeadName: "Ground Crew",
        changedByEmail: "warehouseops@demo.com",
        changedByName: "Warehouse Operations Manager",
        changedAt: "2026-04-13T08:00:00.000Z",
        reason: "Initial Team Lead designation for Celeste & Marcos Garden Reception.",
      },
    ],
    manifestPrepared: true,
    manifestPreparedAt: "2026-04-13T11:00:00.000Z",
    manifestPreparedBy: "Warehouse Operations Manager",
    warehouseClosed: false,
    isPreviewSeed: true,
  }

  const seedPhoto: AfterShiftPhoto = {
    id: "asp-celeste-1",
    eventId: seedEventId,
    eventTitle: seedEventTitle,
    shiftLabel: "Shift 1 — Fabrication Workshop",
    photoUrl: "/event-manager-images/garden.jpg",
    caption: "Completed brass & travertine monogram plinth pair assembly; LED channels tested and satin seal applied.",
    isFabricationWork: true,
    fabricationJobId: "fab-celeste-1",
    submittedByEmail: "crew@demo.com",
    submittedByName: "Ground Crew",
    submittedAt: "2026-04-13T17:30:00.000Z",
  }

  const seedFabJob: FabricationJob = {
    id: "fab-celeste-1",
    eventId: seedEventId,
    eventTitle: seedEventTitle,
    customItemId: customSpec1.id,
    spec: customSpec1,
    status: "Awaiting Verification",
    assignedCrewEmails: ["crew@demo.com"],
    progressPercent: 100,
    completedQty: 2,
    materialsVerified: true,
    linkedShiftPhotoIds: [seedPhoto.id],
    releasedForLoading: false,
    updatedAt: "2026-04-13T17:30:00.000Z",
  }

  return {
    version: 1,
    inventory,
    orderRequests: [seedOrder],
    fabricationJobs: [seedFabJob],
    afterShiftPhotos: [seedPhoto],
    incidentReports: [],
    deficitQueue: [],
    acquisitions: [],
  }
}

export function readOperationsStore(): OperationsStoreState {
  if (typeof window === "undefined") {
    const initial = buildInitialOperationsStore()
    syncCatalogAssetsFromInventory(initial.inventory)
    return initial
  }
  try {
    const raw = window.localStorage.getItem(OPERATIONS_STORAGE_KEY)
    if (!raw) {
      const seeded = buildInitialOperationsStore()
      window.localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(seeded))
      syncCatalogAssetsFromInventory(seeded.inventory)
      return seeded
    }
    const parsed = JSON.parse(raw) as OperationsStoreState
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.orderRequests)) {
      const seeded = buildInitialOperationsStore()
      window.localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(seeded))
      syncCatalogAssetsFromInventory(seeded.inventory)
      return seeded
    }
    syncCatalogAssetsFromInventory(parsed.inventory)
    return parsed
  } catch {
    const fallback = buildInitialOperationsStore()
    syncCatalogAssetsFromInventory(fallback.inventory)
    return fallback
  }
}

export function writeOperationsStore(next: OperationsStoreState): OperationsStoreState {
  syncCatalogAssetsFromInventory(next.inventory)
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(OPERATIONS_EVENT))
  }
  return next
}

export function mutateOperationsStore<T>(
  mutator: (draft: OperationsStoreState) => T,
): T {
  const current = readOperationsStore()
  const clone = JSON.parse(JSON.stringify(current)) as OperationsStoreState
  const result = mutator(clone)
  writeOperationsStore(clone)
  return result
}

export function useOperationsStore(): OperationsStoreState {
  const [state, setState] = useState<OperationsStoreState>(() => readOperationsStore())

  useEffect(() => {
    const sync = () => setState(readOperationsStore())
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === OPERATIONS_STORAGE_KEY || e.key === "lumiere.demo.store") {
        sync()
      }
    }
    window.addEventListener(OPERATIONS_EVENT, sync)
    window.addEventListener("storage", onStorage)
    const unsubAuth = subscribe(sync)
    return () => {
      window.removeEventListener(OPERATIONS_EVENT, sync)
      window.removeEventListener("storage", onStorage)
      unsubAuth()
    }
  }, [])

  return state
}

/**
 * Returns all active Ground Crew accounts provisioned by System Admin in `src/auth/store.ts`.
 * Ensures newly created and activated Ground Crew accounts immediately appear in Personnel Deployment.
 */
export function getAvailableGroundCrewAccounts(): {
  id: string
  name: string
  email: string
  status: string
}[] {
  const authStore = getState()
  return authStore.accounts
    .filter((u) => u.role === "Ground Crew" && !u.deletedAt && u.status === "Active")
    .map((u) => ({
      id: String(u.id),
      name: accountName(u),
      email: u.email.toLowerCase(),
      status: u.status,
    }))
}

/**
 * Computes the authoritative Dispatch Manifest lines for an event:
 * - Stock items where `releasedForLoadQty > 0`
 * - Custom fabrication items that have passed verification (`status === "Ready to Load"` and `releasedForLoading === true`)
 */
export function getEventManifestLines(
  state: OperationsStoreState,
  eventId: string,
): ManifestLineItem[] {
  const order = state.orderRequests.find((o) => o.eventId === eventId)
  if (!order) return []

  const lines: ManifestLineItem[] = []

  for (const stock of order.stockLines) {
    if (stock.category === "Custom Fabrication") continue
    const planned = stock.releasedForLoadQty > 0 ? stock.releasedForLoadQty : stock.allocatedQty
    if (planned > 0) {
      lines.push({
        lineId: `stk-${stock.assetId}`,
        sourceType: "stock",
        sourceId: stock.assetId,
        code: stock.assetCode,
        name: stock.name,
        category: stock.category,
        unit: stock.unit,
        plannedQty: planned,
        loadedQty: stock.loadedQty,
        returnedQty: stock.returnedQty,
        shortfallQty: Math.max(0, planned - stock.loadedQty),
        loadingNotes: stock.notes,
      })
    }
  }

  const jobs = state.fabricationJobs.filter(
    (j) => j.eventId === eventId && j.status === "Ready to Load" && j.releasedForLoading,
  )
  for (const job of jobs) {
    const existingCustomLine = order.stockLines.find((s) => s.assetId === job.customItemId)
    const planned = job.spec.requestedQty
    const loaded = existingCustomLine ? existingCustomLine.loadedQty : planned
    const returned = existingCustomLine ? existingCustomLine.returnedQty : loaded
    lines.push({
      lineId: `fab-${job.id}`,
      sourceType: "custom",
      sourceId: job.customItemId,
      code: `FAB-${job.id.slice(-4).toUpperCase()}`,
      name: `${job.spec.name} (Custom Fabrication)`,
      category: "Custom Fabrication",
      unit: "unit",
      plannedQty: planned,
      loadedQty: loaded,
      returnedQty: returned,
      shortfallQty: Math.max(0, planned - loaded),
      loadingNotes: `Dimensions: ${job.spec.dimensions}`,
    })
  }

  return lines
}
