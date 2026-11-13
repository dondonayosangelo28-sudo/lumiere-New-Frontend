import { useNotify as useRawNotify } from "../../components/ui/Notifications"
import { Badge, Card, Field } from "../../components/ui/ui"
import { useOperationsStore, type OpsActor } from "../../operations/store"

export function useNotify() {
  const raw = useRawNotify()
  return (text: string) => {
    const isErr = /cannot|blocked|error|require|only|select|specify|enter|describe|provide|prepare|not found|confirm arrived/i.test(text)
    raw({ tone: isErr ? "error" : "success", text })
  }
}

export const SAMPLE_PHOTOS = [
  { label: "Glasshouse Venue Setup Photo", url: "/event-manager-images/garden.jpg" },
  { label: "Custom Fabrication Finished Plinth Photo", url: "/event-manager-images/corporate.jpg" },
  { label: "Warehouse Loading Bay Photo", url: "/event-manager-images/planning.jpg" },
  { label: "Event Hours Table & Chandelier Photo", url: "/event-manager-images/christmas.jpg" },
]

export function EventSelectorHeader({
  actor,
  selectedEventId,
  onSelect,
}: {
  actor: OpsActor
  selectedEventId: string
  onSelect: (id: string) => void
}) {
  const state = useOperationsStore()
  const order =
    state.orderRequests.find((o) => o.eventId === selectedEventId) ?? state.orderRequests[0]
  if (!order) return null

  const isTeamLead = order.teamLeadEmail?.toLowerCase() === actor.email.toLowerCase()

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:max-w-72">
          <Field label="Event">
            <select
              className="h-10 w-full rounded-md border border-line bg-elev px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
              value={order.eventId}
              onChange={(event) => onSelect(event.target.value)}
            >
              {state.orderRequests.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventTitle}</option>)}
            </select>
          </Field>
        </div>
        <Badge tone={isTeamLead ? "info" : "neutral"}>{isTeamLead ? "Team Lead" : `Team Lead: ${order.teamLeadName || "Unassigned"}`}</Badge>
      </div>
    </Card>
  )
}

