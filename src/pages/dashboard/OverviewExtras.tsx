import { useNotify } from '../../components/ui/Notifications'
import Dropdown from '../../components/ui/Dropdown'
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Calendar as CalIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, X, ArrowRight, FileSpreadsheet, Image as ImageIcon, Loader2, Code2, Smartphone, Atom, Cloud, Database, LifeBuoy, Wallet, Globe } from 'lucide-react'
import { Card, Badge, Button, Field, Input, cx } from '../../components/ui/ui'
import RowMenu from '../../components/ui/RowMenu'
import type { Project } from '../../types/project'
import type { Account } from '../../auth/store'
import { canAccess } from '../../auth/roleConfig'
import Modal from '../../components/overlay/Modal'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { addDaysToYmd, toManilaYmd } from '../../dashboard/dashboardMetrics'

export type DashboardDateRange = {
  preset: string
  fromYmd: string
  toYmd: string
  label: string
}

const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m: m - 1, d }
}
const toYmd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const fmtYmd = (ymd: string) => {
  const { y, m, d } = parseYmd(ymd)
  return new Date(Date.UTC(y, m, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}
const monthLabel = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
const daysBetween = (fromYmd: string, toYmdVal: string) => {
  const a = parseYmd(fromYmd)
  const b = parseYmd(toYmdVal)
  return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86_400_000) + 1
}

function presetRange(preset: string, todayYmd: string): [string, string] {
  const { y, m } = parseYmd(todayYmd)
  switch (preset) {
    case 'Today':
    case 'Custom':
      return [todayYmd, todayYmd]
    case 'Yesterday': {
      const yest = addDaysToYmd(todayYmd, -1)
      return [yest, yest]
    }
    case 'Last 7 Days':
      return [addDaysToYmd(todayYmd, -6), todayYmd]
    case 'Last 28 Days':
      return [addDaysToYmd(todayYmd, -27), todayYmd]
    case 'Last 30 Days':
      return [addDaysToYmd(todayYmd, -29), todayYmd]
    case 'Last Month': {
      const prevY = m === 0 ? y - 1 : y
      const prevM = m === 0 ? 11 : m - 1
      const lastDay = new Date(Date.UTC(prevY, prevM + 1, 0)).getUTCDate()
      return [toYmd(prevY, prevM, 1), toYmd(prevY, prevM, lastDay)]
    }
    case 'This Month':
    default: {
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      return [toYmd(y, m, 1), toYmd(y, m, lastDay)]
    }
  }
}

export function defaultThisMonthRange(now = Date.now()): DashboardDateRange {
  const todayYmd = toManilaYmd(now)
  const [fromYmd, toYmdVal] = presetRange('This Month', todayYmd)
  return { preset: 'This Month', fromYmd, toYmd: toYmdVal, label: 'This Month' }
}

const PRESET_NAMES = ['Custom', 'Today', 'Yesterday', 'Last 7 Days', 'Last 28 Days', 'Last 30 Days', 'This Month', 'Last Month'] as const

function useOutside<T extends HTMLElement>(fn: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && fn()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [fn])
  return ref
}

function Month({ y, m, fromYmd, toYmdVal, todayYmd, pick }: { y: number; m: number; fromYmd: string; toYmdVal: string; todayYmd: string; pick: (ymd: string) => void }) {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay()
  const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => toYmd(y, m, i + 1))]
  return (
    <div className="grid grid-cols-7 gap-y-1.5 text-center text-[13px]">
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
        <span key={d} className="pb-1 text-muted-foreground">{d}</span>
      ))}
      {cells.map((ymd, i) => {
        if (!ymd) return <span key={i} />
        const edge = ymd === fromYmd || ymd === toYmdVal
        const inR = ymd > fromYmd && ymd < toYmdVal
        const dayNum = Number(ymd.slice(8))
        return (
          <button
            key={ymd}
            type="button"
            onClick={() => pick(ymd)}
            className={cx(
              'h-8 font-medium transition-colors',
              edge ? 'rounded-md bg-invert text-invert-fg' : inR ? (ymd === todayYmd ? 'bg-fg/20 text-foreground' : 'bg-fg/10 text-foreground') : 'rounded-md text-foreground hover:bg-elev',
            )}
          >
            {dayNum}
          </button>
        )
      })}
    </div>
  )
}

