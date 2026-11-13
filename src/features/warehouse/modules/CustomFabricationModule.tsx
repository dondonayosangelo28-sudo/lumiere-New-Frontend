import { useState } from "react"
import { CheckCircle2, Plus } from "lucide-react"
import { Badge, Button, Card, Field, Input, PageHeader } from "../../../components/ui/ui"
import { Visual, fmtStamp, textareaCls } from "../../event-manager/shared"
import {
  createCustomFabricationJob,
  useOperationsStore,
  verifyCustomFabricationJob,
  type OpsActor,
} from "../../../operations/store"
import { useNotify } from "../warehouse-shared"

export default function CustomFabricationModule({ actor }: { actor: OpsActor }) {
  const state = useOperationsStore()
  const notify = useNotify()
  const [notesByJob, setNotesByJob] = useState<Record<string, string>>({})
  const [showNewModal, setShowNewModal] = useState(false)
  const [newSpec, setNewSpec] = useState({
    eventId: state.orderRequests[0]?.eventId ?? "",
    name: "",
    requestedQty: 1,
    dimensions: "",
    materials: "",
    colors: "",
    finish: "",
    buildInstructions: "",
    referenceImage: "/event-manager-images/garden.jpg",
  })

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={["Dashboard", "Warehouse Operations Manager", "Custom Fabrication"]}
        title="Custom Fabrication"
        subtitle="Review build specifications and crew photos before releasing finished items."
        actions={
          <Button type="button" icon={Plus} onClick={() => setShowNewModal((v) => !v)}>
            {showNewModal ? "Close New Job Form" : "New Production Job"}
          </Button>
        }
      />

      {showNewModal && (
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-bold text-foreground">
            Create Custom Fabrication Job Linked to Approved Event
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Linked Approved Event">
              <select
                className="h-10 w-full rounded-md border border-fg/[0.06] bg-fg/[0.08] px-3 text-sm text-foreground"
                value={newSpec.eventId}
                onChange={(e) => setNewSpec({ ...newSpec, eventId: e.target.value })}
              >
                {state.orderRequests.map((o) => (
                  <option key={o.eventId} value={o.eventId}>
                    {o.eventTitle} ({o.id})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Custom Item Name">
              <Input
                value={newSpec.name}
                onChange={(e) => setNewSpec({ ...newSpec, name: e.target.value })}
                placeholder="e.g. Custom Botanical Entry Arch"
              />
            </Field>
            <Field label="Requested Quantity">
              <Input
                type="number"
                min={1}
                value={newSpec.requestedQty}
                onChange={(e) =>
                  setNewSpec({ ...newSpec, requestedQty: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </Field>
            <Field label="Dimensions">
              <Input
                value={newSpec.dimensions}
                onChange={(e) => setNewSpec({ ...newSpec, dimensions: e.target.value })}
                placeholder="3.0m H × 2.2m W"
              />
            </Field>
            <Field label="Materials">
              <Input
                value={newSpec.materials}
                onChange={(e) => setNewSpec({ ...newSpec, materials: e.target.value })}
                placeholder="Powder-coated steel, cedar slats"
              />
            </Field>
            <Field label="Colors & Finish">
              <Input
                value={newSpec.colors}
                onChange={(e) =>
                  setNewSpec({ ...newSpec, colors: e.target.value, finish: e.target.value })
                }
                placeholder="Warm ivory satin matte"
              />
            </Field>
          </div>
          <Field label="Build & Assembly Instructions">
            <textarea
              className={textareaCls}
              rows={2}
              value={newSpec.buildInstructions}
              onChange={(e) => setNewSpec({ ...newSpec, buildInstructions: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowNewModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const res = createCustomFabricationJob(
                  newSpec.eventId,
                  {
                    name: newSpec.name,
                    requestedQty: newSpec.requestedQty,
                    dimensions: newSpec.dimensions || "Per venue drawing",
                    materials: newSpec.materials || "Specified materials",
                    colors: newSpec.colors || "Theme palette",
                    finish: newSpec.finish || "Matte finish",
                    buildInstructions:
                      newSpec.buildInstructions || "Follow approved Event Manager specification.",
                    referenceImages: [newSpec.referenceImage],
                  },
                  ["crew@demo.com"],
                )
                if (!res.ok) notify(res.error)
                else {
                  notify(`Created production job for ${res.job.spec.name}.`)
                  setShowNewModal(false)
                }
              }}
            >
              Create Production Job
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-5">
        {state.fabricationJobs.map((job) => {
          const linkedPhotos = state.afterShiftPhotos.filter((p) =>
            job.linkedShiftPhotoIds.includes(p.id),
          )
          const notes = notesByJob[job.id] ?? ""
          return (
            <Card key={job.id} className="p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
                    <Badge tone="neutral">Event: {job.eventTitle}</Badge>
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
                    {job.releasedForLoading && (
                      <Badge tone="info">Included on Dispatch Manifest</Badge>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold text-foreground">{job.spec.name}</h3>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Left: Event Manager Verification Criteria */}
                <div className="rounded-xl border border-line bg-fg/[0.02] p-4 space-y-3 text-xs">
                  <div className="text-sm font-bold text-foreground">
                    1. Event Manager Approved Specifications (Verification Criteria)
                  </div>
                  <div className="flex items-start gap-3">
                    <Visual
                      src={job.spec.referenceImages[0] || "/event-manager-images/garden.jpg"}
                      label={job.spec.name}
                      className="size-20 shrink-0 rounded-lg"
                    />
                    <div className="grid gap-1.5 sm:grid-cols-2 flex-1">
                      <div>
                        <span className="text-muted-foreground">Approved Qty:</span>{" "}
                        <strong className="text-foreground">{job.spec.requestedQty}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dimensions:</span>{" "}
                        <strong className="text-foreground">{job.spec.dimensions}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Materials:</span>{" "}
                        <strong className="text-foreground">{job.spec.materials}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Colors:</span>{" "}
                        <strong className="text-foreground">{job.spec.colors}</strong>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Finish:</span>{" "}
                        <strong className="text-foreground">{job.spec.finish}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-line pt-2">
                    <span className="font-semibold text-foreground">
                      Construction & Assembly Instructions:
                    </span>
                    <p className="mt-1 text-muted-foreground">{job.spec.buildInstructions}</p>
                  </div>
                </div>

                {/* Right: Ground Crew Linked After-Shift Work Photos & Warehouse Verification */}
                <div className="rounded-xl border border-line bg-fg/[0.02] p-4 space-y-3 text-xs">
                  <div className="text-sm font-bold text-foreground">
                    2. Ground Crew After-Shift Work Photo & Ready-to-Load Verification
                  </div>
                  {linkedPhotos.length === 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-muted-foreground">
                      <strong className="text-foreground">Awaiting Ground Crew Work Photo:</strong>{" "}
                      Ground Crew must submit an after-shift work photo linked to this fabrication
                      job in <em>Ground Crew → Evidence Capture</em> before Warehouse can verify and
                      mark it <strong>Ready to Load</strong>.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedPhotos.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-start gap-3 rounded-lg border border-line bg-card p-3"
                        >
                          <Visual
                            src={p.photoUrl}
                            label={p.caption}
                            className="size-16 shrink-0 rounded-md"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground">{p.shiftLabel}</div>
                            <div className="text-muted-foreground">“{p.caption}”</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Submitted by <strong>{p.submittedByName}</strong> at{" "}
                              {fmtStamp(p.submittedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {job.status === "Ready to Load" ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-foreground">
                      <div className="font-bold text-[#4ade80]">
                        Verified & Marked Ready to Load (Released to Dispatch Manifest)
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        Verified by <strong className="text-foreground">{job.verifiedByName}</strong>{" "}
                        at {job.verifiedAt && fmtStamp(job.verifiedAt)}:{" "}
                        “{job.verificationNotes}”
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {job.correctionNotes && (
                        <div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-danger">
                          <strong>Corrections requested:</strong> {job.correctionNotes}
                        </div>
                      )}
                      <Input
                        value={notes}
                        onChange={(e) => setNotesByJob({ ...notesByJob, [job.id]: e.target.value })}
                        placeholder="Verification notes or required corrections…"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          icon={CheckCircle2}
                          onClick={() => {
                            const res = verifyCustomFabricationJob(actor, job.id, {
                              passed: true,
                              notes,
                            })
                            if (!res.ok) notify(res.error)
                            else
                              notify(
                                `${job.spec.name} verified against Event Manager specs and marked Ready to Load! Included in dispatch manifest.`,
                              )
                          }}
                        >
                          Verify Against Spec & Mark Ready to Load
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const res = verifyCustomFabricationJob(actor, job.id, {
                              passed: false,
                              notes,
                            })
                            if (!res.ok) notify(res.error)
                            else notify(`Marked ${job.spec.name} for rework/corrections.`)
                          }}
                        >
                          Request Corrections (Keep in Production)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
