import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { currentAccount } from '../../auth/session'
import { getState, subscribe as subscribeAuth } from '../../auth/store'
import { accountsVersion, subscribeAccounts } from '../../auth/mockAuthService'
import { useNow } from '../../components/admin/AdminKit'
import { insightsMetrics } from '../../dashboard/dashboardMetrics'
import { useNotify } from '../../components/ui/Notifications'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  TrendingUp,
  Clock,
  Circle,
  CircleCheck,
  Plus,
  Target,
  Activity,
  Moon,
  Pencil,
  X,
  Cloud,
  Sun,
  Loader2,
} from 'lucide-react'
import { Card, PageHeader, Segmented, cx } from '../../components/ui/ui'
import { initialTasks } from '../../data'
import { DateRangePicker, ExportMenu, defaultThisMonthRange, type DashboardDateRange } from './OverviewExtras'
import { AdminSummaryCards, AuditActivity, SignInActivity, UsersByRole } from './AdminDashboardCards'
import type { AdminNavigation } from '../../components/admin/adminNavigation'


const greeting = (h: number) => (h < 5 ? 'Time to reflect' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Nice to see you')

export const adminGreeting = (h: number) =>
  h < 5 ? 'Time to reflect' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : h < 22 ? 'Nice to see you' : 'Wrapping up the day'

export function Hero({ name, getGreeting = greeting }: { name?: string; getGreeting?: (hour: number) => string }) {
  const [t, setT] = useState(new Date())
  const [authFirstName, setAuthFirstName] = useState(() => currentAccount()?.firstName?.trim() || '')
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    setAuthFirstName(currentAccount()?.firstName?.trim() || '')
    return subscribeAuth(() => {
      setAuthFirstName(currentAccount()?.firstName?.trim() || '')
    })
  }, [])
  const resolvedName = name?.trim() || authFirstName || 'User'
  const h = t.getHours()
  const time = `${String(h % 12 || 12).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  const date = t.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const night = h < 6 || h >= 18
  return (
    <Card className="dashboard-welcome relative flex min-h-[210px] items-center overflow-hidden px-8 py-7">
      <div className="relative flex w-full flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="text-[28px] font-bold leading-9 text-foreground">{getGreeting(h)}, {resolvedName}</h2>
          <p className="text-[14px] text-muted-foreground">Ready to make today productive! 🚀</p>
          <p className="mt-5 flex items-baseline gap-2 text-[48px] font-bold leading-none tabular-nums text-foreground">
            {time} <span className="text-[20px] font-medium text-muted-foreground">{h < 12 ? 'AM' : 'PM'}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <span className="relative size-12">
              {night ? <Moon size={22} className="absolute left-0 top-0 text-[#3b82f6]" fill="#3b82f6" /> : <Sun size={22} className="absolute left-0 top-0 text-amber-400" fill="currentColor" />}
              <Cloud size={36} className="absolute bottom-0 right-0 text-slate-300 dark:text-white" fill="white" />
            </span>
            <span className="text-[44px] font-bold leading-none text-foreground">26°C</span>
          </div>
          <p className="mt-2 text-[14px] text-muted-foreground">Partly Cloudy</p>
          <p className="mt-1 text-[14px] font-semibold text-muted-foreground">Quezon City</p>
          <p className="mt-0.5 text-[14px] text-muted-foreground">{date}</p>
        </div>
      </div>
    </Card>
  )
}

const BLUE = '#2563eb'
const GREEN = '#10b981'
const GRAY = '#9ca3af'

type InsightMetric = {
  label: string
  sub: string
  value: number | null
  color: string
  icon: typeof Target
}

const clampScore = (value: number) => Math.max(0, Math.min(100, value))
const metricScore = (metric: InsightMetric) =>
  metric.value === null || !Number.isFinite(metric.value) ? 0 : clampScore(metric.value)

function Insights() {
  useSyncExternalStore(subscribeAccounts, accountsVersion)
  const now = useNow(30_000)
  const [tab, setTab] = useState<'account' | 'trends'>('account')
  const metrics = insightsMetrics(getState(), now)

  const trendsSet: InsightMetric[] = [
    { label: 'User Growth', sub: 'Month-over-month increase', value: metrics.trends.userGrowth, color: GREEN, icon: TrendingUp },
    { label: 'Engagement Rate', sub: 'Daily active users', value: metrics.trends.engagementRate, color: BLUE, icon: Users },
    { label: 'Retention', sub: 'Active or pending share', value: metrics.trends.retention, color: GRAY, icon: Target },
  ]
  const accountSet: InsightMetric[] = [
    { label: 'Active Users', sub: 'Active accounts share', value: metrics.account.activeUsersPct, color: GREEN, icon: Users },
    { label: 'Pending Users', sub: 'Pending activation share', value: metrics.account.pendingUsersPct, color: BLUE, icon: Clock },
    { label: 'Inactive Users', sub: 'Inactive accounts share', value: metrics.account.inactiveUsersPct, color: GRAY, icon: Activity },
  ]
  const set = tab === 'account' ? accountSet : trendsSet
  const centerValue = tab === 'account' ? metrics.account.activeUsersPct : metrics.trends.userGrowth
  const centerText = centerValue === null ? 'N/A' : `${centerValue}%`
  return (
    <Card className="p-5">
      <h3 className="text-[16px] font-semibold text-foreground">Insights</h3>
      <p className="mb-4 text-[14px] text-muted-foreground">Trends and account status</p>
      <Segmented
        keyboardNavigation
        value={tab}
        onChange={setTab}
        options={[
          { value: 'account', label: 'Accounts', icon: Users },
          { value: 'trends', label: 'Trends', icon: TrendingUp },
        ]}
      />
      <div className="dashboard-inset mt-4 rounded-2xl border border-line/80 bg-card p-5 dark:border-transparent dark:bg-fg/[0.03]">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="relative size-40 shrink-0">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90 scale-[1.13]" aria-hidden="true">
              {set.map((r, i) => {
                const rad = 52 - i * 11
                const c = 2 * Math.PI * rad
                const fill = metricScore(r)
                const length = c * (fill / 100)
                const offset = c - length
                return (
                  <g key={r.label}>
                    {/* Track ring */}
                    <circle
                      cx="60"
                      cy="60"
                      r={rad}
                      fill="none"
                      stroke="currentColor"
                      className="text-fg/[0.08]"
                      strokeWidth="6.5"
                    />
                    {/* Value progress arc */}
                    <circle
                      cx="60"
                      cy="60"
                      r={rad}
                      fill="none"
                      stroke={r.color}
                      strokeWidth="6.5"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={offset}
                      className="transition-all duration-500 ease-out"
                    />
                  </g>
                )
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={cx('whitespace-nowrap font-bold leading-none tracking-tight text-foreground', centerText.length >= 5 ? 'text-[20px]' : 'text-[26px]')}
              >
                {centerText}
              </span>
            </div>
          </div>
          <ul key={tab} className="min-w-44 flex-1 space-y-4 animate-fade-up">
            {set.map((r) => (
              <li key={r.label} className="relative flex items-center gap-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  style={{
                    backgroundColor: `${r.color}22`,
                    color: r.color,
                  }}
                >
                  <r.icon size={16} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-tight text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="block text-[12px] leading-tight text-muted-foreground">
                    {r.sub}
                  </span>
                </span>
                <span
                  className="w-16 shrink-0 self-center whitespace-nowrap text-right text-[14px] font-bold tabular-nums text-foreground"
                  style={{ color: r.color }}
                >
                  {r.value === null ? 'N/A' : `${r.value}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

