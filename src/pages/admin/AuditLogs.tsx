import { Menu } from '@base-ui/react/menu'
import { useCloseOnOverlay, useOverlayContainer } from '../../components/overlay/OverlayLayer'
import { downloadCsv } from '../../features/warehouse/modules/ReplenishmentDeficitsModule'
import { toManilaYmd } from '../../dashboard/dashboardMetrics'
import DatePicker from '../../components/ui/DatePicker'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Eye, FileSpreadsheet, MoreVertical, Search } from 'lucide-react'
import { Badge, Button, Card, Field, Input, PageHeader, cx } from '../../components/ui/ui'
import Drawer from '../../components/overlay/Drawer'
import { AccessDenied } from '../dashboard/RoleViews'
import type { Route } from '../../navigation'
import { EmptyRow, Pager, ResetFiltersButton, SkeletonRows, TIMEZONE, fmtFull, ghostBtn, resultTone } from '../../components/admin/AdminKit'
import { accountsVersion, subscribeAccounts } from '../../auth/mockAuthService'
import { getState, type Account, type AuditEvent, type AuditTargetType } from '../../auth/store'
import { auditDateError, emptyAuditFilters, filterAuditEvents } from '../../auth/auditFilters'

const PER = 10
// Display normalization only; stored events keep their original action strings.
const actionLabel = (a: string) => a.replace(/\b[a-z]/g, (c) => c.toUpperCase())
const typeLabel: Record<AuditTargetType, string> = {
  account: 'Account',
  session: 'Session',
  system: 'System',
  pitch: 'Event Pitch',
  'mood-board': 'Mood Board',
  order: 'Order / Event',
  inventory: 'Inventory',
  acquisition: 'Acquisition',
  vendor: 'Vendor',
  production: 'Production Job',
  dispatch: 'Dispatch Batch',
  rental: 'Rental',
  incident: 'Incident Report',
}

function performedBy(e: AuditEvent) {
  const isRole = e.actorRole === 'Unauthenticated' || e.actorRole === 'System'
  return { name: isRole ? e.actorRole : e.actor.name, email: e.actor.email }
}
function affected(e: AuditEvent) {
  if (e.target.id === 'unknown') return { main: `Unknown account: ${e.target.label}`, sub: 'No matching account existed' }
  return { main: e.target.label, sub: typeLabel[e.target.type] }
}

export default function AuditLogsPage({ account, go }: { account: Account; go: (r: Route) => void }) {
  if (account.role !== 'System Admin') return <AccessDenied go={go} />
  return <AuditBody go={go} />
}

export const AUDIT_LOGS_CSV_HEADERS = [
  'Date and Time (GMT+8)',
  'Performed By',
  'Actor Role',
  'Action',
  'Affected Record',
  'Result',
]

export function buildAuditLogsCsvRows(rows: readonly AuditEvent[]) {
  return rows.map((e) => {
    const by = performedBy(e)
    const rec = affected(e)
    return [
      fmtFull(e.at),
      by.email ? `${by.name} (${by.email})` : by.name,
      e.actorRole ?? 'Not recorded',
      actionLabel(e.action),
      rec.sub ? `${rec.main} (${rec.sub})` : rec.main,
      e.result,
    ]
  })
}