export function DateRangePicker({
  value,
  onApply,
}: {
  value: DashboardDateRange
  onApply: (next: DashboardDateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftSel, setDraftSel] = useState(value.preset)
  const [draftFrom, setDraftFrom] = useState(value.fromYmd)
  const [draftTo, setDraftTo] = useState(value.toYmd)
  const [view, setView] = useState(() => {
    const p = parseYmd(value.fromYmd)
    return { y: p.y, m: p.m }
  })

  const syncDraftFromCommitted = () => {
    setDraftSel(value.preset)
    setDraftFrom(value.fromYmd)
    setDraftTo(value.toYmd)
    const p = parseYmd(value.fromYmd)
    setView({ y: p.y, m: p.m })
  }

  const discardAndClose = () => {
    syncDraftFromCommitted()
    setOpen(false)
  }

  const ref = useOutside<HTMLDivElement>(discardAndClose)
  const todayYmd = toManilaYmd(Date.now())

  const pick = (ymd: string) => {
    setDraftSel('Custom')
    if (draftFrom !== draftTo || ymd < draftFrom) {
      setDraftFrom(ymd)
      setDraftTo(ymd)
    } else {
      setDraftTo(ymd)
    }
  }

  const nextView = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 }
  const prevView = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 }
  const days = Math.max(1, daysBetween(draftFrom, draftTo))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) discardAndClose()
          else {
            syncDraftFromCommitted()
            setOpen(true)
          }
        }}
        className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-elev"
      >
        <CalIcon size={16} className="text-muted-foreground" /> {value.label} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(718px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card text-foreground shadow-2xl animate-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Select Date</span>
            <button type="button" onClick={discardAndClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="flex flex-col sm:flex-row">
            <div className="border-b border-line p-3 sm:w-[208px] sm:border-b-0 sm:border-r sm:p-4">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Quick Select</p>
              <div className="grid grid-cols-2 gap-1 sm:block">
                {PRESET_NAMES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setDraftSel(p)
                      const [f, t] = presetRange(p, todayYmd)
                      setDraftFrom(f)
                      setDraftTo(t)
                      const parsed = parseYmd(f)
                      setView({ y: parsed.y, m: parsed.m })
                    }}
                    className={cx('flex h-[36px] w-full items-center rounded-md px-3 text-[13px] sm:mb-1.5 sm:h-[38px] sm:text-[14px]', draftSel === p ? 'bg-invert text-invert-fg' : 'text-foreground hover:bg-elev')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 bg-bg">
              <div className="flex items-end gap-3 border-b border-line bg-card p-4">
                {[['From', draftFrom], ['To', draftTo]].map(([l, d], i) => (
                  <div key={l} className={cx('flex-1', i === 1 && 'order-3')}>
                    <p className="mb-1.5 text-[12px] font-semibold uppercase text-muted-foreground">{l}</p>
                    <div className="flex h-9 items-center rounded-md bg-field px-3 text-[13px] font-semibold text-foreground sm:text-[14px]">{fmtYmd(d)}</div>
                  </div>
                ))}
                <div className="order-2 flex h-9 items-center gap-1 text-muted-foreground"><span className="h-px w-3 bg-line sm:w-5" /><ArrowRight size={14} /><span className="h-px w-3 bg-line sm:w-5" /></div>
              </div>
              <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 sm:gap-8">
                {[view, nextView].map((v, i) => (
                  <div key={`${v.y}-${v.m}`}>
                    <div className="mb-3 flex items-center justify-between">
                      {i === 0 ? <button type="button" aria-label="Previous month" onClick={() => setView(prevView)} className="text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /></button> : <span />}
                      <span className="text-[14px] font-semibold">{monthLabel(v.y, v.m)}</span>
                      {i === 1 ? <button type="button" aria-label="Next month" onClick={() => setView(nextView)} className="text-muted-foreground hover:text-foreground"><ChevronRight size={16} /></button> : <span />}
                    </div>
                    <Month y={v.y} m={v.m} fromYmd={draftFrom} toYmdVal={draftTo} todayYmd={todayYmd} pick={pick} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-3">
                <span className="text-[12px] text-muted-foreground">{days} {days === 1 ? 'day' : 'days'} selected</span>
                <div className="flex gap-2">
                  <button type="button" onClick={discardAndClose} className="h-8 rounded-full border border-line px-4 text-[13px] text-foreground hover:bg-elev">Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLabel = draftSel === 'Custom' ? `${fmtYmd(draftFrom)} – ${fmtYmd(draftTo)}` : draftSel
                      onApply({ preset: draftSel, fromYmd: draftFrom, toYmd: draftTo, label: nextLabel })
                      setOpen(false)
                    }}
                    className="h-8 rounded-full bg-invert px-4 text-[13px] font-semibold text-invert-fg hover:opacity-90"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ExportMenu({ variant = 'outline', csv }: { variant?: 'outline' | 'ghost'; csv?: () => string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const notify = useNotify()
  const exporting = useRef(false)
  const ref = useOutside<HTMLDivElement>(() => setOpen(false))
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement('a'), { href: url, download: filename })
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const run = async (kind: 'csv' | 'png') => {
    if (exporting.current) return
    setOpen(false)
    exporting.current = true
    setBusy(true)
    try {
      if (kind === 'csv' && csv) {
        download(new Blob([csv()], { type: 'text/csv;charset=utf-8' }), 'projects.csv')
        return
      }
      const target = document.getElementById('dashboard-image-export')
      if (!target) throw new Error('Dashboard is not available.')
      const { toBlob } = await import('html-to-image')
      await document.fonts.ready
      await Promise.all(Array.from(target.querySelectorAll('img'), (image) => image.decode()))
      const width = target.scrollWidth
      const height = target.scrollHeight
      const blob = await toBlob(target, {
        width,
        height,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
        pixelRatio: Math.min(2, 8192 / Math.max(width, height)),
        style: { animation: 'none', transform: 'none' },
      })
      if (!blob) throw new Error('Image could not be generated.')
      download(blob, `dashboard-${new Date().toISOString().slice(0, 10)}.png`)
    } catch {
      notify({ tone: 'error', text: 'Export failed. Please try again once the dashboard has loaded.' })
    } finally {
      exporting.current = false
      setBusy(false)
    }
  }
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => csv ? setOpen((o) => !o) : void run('png')}
        disabled={busy}
        aria-label={csv ? 'Export projects' : 'Export dashboard as PNG'}
        aria-busy={busy}
        className={cx('flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-elev disabled:opacity-60', variant === 'outline' && 'border border-border')}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {busy ? 'Exporting Image...' : 'Export'}
      </button>
      {csv && open && (
        <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl animate-pop">
          <button onClick={() => run('csv')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-elev">
            <FileSpreadsheet size={18} className="text-emerald-400" />
            <span><span className="block text-[14px] font-semibold">Export as CSV</span><span className="block text-[12px] text-muted-foreground">Download spreadsheet</span></span>
          </button>
          <button onClick={() => run('png')} className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left hover:bg-elev">
            <ImageIcon size={18} className="text-blue-400" />
            <span><span className="block text-[14px] font-semibold">Export as Image</span><span className="block text-[12px] text-muted-foreground">Download PNG</span></span>
          </button>
        </div>
      )}
    </div>
  )
}

const pIcons = [Code2, Smartphone, Atom, Cloud, Database, LifeBuoy, Wallet, Globe]

export type RecentProjectsData = {
  all: Project[]
  setAll: Dispatch<SetStateAction<Project[]>>
  setTrash: Dispatch<SetStateAction<Project[]>>
}

export function RecentProjects({ account, all, setAll, setTrash }: RecentProjectsData & { account: Account }) {
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Project | null>(null)
  const per = 4
  const authorized = canAccess(account.role, 'projects')
  const sorted = authorized ? [...all].sort((a, b) => {
    const timestamp = (value: string) => {
      const [month, day, year] = value.split('/').map(Number)
      return Number.isFinite(year) ? new Date(year, month - 1, day).getTime() : 0
    }
    return timestamp(b.updated) - timestamp(a.updated) || b.id - a.id
  }) : []
  const total = sorted.length
  const pages = Math.max(1, Math.ceil(total / per))
  const currentPage = Math.min(page, pages)
  const rows = sorted.slice((currentPage - 1) * per, currentPage * per)
  const selected = sorted.find(project => project.id === selectedId)
  if (!authorized) return null
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-foreground">Recent Projects</h3>
          <p className="text-[14px] text-muted-foreground">Overview of recent event projects.</p>
        </div>
        <ExportMenu variant="ghost" csv={() => 'name,status,updated\n' + sorted.map((r) => [r.name, r.status, r.updated].map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n')} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[600px] text-[14px]">
          <thead className="bg-elev text-left">
            <tr>
              <th className="px-4 py-4 font-semibold">Name</th>
              <th className="px-4 font-semibold">Status</th>
              <th className="px-4 font-semibold">Last Updated</th>
              <th className="px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const Icon = pIcons[p.id % pIcons.length]
              return (
                <tr key={p.id} className={cx(i > 0 && 'border-t border-line')}>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 place-items-center rounded-md bg-elev"><Icon size={14} /></span>
                      <div className="min-w-0">
                        <p className="font-semibold">{p.name}</p>
                        <p className="max-w-[240px] truncate text-[12px] text-muted-foreground">{p.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4"><Badge tone={p.status === 'Ready' ? 'success' : p.status === 'In Progress' ? 'warning' : 'danger'}>{p.status}</Badge></td>
                  <td className="px-4 text-muted-foreground">{p.updated}</td>
                  <td className="px-4">
                    <div className="flex justify-end">
                      <RowMenu items={[
                        { label: 'View', icon: Eye, onClick: () => { setSelectedId(p.id); setEditing(false) } },
                        { label: 'Edit', icon: Pencil, onClick: () => { setSelectedId(p.id); setDraft({ ...p }); setEditing(true) } },
                        { label: 'Delete', icon: Trash2, danger: true, onClick: () => { setAll(items => items.filter(item => item.id !== p.id)); setTrash(items => [p, ...items]) } },
                      ]} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {total === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No event projects available.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[13px]">
        <span className="text-muted-foreground">Showing <b className="text-foreground">{total ? (currentPage - 1) * per + 1 : 0}</b> to <b className="text-foreground">{Math.min(currentPage * per, total)}</b> of <b className="text-foreground">{total}</b> results</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="h-9 rounded-full px-3 font-medium hover:bg-elev disabled:text-muted-foreground">Previous</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)} className={cx('size-9 rounded-full font-semibold', n === currentPage ? 'bg-white text-neutral-900' : 'hover:bg-elev')}>{n}</button>
          ))}
          <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="h-9 rounded-full px-3 font-semibold hover:bg-elev disabled:text-muted-foreground">Next</button>
        </div>
      </div>
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={editing ? 'Edit Project' : 'Project Details'}>
        {selected && (editing && draft ? (
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault()
            if (!draft.name.trim()) return
            setAll(items => items.map(item => item.id === selected.id ? { ...item, name: draft.name.trim(), description: draft.description, status: draft.status, updated: new Date().toLocaleDateString('en-US') } : item))
            setSelectedId(null)
          }}>
            <Field label="Project Name"><Input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field>
            <Field label="Description"><Input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
            <Field label="Status">
              <Dropdown value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Project['status'] })} className="h-10 w-full rounded-lg border border-line bg-field px-3 text-sm">
                <option>Ready</option><option>In Progress</option><option>Blocked</option>
              </Dropdown>
            </Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSelectedId(null)}>Cancel</Button><Button type="submit">Save Changes</Button></div>
          </form>
        ) : (
          <div className="space-y-4">
            <div><p className="font-semibold">{selected.name}</p><p className="text-sm text-muted-foreground">{selected.description}</p></div>
            <Badge tone={selected.status === 'Ready' ? 'success' : selected.status === 'Blocked' ? 'danger' : 'warning'}>{selected.status}</Badge>
            <dl className="grid grid-cols-2 gap-4 rounded-xl bg-field p-4">
              {[['Environment', selected.environment], ['Version', selected.version], ['Last Updated', selected.updated]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
            </dl>
          </div>
        ))}
      </Modal>
    </Card>
  )
}
