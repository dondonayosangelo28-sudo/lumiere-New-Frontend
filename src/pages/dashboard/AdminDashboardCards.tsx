import { dropdownItem, dropdownSurface } from '../../components/ui/Dropdown'
import { useCloseOnOverlay, useOverlayContainer } from '../../components/overlay/OverlayLayer'
import { Select } from '@base-ui/react/select'
import { useEffect, useId, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from 'react'
import { BriefcaseBusiness, CalendarDays, Check, HardHat, Warehouse, ChevronDown, History, MonitorSmartphone, ShieldAlert, TriangleAlert, Users } from 'lucide-react'
import { Card, cx } from '../../components/ui/ui'
import StatCards from '../../components/dashboard/StatCards'
import type { StatCardData } from '../../components/dashboard/StatCards/types'
import { comparisonTrend, precedingFailedSignIns } from '../../dashboard/summaryTrends'
import { seedActivityHistoryDemo } from '../../dashboard/seedActivityHistoryDemo'
import { sampleSummaryHistory, summarySnapshot24hAgo } from '../../dashboard/summarySnapshots'
import { snapshotComparisonTrend } from '../../dashboard/summaryComparisonPreview'
import { useNow } from '../../components/admin/AdminKit'
import { currentSession } from '../../auth/session'
import type { AdminNavigation } from '../../components/admin/adminNavigation'
import { accountsVersion, subscribeAccounts } from '../../auth/mockAuthService'
import { prototypeStorageLimits } from '../../auth/prototypeStorageLimits'
import { getState, update, type AttemptResult } from '../../auth/store'
import {
  DASHBOARD_TIME_ZONE, DASHBOARD_TIME_ZONE_LABEL, OPERATIONAL_ROLES, SIGN_IN_RESULTS, addDaysToYmd, adminSummary, dayBucketsForRange, historyCoverage, hourBucketsForDay, manilaRangeBounds, operationalAuditSeries, signInSeries, subtractMonthsFromYmd, timeBuckets, rollingSignInBuckets, toManilaYmd, usersByRole, type OperationalRole, type TimeBucket,
} from '../../dashboard/dashboardMetrics'
import type { DashboardDateRange } from './OverviewExtras'

type Open = (nav: AdminNavigation) => void

/** Re-renders whenever the shared prototype store changes, including from other tabs. */
function useStoreState() {
  useSyncExternalStore(subscribeAccounts, accountsVersion)
  return getState()
}

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`
const coverageDate = new Intl.DateTimeFormat('en-US', { timeZone: DASHBOARD_TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/* ---------- Summary cards ---------- */

export function AdminSummaryCards({ onOpen }: { onOpen: Open }) {
  useEffect(() => { seedActivityHistoryDemo() }, [])
  const state = useStoreState()
  // Ticks every second so sessions and locks drop out as soon as they expire.
  const now = useNow(1000)
  const summary = adminSummary(state, now)
  useEffect(() => {
    const current = getState()
    const sampledAt = Date.now()
    const history = current.summaryHistory ?? []
    const next = sampleSummaryHistory(history, adminSummary(current, sampledAt), sampledAt)
    if (next !== history) update((draft) => { draft.summaryHistory = next })
  }, [now])
  const previous = summarySnapshot24hAgo(state.summaryHistory ?? [], now)
  const comparisonCoverage = historyCoverage(state.loginAttempts, prototypeStorageLimits.loginAttempts, now - 2 * 86_400_000)
  const failedTrend = comparisonTrend(summary.failedSignIns24h, comparisonCoverage.incomplete ? null : precedingFailedSignIns(state.loginAttempts, now), true)
  const cards: StatCardData[] = [
    { id: 'total-users', title: 'Total Users', value: summary.totalUsers, icon: Users, trend: snapshotComparisonTrend('totalUsers', summary.totalUsers, previous) },
    { id: 'active-sessions', title: 'Active Sessions', value: summary.activeSessions, icon: MonitorSmartphone, trend: snapshotComparisonTrend('activeSessions', summary.activeSessions, previous) },
    { id: 'failed-sign-ins', title: 'Failed Logins', value: summary.failedSignIns24h, icon: TriangleAlert, trend: failedTrend },
    { id: 'locked-accounts', title: 'Locked Accounts', value: summary.lockedAccounts, icon: ShieldAlert, trend: snapshotComparisonTrend('lockedAccounts', summary.lockedAccounts, previous) },
  ]
  return (
    <StatCards key={currentSession()?.accountId ?? 'signed-out'} userId={currentSession()?.accountId ?? 0} data={cards} gridCols="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" gap="gap-4" />
  )
}

/* ---------- Shared chart pieces ---------- */

function CardHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        <p className="text-[14px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function RangeMenu<T extends string>({
  label,
  value,
  options,
  triggerLabel,
  onSelectPreset,
}: {
  label: string
  value: T | null
  options: readonly T[]
  triggerLabel: string
  onSelectPreset: (preset: T) => void
}) {
  const container = useOverlayContainer()
  const [open, setOpen] = useState(false)
  useCloseOnOverlay(() => setOpen(false))

  return (
    <Select.Root
      modal={false}
      open={open}
      onOpenChange={setOpen}
      value={value ?? ''}
      items={options.map((option) => ({ value: option, label: option }))}
      onValueChange={(next) => {
        if (next) onSelectPreset(next as T)
      }}
    >
      <Select.Trigger
        aria-label={label}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-sm bg-transparent px-0.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:ring-2 focus-visible:ring-fg/30"
      >
        <span className="whitespace-nowrap">{triggerLabel}</span>
        <ChevronDown size={12} aria-hidden className="shrink-0 text-muted-foreground" />
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner align="end" sideOffset={6} collisionPadding={8} alignItemWithTrigger={false} className="z-[100] max-w-[calc(100vw-16px)]">
          <Select.Popup className={cx(dropdownSurface, 'min-w-[10.5rem] max-w-[calc(100vw-16px)]')}>
            <Select.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain">
              {options.map((option) => (
                <Select.Item key={option} value={option} className={cx(dropdownItem, 'justify-between')}>
                  <Select.ItemText className="min-w-0 whitespace-nowrap">{option}</Select.ItemText>
                  <Select.ItemIndicator><Check size={16} aria-hidden /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

function CoverageNote({ coverage, limit, noun }: { coverage: ReturnType<typeof historyCoverage>; limit: number; noun: string }) {
  if (!coverage.incomplete || coverage.oldest === null) return null
  return (
    <p className="mt-3 flex gap-1.5 text-[11px] leading-4 text-muted-foreground">
      <History size={12} aria-hidden className="mt-0.5 shrink-0" />
      Only the most recent {limit.toLocaleString()} {noun} are kept in this browser, so intervals before {coverageDate.format(coverage.oldest)} {DASHBOARD_TIME_ZONE_LABEL} may be incomplete.
    </p>
  )
}

type Series = { label: string; values: number[]; color: string }

function smoothPath(points: (readonly [number, number])[]) {
  // Horizontal tangents at each point keep the curve between neighboring values (no dips below zero).
  return points.reduce((path, [x, y], index) => {
    if (index === 0) return `M${x},${y}`
    const [px, py] = points[index - 1]
    const mid = px + (x - px) / 2
    return `${path} C${mid},${py} ${mid},${y} ${x},${y}`
  }, '')
}

function monotonePath(points: (readonly [number, number])[]) {
  if (points.length < 2) return smoothPath(points)
  const slopes = points.slice(1).map(([x, y], i) => (y - points[i][1]) / (x - points[i][0]))
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === points.length - 1) return slopes[i - 1]
    const a = slopes[i - 1], b = slopes[i]
    return a * b <= 0 ? 0 : 2 * a * b / (a + b)
  })
  return points.reduce((path, [x, y], i) => {
    if (!i) return `M${x},${y}`
    const [px, py] = points[i - 1]
    const dx = (x - px) / 3
    return `${path} C${px + dx},${py + tangents[i - 1] * dx} ${x - dx},${y - tangents[i] * dx} ${x},${y}`
  }, '')
}

function TimeChart({ buckets, series, variant, title, emptyMessage, height = 'h-40', stretch = false }: { buckets: TimeBucket[]; series: Series[]; variant: 'area' | 'stacked-bars' | 'total-area'; title: string; emptyMessage: string; height?: 'h-40' | 'h-56' | 'h-64' | 'h-64 xl:h-84' | 'h-96'; stretch?: boolean }) {
  const totalArea = variant === 'total-area'
  const area = variant === 'area' || totalArea
  const bars = variant === 'stacked-bars'
  const gradient = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = totalArea ? 300 : 320
  const H = totalArea ? 180 : 160
  const count = buckets.length
  const totals = buckets.map((_, index) => series.reduce((sum, s) => sum + s.values[index], 0))
  const plottedSeries = totalArea ? [{ label: 'Total attempts', values: totals, color: 'text-muted-foreground' }] : series
  const max = Math.max(0, ...(bars || totalArea ? totals : series.flatMap((s) => s.values)))
  const band = W / count
  const target = Math.max(1, max * 1.2)
  const magnitude = 10 ** Math.floor(Math.log10(target / 5))
  const niceStep = Math.max(1, Math.ceil(
    ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= target / 5) ?? 10) * magnitude,
  ))
  const step = area ? niceStep : Math.max(1, Math.ceil(max / 4))
  const intervals = area ? Math.ceil(target / step) : 4
  const top = step * intervals
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => (intervals - index) * step)
  const x = (index: number) => (bars ? (index + 0.5) * band : count === 1 ? W / 2 : (index / (count - 1)) * W)
  const y = (value: number) => H - (value / top) * H
  const labelEvery = Math.ceil(count / 6)
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    setHover(Math.max(0, Math.min(count - 1, bars ? Math.floor(ratio * count) : Math.round(ratio * (count - 1)))))
  }
  const hoverPct = hover === null ? 0 : (x(hover) / W) * 100
  return (
    <div className={cx('mt-4 flex gap-2', totalArea && 'px-2 pt-2', stretch && 'xl:min-h-0 xl:flex-1')}>
      <div aria-hidden className={cx('flex flex-col justify-between text-right text-[10px] leading-none tabular-nums text-muted-foreground', totalArea && 'w-7 shrink-0 text-[11px] font-normal text-[#858585]', height, stretch && 'xl:mb-5 xl:h-auto xl:self-stretch')}>
        {ticks.map((tick) => <span key={tick}>{tick}</span>)}
      </div>
      <div className={cx('relative min-w-0 flex-1', stretch && 'xl:flex xl:min-h-0 xl:flex-col')}>
        <div className={stretch ? cx('relative', height, 'xl:h-auto xl:min-h-0 xl:flex-1') : 'contents'}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cx('w-full touch-pan-y overflow-visible', stretch ? 'absolute inset-0 h-full' : height)} aria-hidden onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
            {!totalArea && (area ? ticks.slice(0, -1).map((tick) => 1 - tick / top) : [0, 0.25, 0.5, 0.75]).map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="stroke-line" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
            {totalArea && <g stroke="#454545" strokeWidth="1" vectorEffect="non-scaling-stroke">
              <path d={`M0,0 V${H} H${W}`} fill="none" vectorEffect="non-scaling-stroke" />
              {ticks.map((tick) => <line key={tick} x1="-4" x2="0" y1={y(tick)} y2={y(tick)} vectorEffect="non-scaling-stroke" />)}
              {buckets.map((bucket, i) => i === count - 1 || (i % labelEvery === 0 && count - 1 - i >= labelEvery / 2) ? <line key={bucket.start} x1={x(i)} x2={x(i)} y1={H} y2={H + 3} vectorEffect="non-scaling-stroke" /> : null)}
            </g>}
            {!totalArea && <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" vectorEffect="non-scaling-stroke" />}
            {bars && hover !== null && <rect x={hover * band} width={band} y="0" height={H} className="fill-fg/[0.06]" />}
            {bars && buckets.map((bucket, index) => {
              let base = H
              return (
                <g key={bucket.start}>
                  {series.map((s) => {
                    const barHeight = (s.values[index] / top) * H
                    base -= barHeight
                    return barHeight > 0 ? <rect key={s.label} x={x(index) - band * 0.32} width={band * 0.64} y={base} height={barHeight} fill="currentColor" className={s.color} /> : null
                  })}
                </g>
              )
            })}
            {area && plottedSeries.map((s, seriesIndex) => {
              const d = (totalArea ? monotonePath : smoothPath)(s.values.map((v, i) => [x(i), y(v)] as const))
              const gradientId = `${gradient}-${seriesIndex}`
              return (
                <g key={s.label} className={s.color}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={totalArea ? '#aebbc8' : 'currentColor'} stopOpacity={totalArea ? '0.5' : '0.28'} />
                      <stop offset="100%" stopColor={totalArea ? '#aebbc8' : 'currentColor'} stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={`${d} L${x(count - 1)},${H} L${x(0)},${H} Z`} fill={`url(#${gradientId})`} />
                  <path d={d} fill="none" stroke={totalArea ? '#b8c5d0' : 'currentColor'} strokeWidth={totalArea ? 1.5 : 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  {totalArea && hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r="3" fill="#b8c5d0" />}
                </g>
              )
            })}
            {area && hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-fg/30" vectorEffect="non-scaling-stroke" />}
          </svg>
          {hover !== null && (
            <div aria-hidden className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-line bg-card px-2 py-1.5 text-[11px] shadow-lg" style={{ left: `${hoverPct}%`, transform: `translateX(-${hoverPct}%)` }}>
              <p className="mb-0.5 font-semibold text-foreground">{buckets[hover].fullLabel}</p>
              {totalArea && <p className="font-semibold text-foreground">{totals[hover].toLocaleString()} {totals[hover] === 1 ? 'attempt' : 'attempts'}</p>}
              {series.map((s) => (
                <p key={s.label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cx('size-2 rounded-full bg-current', s.color)} />
                  <span className="text-foreground">{s.label}:</span> <span className="font-semibold tabular-nums text-foreground">{s.values[hover]}</span>
                </p>
              ))}
            </div>
          )}
          {max === 0 && (
            <div className={cx('pointer-events-none absolute inset-x-0 top-0 grid place-items-center', stretch ? 'h-full' : height)}>
              <p className="rounded-md bg-card/90 px-3 py-1.5 text-[13px] text-muted-foreground">{emptyMessage}</p>
            </div>
          )}
        </div>
        <div aria-hidden className={cx('relative mt-1 h-4 shrink-0 text-[10px] text-muted-foreground', totalArea && 'mt-2 text-[11px] font-normal text-[#858585]')}>
          {buckets.map((bucket, index) => index === count - 1 || (index % labelEvery === 0 && count - 1 - index >= labelEvery / 2) ? (
            <span key={bucket.start} className="absolute whitespace-nowrap" style={{ left: `${(x(index) / W) * 100}%`, transform: `translateX(-${(x(index) / W) * 100}%)` }}>{bucket.label}</span>
          ) : null)}
        </div>
        <div className="sr-only">
          <table>
            <caption>{title}</caption>
            <thead><tr><th scope="col">Interval ({DASHBOARD_TIME_ZONE_LABEL})</th>{totalArea && <th scope="col">Total attempts</th>}{series.map((s) => <th key={s.label} scope="col">{s.label}</th>)}</tr></thead>
            <tbody>{buckets.map((bucket, index) => <tr key={bucket.start}><th scope="row">{bucket.fullLabel}</th>{totalArea && <td>{totals[index]}</td>}{series.map((s) => <td key={s.label}>{s.values[index]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ---------- Sign-in Activity ---------- */

const SIGN_IN_RANGES = { 'Last 24 Hours': { unit: 'hour', count: 24 }, 'Last 30 Days': { unit: 'day', count: 30 } } as const
const SIGN_IN_PRESETS = ['Last 24 Hours', 'Last 30 Days'] as const
type SignInPreset = (typeof SIGN_IN_PRESETS)[number]
const RESULT_STYLE: Record<AttemptResult, { label: string; color: string }> = {
  Success: { label: 'Successful', color: 'text-emerald-500' },
  Failed: { label: 'Failed', color: 'text-red-500' },
  Blocked: { label: 'Blocked', color: 'text-amber-500' },
}

export function SignInActivity({ dateRange, calendarApplySeq = 0 }: { dateRange: DashboardDateRange; calendarApplySeq?: number }) {
  const state = useStoreState()
  const now = useNow(30_000)
  const [selection, setSelection] = useState<{ kind: 'preset'; preset: SignInPreset } | { kind: 'calendar' }>({
    kind: 'preset',
    preset: 'Last 24 Hours',
  })
  const [seenApplySeq, setSeenApplySeq] = useState(calendarApplySeq)
  useEffect(() => {
    if (calendarApplySeq !== seenApplySeq) {
      setSeenApplySeq(calendarApplySeq)
      setSelection({ kind: 'calendar' })
    }
  }, [calendarApplySeq, seenApplySeq])

  const isSingleDay = dateRange.fromYmd === dateRange.toYmd
  const isCalendar = selection.kind === 'calendar'
  const presetSpec = SIGN_IN_RANGES[isCalendar ? 'Last 24 Hours' : selection.preset]
  const buckets = isCalendar
    ? (isSingleDay ? hourBucketsForDay(dateRange.fromYmd) : dayBucketsForRange(dateRange.fromYmd, dateRange.toYmd))
    : selection.preset === 'Last 24 Hours'
      ? rollingSignInBuckets(now)
      : timeBuckets(now, presetSpec.unit, presetSpec.count)
  const rangeEffectiveEnd = isCalendar ? manilaRangeBounds(dateRange.fromYmd, dateRange.toYmd).end : now
  const counts = signInSeries(state.loginAttempts, buckets, rangeEffectiveEnd)
  const series = SIGN_IN_RESULTS.map((result) => ({ label: RESULT_STYLE[result].label, values: counts[result], color: RESULT_STYLE[result].color }))
  const coverageStart = buckets[0]?.start ?? now
  const coverage = historyCoverage(state.loginAttempts, prototypeStorageLimits.loginAttempts, coverageStart)
  const compactCalendarLabel = formatCompactDateRange(dateRange.fromYmd, dateRange.toYmd)
  const activeSubtitle = isCalendar
    ? `${isSingleDay ? 'Hourly' : 'Daily'} attempts · ${compactCalendarLabel}`
    : `Total attempts per ${presetSpec.unit}`
  const emptyText = isCalendar
    ? `No sign-in attempts in ${compactCalendarLabel}`
    : `No sign-in attempts in the ${selection.preset.toLowerCase()}`
  return (
    <Card className="p-4">
      <CardHeader title="Sign-in Activity" subtitle={activeSubtitle}>
        <RangeMenu
          label="Sign-in activity range"
          value={isCalendar ? null : selection.preset}
          options={SIGN_IN_PRESETS}
          triggerLabel={isCalendar ? compactCalendarLabel : selection.preset}
          onSelectPreset={(preset) => setSelection({ kind: 'preset', preset })}
        />
      </CardHeader>
      <TimeChart variant="total-area" height="h-64 xl:h-84" buckets={buckets} series={series} title={`Sign-in attempts, ${isCalendar ? compactCalendarLabel : selection.preset.toLowerCase()}`} emptyMessage={emptyText} />
      <dl className="mt-5 grid grid-cols-3 border-t border-line pt-4 text-center">
        {series.map((s) => (
          <div key={s.label}>
            <dd className="font-bold tabular-nums text-foreground">{s.values.reduce((sum, v) => sum + v, 0).toLocaleString()}</dd>
            <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>
      <CoverageNote coverage={coverage} limit={prototypeStorageLimits.loginAttempts} noun="sign-in attempts" />
    </Card>
  )
}

/* ---------- Audit Activity ---------- */

const AUDIT_PRESETS = ['Last 7 days', 'Last 30 days', 'Last 3 months'] as const
type AuditPreset = (typeof AUDIT_PRESETS)[number]

const shortMonthFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' })
const shortMonthDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const shortMonthDayYearFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

function parseYmdUtc(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d, ms: Date.UTC(y, m - 1, d) }
}

export function formatCompactDateRange(fromYmd: string, toYmd: string): string {
  const from = parseYmdUtc(fromYmd)
  const to = parseYmdUtc(toYmd)
  if (fromYmd === toYmd) return shortMonthDayFmt.format(from.ms)
  if (from.y === to.y && from.m === to.m) {
    return `${shortMonthFmt.format(from.ms)} ${from.d}–${to.d}`
  }
  if (from.y === to.y) {
    return `${shortMonthDayFmt.format(from.ms)} – ${shortMonthDayFmt.format(to.ms)}`
  }
  return `${shortMonthDayYearFmt.format(from.ms)} – ${shortMonthDayYearFmt.format(to.ms)}`
}

const OPERATIONAL_ROLE_SERIES: readonly { role: OperationalRole; label: string; color: string }[] = [
  { role: 'Executive', label: 'Executive', color: '#155dfc' },
  { role: 'Event Manager', label: 'Event Manager', color: '#51a2ff' },
  { role: 'Warehouse Operations Manager', label: 'Warehouse Operations Manager', color: '#8ec5ff' },
  { role: 'Ground Crew', label: 'Ground Crew', color: '#2b7fff' },
]

function AuditAreaChart({
  buckets,
  roleCounts,
}: {
  buckets: TimeBucket[]
  roleCounts: Record<OperationalRole, number[]>
}) {
  const gradient = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 560
  const H = 180
  const count = buckets.length
  const max = Math.max(0, ...OPERATIONAL_ROLE_SERIES.flatMap((s) => roleCounts[s.role]))
  const target = Math.max(1, max * 1.15)
  const magnitude = 10 ** Math.floor(Math.log10(target / 4))
  const step = Math.max(1, Math.ceil(([1, 2, 2.5, 5, 10].find((f) => f * magnitude >= target / 4) ?? 10) * magnitude))
  const intervals = Math.max(1, Math.ceil(target / step))
  const top = step * intervals
  const ticks = Array.from({ length: intervals + 1 }, (_, i) => (intervals - i) * step)
  const x = (index: number) => (count <= 1 ? W / 2 : (index / (count - 1)) * W)
  const y = (value: number) => H - (value / top) * H
  const labelEvery = Math.max(1, Math.ceil(count / 7))
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (!count) return
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
    setHover(count === 1 ? 0 : Math.round(ratio * (count - 1)))
  }
  const hoverPct = hover === null ? 0 : (x(hover) / W) * 100
  const layeredSeries = [...OPERATIONAL_ROLE_SERIES].sort((a, b) => {
    const sumA = roleCounts[a.role].reduce((s, v) => s + v, 0)
    const sumB = roleCounts[b.role].reduce((s, v) => s + v, 0)
    return sumB - sumA
  })

  return (
    <div className="mt-4 flex flex-col xl:min-h-0 xl:flex-1">
      <div className="flex gap-2 xl:min-h-0 xl:flex-1">
        <div aria-hidden className="flex h-56 flex-col justify-between text-right text-[10px] leading-none tabular-nums text-muted-foreground xl:mb-5 xl:h-auto xl:self-stretch">
          {ticks.map((tick) => <span key={tick}>{tick}</span>)}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative h-56 xl:h-auto xl:min-h-0 xl:flex-1">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full touch-pan-y overflow-visible"
              aria-hidden
              onPointerMove={pick}
              onPointerDown={pick}
              onPointerLeave={() => setHover(null)}
            >
              {ticks.slice(0, -1).map((tick) => {
                const fy = y(tick)
                return <line key={tick} x1="0" x2={W} y1={fy} y2={fy} className="stroke-line/70" vectorEffect="non-scaling-stroke" />
              })}
              <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" vectorEffect="non-scaling-stroke" />
              {count > 0 && layeredSeries.map((s) => {
                const values = roleCounts[s.role]
                const d = monotonePath(values.map((v, i) => [x(i), y(v)] as const))
                const gradId = `${gradient}-${s.role.replace(/\s+/g, '-')}`
                return (
                  <g key={s.role}>
                    <defs>
                      <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor={s.color} stopOpacity="0.45" />
                        <stop offset="95%" stopColor={s.color} stopOpacity="0.04" />
                      </linearGradient>
                    </defs>
                    <path d={`${d} L${x(count - 1)},${H} L${x(0)},${H} Z`} fill={`url(#${gradId})`} />
                    <path d={d} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </g>
                )
              })}
              {hover !== null && count > 0 && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-fg/30" vectorEffect="non-scaling-stroke" />
                  {OPERATIONAL_ROLE_SERIES.map((s) => (
                    <circle
                      key={s.role}
                      cx={x(hover)}
                      cy={y(roleCounts[s.role][hover])}
                      r="3.5"
                      fill={s.color}
                      stroke="var(--card)"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </>
              )}
            </svg>
            {hover !== null && count > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 z-10 min-w-48 max-w-64 rounded-lg border border-line bg-card/95 px-2.5 py-2 text-[11px] shadow-lg backdrop-blur"
                style={{ left: `${hoverPct}%`, transform: `translateX(-${hoverPct}%)` }}
              >
                <p className="mb-1 font-semibold text-foreground">{buckets[hover].fullLabel}</p>
                <div className="space-y-0.5">
                  {OPERATIONAL_ROLE_SERIES.map((s) => (
                    <p key={s.role} className="flex items-center justify-between gap-3 text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
                        <span className="truncate text-foreground">{s.label}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{roleCounts[s.role][hover]}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div aria-hidden className="relative mt-1.5 h-4 shrink-0 text-[10px] text-muted-foreground">
            {buckets.map((bucket, index) =>
              index === count - 1 || (index % labelEvery === 0 && count - 1 - index >= labelEvery / 2) ? (
                <span
                  key={bucket.start}
                  className="absolute whitespace-nowrap"
                  style={{ left: `${(x(index) / W) * 100}%`, transform: `translateX(-${(x(index) / W) * 100}%)` }}
                >
                  {bucket.label}
                </span>
              ) : null,
            )}
          </div>
          <div className="sr-only">
            <table>
              <caption>Operational role work actions per day</caption>
              <thead>
                <tr>
                  <th scope="col">Date ({DASHBOARD_TIME_ZONE_LABEL})</th>
                  {OPERATIONAL_ROLE_SERIES.map((s) => <th key={s.role} scope="col">{s.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, i) => (
                  <tr key={bucket.start}>
                    <th scope="row">{bucket.fullLabel}</th>
                    {OPERATIONAL_ROLE_SERIES.map((s) => <td key={s.role}>{roleCounts[s.role][i]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        {OPERATIONAL_ROLE_SERIES.map((s) => (
          <li key={s.role} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-foreground/90">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AuditActivity({ dateRange, calendarApplySeq = 0 }: { dateRange: DashboardDateRange; calendarApplySeq?: number }) {
  const state = useStoreState()
  const now = useNow(30_000)
  const [selection, setSelection] = useState<{ kind: 'preset'; preset: AuditPreset } | { kind: 'calendar' }>({
    kind: 'preset',
    preset: 'Last 7 days',
  })
  const [seenApplySeq, setSeenApplySeq] = useState(calendarApplySeq)
  useEffect(() => {
    if (calendarApplySeq !== seenApplySeq) {
      setSeenApplySeq(calendarApplySeq)
      setSelection({ kind: 'calendar' })
    }
  }, [calendarApplySeq, seenApplySeq])

  const todayYmd = toManilaYmd(now)
  const [fromYmd, toYmd] =
    selection.kind === 'calendar'
      ? [dateRange.fromYmd, dateRange.toYmd]
      : selection.preset === 'Last 3 months'
        ? [subtractMonthsFromYmd(todayYmd, 3), todayYmd]
        : selection.preset === 'Last 30 days'
          ? [addDaysToYmd(todayYmd, -29), todayYmd]
          : [addDaysToYmd(todayYmd, -6), todayYmd]

  const buckets = dayBucketsForRange(fromYmd, toYmd)
  const effectiveEnd = manilaRangeBounds(fromYmd, toYmd).end
  const roleCounts = operationalAuditSeries(state.audit, buckets, effectiveEnd)
  const total = OPERATIONAL_ROLES.reduce(
    (sum, role) => sum + roleCounts[role].reduce((roleSum, v) => roleSum + v, 0),
    0,
  )
  const coverageStart = buckets[0]?.start ?? now
  const coverage = historyCoverage(state.audit, prototypeStorageLimits.auditEvents, coverageStart)
  const compactCalendarLabel = formatCompactDateRange(dateRange.fromYmd, dateRange.toYmd)
  const triggerLabel = selection.kind === 'calendar' ? compactCalendarLabel : selection.preset
  const subtitleRange = selection.kind === 'calendar' ? compactCalendarLabel : selection.preset
  const footerRange = selection.kind === 'calendar' ? compactCalendarLabel : `the ${selection.preset.toLowerCase()}`
  return (
    <Card className="flex flex-col p-4 xl:min-h-0 xl:flex-1">
      <CardHeader title="Audit Activity" subtitle={`Work actions by operational role · ${subtitleRange}`}>
        <RangeMenu
          label="Audit activity range"
          value={selection.kind === 'preset' ? selection.preset : null}
          options={AUDIT_PRESETS}
          triggerLabel={triggerLabel}
          onSelectPreset={(preset) => setSelection({ kind: 'preset', preset })}
        />
      </CardHeader>
      <AuditAreaChart buckets={buckets} roleCounts={roleCounts} />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-line pt-4 text-center">
        <p className="text-[13px] text-muted-foreground"><span className="font-bold tabular-nums text-foreground">{total.toLocaleString()}</span> {total === 1 ? 'action' : 'actions'} in {footerRange}</p>
      </div>
      <CoverageNote coverage={coverage} limit={prototypeStorageLimits.auditEvents} noun="audit events" />
    </Card>
  )
}

/* ---------- Users by Role ---------- */

const ROLE_PRESENTATION = {
  Executive: { label: 'Executive', icon: BriefcaseBusiness },
  'Event Manager': { label: 'Event Manager', icon: CalendarDays },
  'Warehouse Operations Manager': { label: 'Warehouse Operations Manager', icon: Warehouse },
  'Ground Crew': { label: 'Ground Crew', icon: HardHat },
}
const rolePercentage = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`

export function UsersByRole() {
  const state = useStoreState()
  const rows = usersByRole(state.accounts)
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const leaders = rows.filter((row) => row.largest)
  const peak = Math.max(0, ...rows.map((row) => row.percentage))
  const gridInterval = Math.max(10, peak) / 4
  const gridIntervals = 5
  const scale = gridInterval * gridIntervals
  const [active, setActive] = useState<string | null>(null)
  const tooltipId = useId()
  const selected = rows.find((row) => row.role === active)
  return (
    <Card className="p-4">
      <CardHeader title="Users by Role" subtitle="Current user distribution" />
      <div className="relative mt-5">
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-64 w-full xl:h-44">
          {Array.from({ length: gridIntervals }, (_, index) => index / gridIntervals * 100).map((position) => <line key={`h-${position}`} x1="0" x2="100" y1={position} y2={position} className="stroke-foreground/15" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
          {[12.5, 37.5, 62.5, 87.5].map((position) => <line key={`v-${position}`} x1={position} x2={position} y1="0" y2="100" className="stroke-foreground/15" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-64 border-b border-line xl:top-44" />
        <div className="relative mx-auto grid w-full max-w-64 grid-cols-4 gap-6 sm:max-w-72 sm:gap-8">
          {rows.map((row) => {
            const { label, icon: Icon } = ROLE_PRESENTATION[row.role]
            return (
              <div key={row.role} tabIndex={0} role="img"
                className="group flex min-w-0 cursor-default flex-col items-center outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                aria-label={`${row.role}: ${plural(row.count, 'user')}, ${rolePercentage(row.percentage)}.`}
                aria-describedby={active === row.role ? tooltipId : undefined}
                onPointerEnter={(event) => { if (event.pointerType !== 'touch') setActive(row.role) }}
                onPointerLeave={(event) => { if (event.pointerType !== 'touch') setActive(null) }}
                onFocus={() => setActive(row.role)} onBlur={() => setActive(null)}
                onPointerDown={() => setActive(row.role)}
                onKeyDown={(event) => { if (event.key === 'Escape') setActive(null) }}
              >
                <span aria-hidden className="relative block h-64 w-10 max-w-full sm:w-12 xl:h-44">
                  <span className={cx('absolute inset-x-0 bottom-0 flex items-center justify-center rounded-t-md transition-[height,opacity] duration-300 group-hover:opacity-80 motion-reduce:transition-none', row.largest ? 'bg-[#b8c2d0]' : 'bg-[#6e747d]')} style={{ height: `${row.percentage / scale * 100}%` }}>
                    <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap text-xs font-bold tabular-nums text-foreground sm:text-sm">{rolePercentage(row.percentage)}</span>
                  </span>
                </span>
                <Icon className="mt-3 size-5 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-hidden />
                <span aria-hidden className="mt-2 w-[calc(100%+1.5rem)] whitespace-normal break-normal text-center text-[11px] font-medium leading-4 text-foreground sm:text-xs">{label}</span>
              </div>
            )
          })}
        </div>
        {selected && <div id={tooltipId} role="tooltip" className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-fit max-w-full rounded-md border border-line bg-card px-3 py-2 text-center text-xs text-foreground shadow-lg">
          <p className="font-semibold">{selected.role}</p>
          <p>{plural(selected.count, 'user')} · {rolePercentage(selected.percentage)}</p>
        </div>}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-sm leading-5 text-muted-foreground">
        {total === 0 ? 'No users in these roles yet.' : leaders.length === 4
          ? `All four roles share the largest share at ${rolePercentage(leaders[0].percentage)} each.`
          : leaders.length > 1
            ? `${leaders.map((row) => row.role).join(' and ')} tie for the largest share at ${rolePercentage(leaders[0].percentage)} each.`
            : `${leaders[0].role} has the largest share: ${rolePercentage(leaders[0].percentage)} of users across these four roles.`}
      </p>
    </Card>
  )
}