function AuditBody({ go }: { go: (r: Route) => void }) {
  useSyncExternalStore(subscribeAccounts, accountsVersion)
  const events = getState().audit
  const [draft, setDraft] = useState({ ...emptyAuditFilters })
  const [applied, setApplied] = useState({ ...emptyAuditFilters })
  const [dateError, setDateError] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const portalContainer = useOverlayContainer()
  useCloseOnOverlay(() => setMenuOpen(false))

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  const accounts = getState().accounts
  const rows = useMemo(() => filterAuditEvents(events, accounts, { ...applied, role: '', action: '' }), [events, accounts, applied])

  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const safePage = Math.min(page, pages)
  const shown = rows.slice((safePage - 1) * PER, safePage * PER)
  const filtered = !!(applied.username || applied.email || applied.firstName || applied.lastName || applied.from || applied.to)
  const reset = () => { setDraft({ ...emptyAuditFilters }); setApplied({ ...emptyAuditFilters }); setDateError(''); setPage(1) }
  const apply = () => {
    const error = auditDateError(draft)
    setDateError(error)
    if (error) return
    const cleaned = { ...draft, role: '', action: '' }
    setDraft(cleaned)
    setApplied(cleaned)
    setPage(1)
  }
  const exportCsv = () => {
    if (loading || rows.length === 0) return
    downloadCsv(`audit-logs-${toManilaYmd(Date.now())}.csv`, AUDIT_LOGS_CSV_HEADERS, buildAuditLogsCsvRows(rows))
    setMenuOpen(false)
  }
  const viewing = viewingId ? events.find((e) => e.id === viewingId) ?? null : null

  return (
    <>
      <PageHeader onHome={() => go('overview')} crumbs={['Dashboard', 'Audit Logs']} title="Audit Logs" subtitle="A read-only record of account, access, and security activity" />
      <Card className="filter-toolbar rounded-2xl p-4 sm:p-5">
        <form noValidate onSubmit={(e) => { e.preventDefault(); apply() }}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 [&_label]:text-xs [&_label]:font-bold">
            {([
              ['username', 'Username', 'Filter by username'],
              ['email', 'Email', 'Filter by email'],
              ['firstName', 'First Name', 'Filter by first name'],
              ['lastName', 'Last Name', 'Filter by last name'],
            ] as const).map(([key, label, placeholder]) => (
              <Field key={key} label={label}>
                <Input value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} placeholder={placeholder} className="border-line bg-field" />
              </Field>
            ))}
            <Field label="From Date">
              <DatePicker aria-label="From Date" value={draft.from} max={draft.to || undefined} onChange={(value) => { setDraft({ ...draft, from: value }); setDateError('') }} aria-invalid={!!dateError} aria-describedby={dateError ? 'audit-date-error' : undefined} />
            </Field>
            <Field label="To Date">
              <DatePicker aria-label="To Date" value={draft.to} min={draft.from || undefined} onChange={(value) => { setDraft({ ...draft, to: value }); setDateError('') }} aria-invalid={!!dateError} aria-describedby={dateError ? 'audit-date-error' : undefined} />
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2 lg:col-span-2 lg:min-h-9 lg:self-end">
              <Button type="submit" className="h-8! rounded-full px-3! text-xs!"><Search size={14} aria-hidden /> Filter</Button>
              <ResetFiltersButton compact onClick={reset} disabled={!(draft.username || draft.email || draft.firstName || draft.lastName || draft.from || draft.to) && !filtered} />
            </div>
          </div>
          {dateError && <p id="audit-date-error" role="alert" className="mt-3 text-sm text-danger">{dateError}</p>}
        </form>
      </Card>

      <Card className="mt-4 overflow-hidden bg-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-[14px]">
            <caption className="sr-only">Audit log, newest first</caption>
            <thead className="bg-fg/[0.08] text-left">
              <tr>
                {[`Date and Time (${TIMEZONE || 'local'})`, 'Performed By', 'Actor Role', 'Action', 'Affected Record', 'Result'].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">{h}</th>)}
                <th scope="col" className="min-w-[184px] whitespace-nowrap px-4 py-2 font-semibold">
                  <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
                    <span aria-hidden className="size-8" />
                    <span className="text-center">View Details</span>
                    <Menu.Root
                      modal={false}
                      open={menuOpen}
                      onOpenChange={(next) => {
                        if (!loading && rows.length > 0) setMenuOpen(next)
                        else if (!next) setMenuOpen(false)
                      }}
                    >
                      <Menu.Trigger
                        type="button"
                        aria-label="Audit logs actions"
                        disabled={loading || rows.length === 0}
                        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-fg/[0.08] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-default disabled:opacity-40"
                      >
                        <MoreVertical size={16} aria-hidden />
                      </Menu.Trigger>
                      <Menu.Portal container={portalContainer}>
                        <Menu.Positioner
                          sideOffset={8}
                          align="end"
                          collisionPadding={8}
                          className="pointer-events-auto z-[100] max-w-[calc(100vw-16px)]"
                        >
                          <Menu.Popup className="w-52 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl outline-none animate-pop">
                            <Menu.Item
                              onClick={exportCsv}
                              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-elev data-highlighted:bg-elev focus-visible:bg-elev"
                            >
                              <FileSpreadsheet size={18} className="shrink-0 text-blue-400" aria-hidden />
                              <span>
                                <span className="block text-[14px] font-semibold">Export as CSV</span>
                                <span className="block text-[12px] text-muted-foreground">Download CSV</span>
                              </span>
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={7} />
              ) : (
                shown.map((e) => {
                  const by = performedBy(e)
                  const rec = affected(e)
                  return (
                    <tr key={e.id} className="transition-colors duration-150 hover:bg-fg/[0.04]">
                      <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-muted-foreground">{fmtFull(e.at)}</td>
                      <td className="px-4"><p className="font-semibold">{by.name}</p>{by.email && <p className="break-all text-[13px] text-muted-foreground">{by.email}</p>}</td>
                      <td className="px-4">{e.actorRole ?? <span className="text-muted-foreground">Not recorded</span>}</td>
                      <td className="whitespace-nowrap px-4 font-medium">{actionLabel(e.action)}</td>
                      <td className="px-4"><p className="break-words">{rec.main}</p><p className="text-[13px] text-muted-foreground">{rec.sub}</p></td>
                      <td className="px-4"><Badge tone={resultTone(e.result)}>{e.result}</Badge></td>
                      <td className="px-4">
                        <div className="flex justify-center">
                          <button type="button" onClick={() => setViewingId(e.id)} aria-label={`View details: ${actionLabel(e.action)}, ${fmtFull(e.at)}`} className={cx(ghostBtn, 'whitespace-nowrap')}><Eye size={16} aria-hidden /> View Details</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              {!loading && rows.length === 0 && (
                <EmptyRow cols={7}>
                  <p>{filtered ? 'No audit events match your search or filters.' : 'No audit events have been recorded yet.'}</p>
                  {filtered && <button type="button" onClick={reset} className="mt-3 rounded-full border border-edge px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-fg/[0.08]">Reset Filters</button>}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pager page={safePage} pages={pages} total={rows.length} per={PER} noun="events" onPage={setPage} />}
      </Card>

      <EventDrawer event={viewing} onClose={() => setViewingId(null)} />
    </>
  )
}

function EventDrawer({ event, onClose }: { event: AuditEvent | null; onClose: () => void }) {
  // Keep the last shown event while the drawer animates out.
  const [last, setLast] = useState<AuditEvent | null>(null)
  if (event && event !== last) setLast(event)
  const e = event ?? last
  const by = e && performedBy(e)
  const rec = e && affected(e)
  const empty = <span className="text-muted-foreground">(empty)</span>
  return (
    <Drawer open={!!event} onClose={onClose} eyebrow="EVENT DETAILS" title={e ? actionLabel(e.action) : 'Event Details'} titleClassName="text-[20px] font-bold" headerTextClassName="pt-1" bodyClassName="pt-4">
      {e && by && rec && (
        <div>
          <dl className="grid grid-cols-1 gap-4 rounded-xl bg-fg/[0.05] p-4 sm:grid-cols-2">
            {([
              ['Event ID', <span key="i" className="break-all font-mono text-[13px]">{e.id}</span>],
              ['Timestamp', fmtFull(e.at)],
              ['Performed by', <>{by.name}{by.email && <span className="block break-all text-[13px] font-normal text-muted-foreground">{by.email}</span>}</>],
              ['Actor Role', e.actorRole ?? <span className="font-normal text-muted-foreground">Not recorded</span>],
              ['Action', actionLabel(e.action)],
              ['Result', <Badge key="r" tone={resultTone(e.result)}>{e.result}</Badge>],
              ['Affected record', <>{rec.main}<span className="block text-[13px] font-normal text-muted-foreground">{rec.sub}</span></>],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 break-words font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mb-1.5 mt-6 text-[14px] font-semibold">Description</h3>
          <p className="text-[14px] leading-6">{e.description}</p>
          <h3 className="mb-2 mt-6 text-[14px] font-semibold">Changed fields</h3>
          {e.changes?.length ? (
            <div className="overflow-x-auto rounded-xl border border-edge">
              <table className="w-full text-[13px]">
                <thead className="bg-fg/[0.08] text-left"><tr><th scope="col" className="px-3 py-2 font-semibold">Field</th><th scope="col" className="px-3 py-2 font-semibold">Previous</th><th scope="col" className="px-3 py-2 font-semibold">New</th></tr></thead>
                <tbody>
                  {e.changes.map((c, i) => (
                    <tr key={i} className={cx(i > 0 && 'border-t border-edge')}>
                      <th scope="row" className="px-3 py-2 text-left font-semibold">{c.field}</th>
                      <td className="break-all px-3 py-2">{c.from || empty}</td>
                      <td className="break-all px-3 py-2">{c.to || empty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[14px] text-muted-foreground">No field changes were recorded for this event.</p>
          )}
        </div>
      )}
    </Drawer>
  )
}