function QuickTasks() {
  const [tasks, setTasks] = useState(initialTasks)
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const notifyToast = useNotify()
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(t)
  }, [])
  const active = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const list = tab === 'active' ? active : done
  const notify = (text: string) => notifyToast({ tone: 'success', text })
  const add = () => {
    if (!draft.trim()) return
    setTasks((ts) => [{ id: Date.now(), title: draft.trim(), done: false }, ...ts])
    setDraft('')
    setTab('active')
    notify('Task added')
  }
  const saveEdit = () => {
    if (editing && editing.text.trim()) setTasks((ts) => ts.map((x) => (x.id === editing.id ? { ...x, title: editing.text.trim() } : x)))
    setEditing(null)
  }
  return (
    <Card className="flex flex-col p-4">
      <h3 className="text-[16px] font-semibold text-foreground">Quick Tasks</h3>
      <p className="mb-6 text-[14px] text-muted-foreground">Manage your daily tasks</p>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `Active (${active.length})`, icon: Circle },
          { value: 'done', label: `Completed (${done.length})`, icon: CircleCheck },
        ]}
      />
      <div className="dashboard-inset mt-4 flex-1 rounded-xl border border-line/80 bg-card p-4 dark:border-transparent dark:bg-fg/[0.04]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a quick task..."
            className="h-10 flex-1 rounded-md border border-line bg-field px-3 text-[14px] outline-none ring-1 ring-transparent transition-shadow placeholder:text-muted-foreground focus:ring-fg/20 dark:border-transparent dark:bg-fg/[0.08]"
          />
          <button aria-label="Add task" className="grid size-10 place-items-center rounded-md bg-[#2c2c2c] text-[#f5f7f8] transition-colors hover:bg-[#1f1f1f] dark:bg-fg/50 dark:text-[#151515] dark:hover:bg-fg/70">
            <Plus size={16} />
          </button>
        </form>
        <ul className="mt-5 max-h-[232px] space-y-2 overflow-y-auto pr-1">
          {loading && <li className="grid place-items-center py-10"><Loader2 size={20} className="animate-spin text-muted-foreground" /></li>}
          {!loading && list.map((t) => (
            <li key={t.id} className={cx('group flex items-center gap-3 rounded-md border border-line bg-card px-3 py-3 transition-colors duration-150 animate-fade-up dark:border-fg/[0.04] dark:bg-transparent', t.done ? 'bg-[#f5f5f5] hover:bg-[#eeeeee] dark:bg-fg/[0.08] dark:hover:bg-fg/[0.12]' : 'hover:bg-[#f7f9fb] dark:hover:bg-fg/[0.05]')}>
              <input
                type="checkbox"
                checked={t.done}
                aria-label={`${t.done ? 'Mark active' : 'Mark complete'}: ${t.title}`}
                onChange={(event) => {
                  const checked = event.currentTarget.checked
                  setTasks((ts) => ts.map((x) => (x.id === t.id && x.done !== checked ? { ...x, done: checked } : x)))
                  notify(checked ? 'Task completed' : 'Task moved to Active')
                }}
                className="size-4 shrink-0 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              />
              {editing?.id === t.id ? (
                <input
                  autoFocus
                  value={editing.text}
                  onChange={(e) => setEditing({ id: t.id, text: e.target.value })}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  className="h-7 flex-1 rounded-md border border-muted bg-elev px-2 text-[13px] outline-none"
                />
              ) : (
                <span className={cx('flex-1 text-[14px] font-medium transition-colors', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
              )}
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button aria-label="Edit task" onClick={() => setEditing({ id: t.id, text: t.title })} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-elev hover:text-foreground">
                  <Pencil size={13} />
                </button>
                <button
                  aria-label="Delete task"
                  onClick={() => {
                    setTasks((ts) => ts.filter((x) => x.id !== t.id))
                    notify('Task deleted')
                  }}
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-elev hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
          {!loading && list.length === 0 && <li className="py-8 text-center text-xs text-muted-foreground">Nothing here yet</li>}
        </ul>
      </div>
    </Card>
  )
}

function Calendar() {
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [sel, setSel] = useState(today)
  const cells = useMemo(() => {
    const start = new Date(view)
    start.setDate(1 - view.getDay())
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
    const weeks = Math.ceil((view.getDay() + days) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [view])
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  return (
    <Card className="p-4">
      <h3 className="text-[16px] font-semibold text-foreground">Calendar</h3>
      <p className="text-[14px] text-muted-foreground">{sel.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      <div className="mx-auto mt-14 w-full max-w-[320px] pb-2">
        <div className="flex items-center justify-between">
          <button aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="grid size-7 place-items-center rounded-full transition-colors hover:bg-fg/10">
            <ChevronLeft size={16} />
          </button>
          <span key={view.toISOString()} className="text-[14px] font-semibold animate-fade-up">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <button aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="grid size-7 place-items-center rounded-full transition-colors hover:bg-fg/10">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-y-[5px] text-center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="pb-2 text-[12px] text-muted-foreground">{d}</span>
          ))}
          {cells.map((d) => {
            const inMonth = d.getMonth() === view.getMonth()
            const isSel = same(d, sel)
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSel(d)}
                className={cx(
                  'mx-auto grid size-9 place-items-center rounded-[3px] text-[16px] tabular-nums transition-colors duration-150',
                  isSel ? 'bg-[#2c2c2c] text-[#f5f7f8] dark:bg-[#e5e5e5] dark:text-[#151515]' : 'hover:bg-fg/10',
                  !inMonth && !isSel && 'text-muted-foreground',
                  same(d, today) && !isSel && 'ring-1 ring-fg/30',
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default function Overview({ onOpen }: { onOpen: (nav: AdminNavigation) => void }) {
  const [dateRange, setDateRange] = useState<DashboardDateRange>(() => defaultThisMonthRange())
  const [calendarApplySeq, setCalendarApplySeq] = useState(0)
  return (
    <>
      <PageHeader
        crumbs={['Dashboard']}
        title="Dashboard"
        subtitle="Monitor key metrics and manage your platform"
        actions={
          <>
            <DateRangePicker
              value={dateRange}
              onApply={(next) => {
                setDateRange(next)
                setCalendarApplySeq((n) => n + 1)
              }}
            />
            <ExportMenu />
          </>
        }
      />
      <div id="dashboard-image-export" className="dashboard-surfaces grid gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Hero getGreeting={adminGreeting} />
          <AdminSummaryCards onOpen={onOpen} />
          <div className="grid gap-4 lg:grid-cols-2">
            <QuickTasks />
            <Calendar />
          </div>
          <AuditActivity dateRange={dateRange} calendarApplySeq={calendarApplySeq} />
        </div>
        <div className="min-w-0 space-y-4">
          <Insights />
          <SignInActivity dateRange={dateRange} calendarApplySeq={calendarApplySeq} />
          <UsersByRole />
        </div>
      </div>
    </>
  )
}
