/*
 * Shared read-only selectors for the System Admin dashboard, Users, and Security.
 * They read the existing browser-storage prototype store and never create records.
 */
import { liveSessions } from '../auth/session'
import { ROLES, lockInfo, type Account, type AttemptResult, type AuditEvent, type DemoState, type LifecycleStatus, type LoginAttempt, type LoginLock, type Role } from '../auth/store'
import { dayStart, dayEnd } from '../auth/manilaTime'

const HOUR = 60 * 60_000
const DAY = 24 * HOUR

/** Security counts a failed sign-in for 24 hours after it happens. */
export const FAILED_SIGN_IN_WINDOW_MS = DAY
export const isWithinFailedSignInWindow = (attempt: Pick<LoginAttempt, 'at'>, now: number) => attempt.at >= now - FAILED_SIGN_IN_WINDOW_MS && attempt.at <= now
export const isRecentFailedSignIn = (attempt: LoginAttempt, now: number) => attempt.result === 'Failed' && isWithinFailedSignInWindow(attempt, now)
export const countRecentFailedSignIns = (attempts: readonly LoginAttempt[], now: number) => attempts.filter((attempt) => isRecentFailedSignIn(attempt, now)).length

export const nonDeletedAccounts = (accounts: readonly Account[]) => accounts.filter((account) => !account.deletedAt)

/** Non-deleted accounts whose temporary login lock has not expired, newest lock expiry first. */
export function lockedAccountRows(state: Readonly<DemoState>, now: number): { lock: LoginLock; acct: Account }[] {
  return state.locks
    .map((lock) => ({ lock, acct: state.accounts.find((account) => account.id === lock.accountId) }))
    .filter((row): row is { lock: LoginLock; acct: Account } => !!row.acct && !row.acct.deletedAt && lockInfo(row.acct.id, now).locked)
    .sort((a, b) => b.lock.lockedUntil! - a.lock.lockedUntil!)
}

export function adminSummary(state: Readonly<DemoState>, now: number) {
  return {
    totalUsers: nonDeletedAccounts(state.accounts).length,
    activeSessions: liveSessions(now).length,
    failedSignIns24h: countRecentFailedSignIns(state.loginAttempts, now),
    lockedAccounts: lockedAccountRows(state, now).length,
  }
}

/* ---------- Role and status breakdown ---------- */

export const CHART_ROLES = ROLES.filter((role): role is Exclude<Role, 'System Admin'> => role !== 'System Admin')
export const CHART_STATUSES: LifecycleStatus[] = ['Active', 'Pending Activation', 'Inactive']

export function usersByRoleAndStatus(accounts: readonly Account[]) {
  const users = nonDeletedAccounts(accounts)
  return CHART_ROLES.map((role) => {
    const counts = Object.fromEntries(CHART_STATUSES.map((status) => [status, users.filter((account) => account.role === role && account.status === status).length])) as Record<LifecycleStatus, number>
    return { role, counts, total: CHART_STATUSES.reduce((sum, status) => sum + counts[status], 0) }
  })
}

/** Current distribution across the four non-admin roles, including every lifecycle status. */
export function usersByRole(accounts: readonly Account[]) {
  const counts = usersByRoleAndStatus(accounts)
  const total = counts.reduce((sum, row) => sum + row.total, 0)
  const peak = Math.max(0, ...counts.map((row) => row.total))
  return counts.map((row) => ({
    role: row.role,
    count: row.total,
    percentage: total ? row.total / total * 100 : 0,
    largest: total > 0 && row.total === peak,
  }))
}

/* ---------- GMT+8 time buckets ---------- */

export const DASHBOARD_TIME_ZONE = 'Asia/Manila'
export const DASHBOARD_TIME_ZONE_LABEL = 'GMT+8'
const GMT8_OFFSET = 8 * HOUR

export interface TimeBucket {
  start: number
  end: number
  label: string
  fullLabel: string
}

