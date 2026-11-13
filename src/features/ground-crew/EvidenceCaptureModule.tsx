import { useState } from "react"
import { Camera, Warehouse } from "lucide-react"
import { Badge, Button, Card, Field, Input, PageHeader } from "../../components/ui/ui"
import { Visual, fmtStamp, textareaCls } from "../event-manager/shared"
import {
  submitAfterShiftWorkPhoto,
  useOperationsStore,
  type OpsActor,
} from "../../operations/store"
import { EventSelectorHeader, SAMPLE_PHOTOS, useNotify } from "./ground-crew-shared"

export default function EvidenceCaptureModule({ actor }: { actor: OpsActor }) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [selectedEventId, setSelectedEventId] = useState(
    () => state.orderRequests[0]?.eventId ?? "",
  )
  const [shiftLabel, setShiftLabel] = useState("Shift 1 — Custom Fabrication & Ingress Prep")
  const [photoUrl, setPhotoUrl] = useState("/event-manager-images/corporate.jpg")
  const [caption, setCaption] = useState(
    "Completed fabrication and assembly per Event Manager dimensions and finish specifications.",
  )
  const [isFabrication, setIsFabrication] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState("")

  const order =
    state.orderRequests.find((o) => o.eventId === selectedEventId) ?? state.orderRequests[0]
  if (!order) return null

  const eventJobs = state.fabricationJobs.filter((j) => j.eventId === order.eventId)
  const activeJobId = selectedJobId || eventJobs[0]?.id || ""

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Ground Crew", "Evidence Capture"]}
        title="Evidence Capture"
        subtitle="Add a work photo after each shift. Link fabrication photos to the production job."
      />

      <EventSelectorHeader
        actor={actor}
        selectedEventId={order.eventId}
        onSelect={(id) => {
          setSelectedEventId(id)
          setSelectedJobId("")
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
        {/* Left: Submit After-Shift Work Photo */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-foreground">
            Submit After-Shift Work Photo
          </h3>
          <p className="text-xs text-muted-foreground">
            After-shift work photos are stored separately from Venue/Warehouse Arrival confirmation
            photos and Damage Report evidence photos.
          </p>

          <Field label="Shift Label">
            <Input
              value={shiftLabel}
              onChange={(e) => setShiftLabel(e.target.value)}
              placeholder="e.g. Shift 1 — Custom Fabrication Workshop"
            />
          </Field>

          <Field label="Work Photo URL">
            <div className="space-y-2">
              <Input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="/event-manager-images/corporate.jpg"
              />
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_PHOTOS.map((sp) => (
                  <Button
                    key={sp.url}
                    type="button"
                    variant="ghost"
                    onClick={() => setPhotoUrl(sp.url)}
                  >
                    {sp.label}
                  </Button>
                ))}
              </div>
            </div>
          </Field>

          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={isFabrication}
              onChange={(e) => setIsFabrication(e.target.checked)}
            />
            This shift involved Custom Fabrication work (link photo to production job)
          </label>

          {isFabrication && (
            <Field label="Link to Custom Fabrication Job">
              {eventJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No custom fabrication jobs on this event.
                </p>
              ) : (
                <select
                  className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
                  value={activeJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  {eventJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.spec.name} ({j.status})
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          <Field label="Work Completed Caption / Notes">
            <textarea
              className={textareaCls}
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>

          <Button
            type="button"
            icon={Camera}
            onClick={() => {
              const res = submitAfterShiftWorkPhoto(actor, {
                eventId: order.eventId,
                shiftLabel,
                photoUrl,
                caption,
                isFabricationWork: isFabrication && Boolean(activeJobId),
                fabricationJobId: isFabrication ? activeJobId : undefined,
              })
              if (!res.ok) notify(res.error)
              else
                notify(
                  `After-shift work photo submitted${isFabrication && activeJobId ? " and linked to Custom Fabrication job for Warehouse Ready-to-Load verification" : ""}.`,
                )
            }}
          >
            Submit After-Shift Work Photo
          </Button>
        </Card>

        {/* Right: Distinct Photo Categories (Scenario 7) */}
        <div className="space-y-6">
          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Category A — After-Shift Work Photos ({state.afterShiftPhotos.length})
              </h3>
              <Badge tone="info">Shift & Fabrication Progress</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {state.afterShiftPhotos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-line bg-fg/[0.02] p-3 text-xs"
                >
                  <Visual
                    src={p.photoUrl}
                    label={p.caption}
                    className="size-16 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">{p.shiftLabel}</div>
                    <div className="text-muted-foreground">{p.eventTitle}</div>
                    {p.isFabricationWork && (
                      <Badge tone="info">Linked to Job: {p.fabricationJobId}</Badge>
                    )}
                    <p className="mt-1 text-muted-foreground">“{p.caption}”</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      By {p.submittedByName} · {fmtStamp(p.submittedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Category B — Checkpoint Arrival Confirmation Photos (Venue & Warehouse)
              </h3>
              <Badge tone="success">Team Lead Arrival Checkpoints</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-line bg-fg/[0.02] p-3">
                <div className="font-semibold text-foreground">2. Venue Arrival Photo</div>
                {order.venueArrival ? (
                  <div className="mt-2 flex items-start gap-3">
                    <Visual
                      src={order.venueArrival.photoUrl}
                      label="Venue arrival"
                      className="size-14 shrink-0 rounded-md"
                    />
                    <div>
                      <div>Submitted by {order.venueArrival.submittedByName}</div>
                      <div className="text-muted-foreground">
                        {fmtStamp(order.venueArrival.submittedAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">Not submitted yet.</p>
                )}
              </div>
              <div className="rounded-xl border border-line bg-fg/[0.02] p-3">
                <div className="font-semibold text-foreground">4. Warehouse Arrival Photo</div>
                {order.warehouseArrival ? (
                  <div className="mt-2 flex items-start gap-3">
                    <Visual
                      src={order.warehouseArrival.photoUrl}
                      label="Warehouse arrival"
                      className="size-14 shrink-0 rounded-md"
                    />
                    <div>
                      <div>Submitted by {order.warehouseArrival.submittedByName}</div>
                      <div className="text-muted-foreground">
                        {fmtStamp(order.warehouseArrival.submittedAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">Not submitted yet.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Category C — Damage & Missing Incident Evidence ({state.incidentReports.length})
              </h3>
              <Badge tone="danger">Field Incident Evidence</Badge>
            </div>
            {state.incidentReports.length === 0 ? (
              <p className="text-xs text-muted-foreground">No incident evidence photos filed.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                {state.incidentReports.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex items-start gap-3 rounded-xl border border-line bg-fg/[0.02] p-3"
                  >
                    <Visual
                      src={inc.photoUrl}
                      label={inc.itemName}
                      className="size-14 shrink-0 rounded-md"
                    />
                    <div>
                      <div className="font-semibold text-foreground">
                        {inc.reportType}: {inc.itemName} (×{inc.quantity})
                      </div>
                      <div className="text-muted-foreground">Checkpoint: {inc.checkpoint}</div>
                      <div className="text-muted-foreground">By {inc.submittedByName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}


export { EvidenceCaptureModule }