const hourLabel = new Intl.DateTimeFormat('en-US', { timeZone: DASHBOARD_TIME_ZONE, hour: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: DASHBOARD_TIME_ZONE, month: 'short', day: 'numeric' })
const fullHourLabel = new Intl.DateTimeFormat('en-US', { timeZone: DASHBOARD_TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const fullDayLabel = new Intl.DateTimeFormat('en-US', { timeZone: DASHBOARD_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

/** Consecutive GMT+8 intervals ending with the one containing `now`; every interval is present, including empty ones. */
export function timeBuckets(now: number, unit: 'hour' | 'day', count: number): TimeBucket[] {
  const size = unit === 'hour' ? HOUR : DAY
  const current = Math.floor((now + GMT8_OFFSET) / size) * size - GMT8_OFFSET
  return Array.from({ length: count }, (_, index) => {
    const start = current - (count - 1 - index) * size
    const end = start + size
    return unit === 'hour'
      ? { start, end, label: hourLabel.format(start), fullLabel: `${fullHourLabel.format(start)} – ${hourLabel.format(end)} ${DASHBOARD_TIME_ZONE_LABEL}` }
      : { start, end, label: dayLabel.format(start), fullLabel: `${fullDayLabel.format(start)} ${DASHBOARD_TIME_ZONE_LABEL}` }
  })
}

/** Index of the bucket containing `at`, or -1 outside the range or in the future. */
export function bucketIndex(buckets: readonly TimeBucket[], at: number, now: number) {
  if (at > now) return -1
  return buckets.findIndex((bucket, index) => at >= bucket.start && (at < bucket.end || (index === buckets.length - 1 && at === bucket.end)))
}

/** Exact rolling day, split at Manila hour boundaries with partial end buckets. */
export function rollingSignInBuckets(now: number): TimeBucket[] {
  const start = now - FAILED_SIGN_IN_WINDOW_MS
  return timeBuckets(now, 'hour', 25)
    .filter((bucket) => bucket.end > start && bucket.start <= now)
    .map((bucket) => ({ ...bucket, start: Math.max(start, bucket.start), end: Math.min(now, bucket.end) }))
}

export function countByBucket<T extends { at: number }>(records: readonly T[], buckets: readonly TimeBucket[], now: number) {
  const counts = buckets.map(() => 0)
  for (const record of records) {
    const index = bucketIndex(buckets, record.at, now)
    if (index >= 0) counts[index]++
  }
  return counts
}

export const SIGN_IN_RESULTS: AttemptResult[] = ['Success', 'Failed', 'Blocked']

export function signInSeries(attempts: readonly LoginAttempt[], buckets: readonly TimeBucket[], now: number) {
  return Object.fromEntries(SIGN_IN_RESULTS.map((result) => [result, countByBucket(attempts.filter((attempt) => attempt.result === result), buckets, now)])) as Record<AttemptResult, number[]>
}

/**
 * The prototype keeps a capped number of records. When the cap is reached and the oldest kept
 * record is newer than the requested range, earlier intervals may be missing data.
 */
export function historyCoverage(records: readonly { at: number }[], limit: number, rangeStart: number) {
  const oldest = records.reduce((min, record) => Math.min(min, record.at), Infinity)
  const truncated = records.length >= limit
  return { truncated, oldest: Number.isFinite(oldest) ? oldest : null, incomplete: truncated && oldest > rangeStart }
}

/* ---------- Manila calendar dates, date-range buckets, Insights & Audit breakdown ---------- */

const manilaYmdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: DASHBOARD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function toManilaYmd(t: number): string {
  return manilaYmdFmt.format(t)
}

export function addDaysToYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d + delta)
  const dt = new Date(utc)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function subtractMonthsFromYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const targetMonthIndex = (y * 12 + (m - 1)) - months
  const targetYear = Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(d, maxDay)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

export function manilaRangeBounds(fromYmd: string, toYmd: string) {
  return {
    start: dayStart(fromYmd) ?? 0,
    end: dayEnd(toYmd) ?? Date.now(),
  }
}

export function dayBucketsForRange(fromYmd: string, toYmd: string): TimeBucket[] {
  const start = dayStart(fromYmd)
  const end = dayStart(toYmd)
  if (start === null || end === null || start > end) return []
  const buckets: TimeBucket[] = []
  const totalDays = Math.min(366, Math.round((end - start) / DAY) + 1)
  for (let i = 0; i < totalDays; i++) {
    const s = start + i * DAY
    const e = s + DAY - 1
    buckets.push({
      start: s,
      end: e,
      label: dayLabel.format(s),
      fullLabel: `${fullDayLabel.format(s)} ${DASHBOARD_TIME_ZONE_LABEL}`,
    })
  }
  return buckets
}

export function hourBucketsForDay(ymd: string): TimeBucket[] {
  const start = dayStart(ymd)
  if (start === null) return []
  return Array.from({ length: 24 }, (_, i) => {
    const s = start + i * HOUR
    const e = s + HOUR - 1
    return {
      start: s,
      end: e,
      label: hourLabel.format(s),
      fullLabel: `${fullHourLabel.format(s)} – ${hourLabel.format(s + HOUR)} ${DASHBOARD_TIME_ZONE_LABEL}`,
    }
  })
}

function manilaYearMonth(t: number) {
  const d = new Date(t + GMT8_OFFSET)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
}

export function insightsMetrics(state: Readonly<DemoState>, now: number) {
  const totalCreated = state.accounts.length
  const nonDeleted = nonDeletedAccounts(state.accounts)
  const activeAccounts = nonDeleted.filter((a) => a.status === 'Active')
  const pendingAccounts = nonDeleted.filter((a) => a.status === 'Pending Activation')
  const inactiveAccounts = nonDeleted.filter((a) => a.status === 'Inactive')

  const cur = manilaYearMonth(now)
  const prev = cur.month === 0 ? { year: cur.year - 1, month: 11 } : { year: cur.year, month: cur.month - 1 }
  const createdThisMonth = state.accounts.filter((a) => {
    const p = manilaYearMonth(a.createdAt)
    return p.year === cur.year && p.month === cur.month && a.createdAt <= now
  }).length
  const createdLastMonth = state.accounts.filter((a) => {
    const p = manilaYearMonth(a.createdAt)
    return p.year === prev.year && p.month === prev.month
  }).length

  const userGrowth = createdLastMonth === 0 ? null : Math.round(((createdThisMonth - createdLastMonth) / createdLastMonth) * 100)

  const todayStart = Math.floor((now + GMT8_OFFSET) / DAY) * DAY - GMT8_OFFSET
  const activeIds = new Set(activeAccounts.map((a) => a.id))
  const signedInTodayIds = new Set<number>()
  for (const att of state.loginAttempts) {
    if (att.result === 'Success' && att.at >= todayStart && att.at <= now && att.accountId !== null && activeIds.has(att.accountId)) {
      signedInTodayIds.add(att.accountId)
    }
  }
  const engagementRate = activeAccounts.length === 0 ? null : Math.round((signedInTodayIds.size / activeAccounts.length) * 100)

  const retention = totalCreated === 0 ? null : Math.round(((activeAccounts.length + pendingAccounts.length) / totalCreated) * 100)
  const activeUsersPct = totalCreated === 0 ? null : Math.round((activeAccounts.length / totalCreated) * 100)
  const pendingUsersPct = totalCreated === 0 ? null : Math.round((pendingAccounts.length / totalCreated) * 100)
  const inactiveUsersPct = totalCreated === 0 ? null : Math.round((inactiveAccounts.length / totalCreated) * 100)

  return {
    totalCreated,
    trends: { userGrowth, engagementRate, retention },
    account: { activeUsersPct, pendingUsersPct, inactiveUsersPct },
  }
}

export type OperationalRole = Exclude<Role, 'System Admin'>

export const OPERATIONAL_ROLES: readonly OperationalRole[] = [
  'Executive',
  'Event Manager',
  'Warehouse Operations Manager',
  'Ground Crew',
]

export const WORK_AUDIT_ACTIONS: ReadonlySet<string> = new Set([
  'Account edited',
  'Password changed',
  'Pitch created',
  'Pitch updated',
  'Pitch approved',
  'Pitch deleted',
  'Mood board created',
  'Mood board updated',
  'Mood board deleted',
  'Approval published',
  'Stock allocated',
  'Dispatch batch created',
  'Dispatch batch updated',
  'Dispatch batch stage updated',
  'Dispatch batch deleted',
  'Loading checklist submitted',
  'Venue arrival confirmed',
  'Warehouse arrival confirmed',
  'Return count submitted',
  'Return checklist submitted',
  'Warehouse accountability closed',
  'Vendor created',
  'Vendor updated',
  'Vendor deleted',
  'Acquisition created',
  'Acquisition received',
  'Production job updated',
  'Incident reported',
])

export function isOperationalWorkAuditEvent(event: AuditEvent): event is AuditEvent & { actorRole: OperationalRole } {
  return (
    event.result === 'Success' &&
    (OPERATIONAL_ROLES as readonly string[]).includes(event.actorRole) &&
    WORK_AUDIT_ACTIONS.has(event.action)
  )
}

export function operationalAuditSeries(
  events: readonly AuditEvent[],
  buckets: readonly TimeBucket[],
  now: number,
): Record<OperationalRole, number[]> {
  const counts = Object.fromEntries(
    OPERATIONAL_ROLES.map((role) => [role, buckets.map(() => 0)]),
  ) as Record<OperationalRole, number[]>
  for (const event of events) {
    if (!isOperationalWorkAuditEvent(event)) continue
    const idx = bucketIndex(buckets, event.at, now)
    if (idx >= 0) counts[event.actorRole][idx]++
  }
  return counts
}

export type AuditBucketBreakdown = {
  total: number
  byRole: [string, number][]
  byAction: [string, number][]
}

export function auditDayBreakdown(events: readonly AuditEvent[], buckets: readonly TimeBucket[], now: number): AuditBucketBreakdown[] {
  const roleMaps = buckets.map(() => new Map<string, number>())
  const actionMaps = buckets.map(() => new Map<string, number>())
  const totals = buckets.map(() => 0)
  for (const ev of events) {
    const idx = bucketIndex(buckets, ev.at, now)
    if (idx < 0) continue
    totals[idx]++
    const r = ev.actorRole || 'System'
    roleMaps[idx].set(r, (roleMaps[idx].get(r) ?? 0) + 1)
    actionMaps[idx].set(ev.action, (actionMaps[idx].get(ev.action) ?? 0) + 1)
  }
  return buckets.map((_, idx) => ({
    total: totals[idx],
    byRole: Array.from(roleMaps[idx].entries()).sort((a, b) => b[1] - a[1]),
    byAction: Array.from(actionMaps[idx].entries()).sort((a, b) => b[1] - a[1]),
  }))
}
