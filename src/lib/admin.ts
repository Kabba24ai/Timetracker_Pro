// TimeTracker V2 — admin review/reporting API layer.
//
// Thin wrappers over the master-admin-only V2 endpoints:
//   GET  /admin/employees/{id}/time-review — per-day pay-period correction grid
//   POST /admin/corrections                — append-only adjust / void / insert /
//                                            insert_break (atomic break pair)
//
// The server enforces the master_admin role, owns all payroll math, and returns
// authoritative state; this layer only shuttles data.

import { api, ApiEnvelope } from './api';
import { formatDuration } from './timeclock';
import { formatClock } from './tz';

export interface AdminEmployee {
  id: number;
  full_name: string;
}

// One row of the immutable ledger (mirrors ClockEventResource; the Time Review
// day payload adds `superseded`).
export interface ClockEventRow {
  id: number;
  // pending_close = the system Missing-Clock-Out boundary marker (non-timekeeping).
  kind: 'clock_in' | 'clock_out' | 'lunch_start' | 'lunch_end' | 'other_start' | 'other_end' | 'pending_close';
  kind_label: string;
  raw_at: string | null;
  effective_at: string | null;
  source: 'employee' | 'admin' | 'system';
  actor_id: number | null;
  correction_type: string | null;
  corrects_event_id: number | null;
  reason: string | null;
  shift_id: number | null;
  break_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  superseded?: boolean;
}

// `delete` = a cascading, append-only removal from the EFFECTIVE record: the
// server decides the dependent set (whole shift for a clock-in, the paired
// interval for a lunch/break, itself for a clock-out) and voids it atomically.
// Nothing is physically erased; the immutable ledger is preserved.
// `edit_break` = ONE atomic logical edit of an EXISTING lunch/break interval:
// move either or both endpoints, or complete a one-sided interval. The server
// validates the FINAL sequence once (no temporary intermediate state), leaves
// an unchanged endpoint completely untouched, and applies all-or-nothing.
// `resolve_pending_clock_out` = the verified admin Clock Out SUPERSEDES the
// system PendingClose marker (never an ordinary insert, which the state
// machine rightly rejects once the marker has returned the employee to OFF).
export type CorrectionType = 'adjust' | 'void' | 'insert' | 'insert_break' | 'edit_break' | 'resolve_pending_clock_out' | 'delete';
export type CorrectableKind = ClockEventRow['kind'];
export type BreakKind = 'lunch' | 'other';

export interface CorrectionPayload {
  type: CorrectionType;
  event_id?: number; // adjust | void | delete
  user_id?: number; // insert | insert_break
  kind?: CorrectableKind; // insert
  effective_at?: string; // adjust | insert (ISO 8601, UTC from tenant wall-clock)
  break_type?: BreakKind; // insert_break | edit_break
  start_at?: string; // insert_break | edit_break (ISO 8601)
  end_at?: string; // insert_break | edit_break (ISO 8601)
  start_event_id?: number; // edit_break — the existing start endpoint (if any)
  end_event_id?: number; // edit_break — the existing end endpoint (if any)
  reason_code?: string; // standardized code (mirrors CorrectionReasonCode)
  reason?: string; // human label, or the free-text explanation when code = 'other'
}

// Standardized correction reasons — stable codes + human labels. Mirrors the
// backend CorrectionReasonCode enum; the modal requires one, and `other` reveals
// a required free-text explanation.
export interface CorrectionReason {
  code: string;
  label: string;
}

export const CORRECTION_REASONS: CorrectionReason[] = [
  { code: 'forgot_clock_in', label: 'Employee Forgot to Clock In' },
  { code: 'forgot_clock_out', label: 'Employee Forgot to Clock Out' },
  { code: 'forgot_lunch_start', label: 'Employee Forgot to Start Lunch' },
  { code: 'forgot_lunch_end', label: 'Employee Forgot to End Lunch' },
  { code: 'forgot_break_start', label: 'Employee Forgot to Start Break' },
  { code: 'forgot_break_end', label: 'Employee Forgot to End Break' },
  { code: 'incorrect_time', label: 'Incorrect Time Entered' },
  { code: 'device_issue', label: 'Clock / Device Issue' },
  { code: 'manager_correction', label: 'Manager Correction' },
  { code: 'other', label: 'Other' },
];

/** Active employees for the admin picker (reuses the login roster endpoint). */
export async function fetchEmployees(): Promise<AdminEmployee[]> {
  const res = (await api.get<AdminEmployee[]>('/auth/login-users')) as ApiEnvelope<AdminEmployee[]>;
  return res.data ?? [];
}

/** Apply an append-only correction. The Time Review screen re-fetches the
 * authoritative day grid afterward, so the return value is not relied upon. */
export async function applyCorrection(payload: CorrectionPayload): Promise<void> {
  await api.post('/admin/corrections', payload);
}

export interface LunchOverridePayload {
  user_id: number;
  // The shift's Clock In event (the effective one shown in positions.clock_in);
  // the server resolves the immutable lineage root = the logical-shift identity.
  clock_in_event_id: number;
  reason_code?: string;
  reason?: string;
}

/** Apply a case-by-case Lunch Override for ONE employee logical shift. Not a
 * punch: nothing is added to the ledger or deducted; the server re-derives Pending. */
export async function applyLunchOverride(payload: LunchOverridePayload): Promise<void> {
  await api.post('/admin/lunch-overrides', payload);
}

/** Reverse a Lunch Override (dated soft removal; the audit row is kept). */
export async function removeLunchOverride(id: number, reason: Pick<LunchOverridePayload, 'reason_code' | 'reason'> = {}): Promise<void> {
  await api.del(`/admin/lunch-overrides/${id}`, reason);
}

// ── Per-day Time Review (pay-period correction workspace) ─────────────────

export type PositionKey =
  | 'clock_in'
  | 'lunch_start'
  | 'lunch_end'
  | 'other_start'
  | 'other_end'
  | 'clock_out';

export interface DayPosition {
  event_id: number;
  at: string | null;
  source: string;
  // A system Auto-Clock-Out that still needs admin verification — Time Review
  // shows "Missing / Pending" rather than the machine-generated timestamp.
  unverified?: boolean;
}

// Payroll fields mirror PayrollBreakdown: paid (net, the number to pay),
// unpaid (lunch+other), gross (paid+unpaid = "Total Worked").
export interface PayrollFields {
  paid_seconds: number;
  paid_hours: number;
  unpaid_seconds: number;
  unpaid_hours: number;
  gross_seconds: number;
  gross_hours: number;
  lunch_seconds: number;
  other_break_seconds: number;
  shift_count: number;
  open_shift_count: number;
  has_open_shift: boolean;
  // Pending shifts (unresolved) contribute zero to the payroll figures above.
  pending_shift_count?: number;
  has_pending_shift?: boolean;
}

// The active case-by-case Lunch Override for one employee logical shift (who /
// when / why), anchored to the shift's immutable Clock In lineage. Never a lunch
// interval — lunch totals stay 0:00 when none was taken; it only satisfies the
// lunch requirement for that exact shift.
export interface LunchOverrideInfo {
  id: number;
  user_id: number;
  clock_in_event_id: number;
  work_date: string;
  shift_id: number | null;
  applied_at: string | null;
  applied_by: { id: number; full_name: string } | null;
  reason_code: string | null;
  reason: string | null;
  active: boolean;
  removed_at: string | null;
  removed_by: { id: number; full_name: string } | null;
  removal_reason_code: string | null;
  removal_reason: string | null;
}

export interface TimeReviewDay extends PayrollFields {
  date: string;
  day_of_week: number;
  weekday_label: string;
  day_label: string;
  day_type: string;
  schedule: {
    is_working_day: boolean;
    start_at: string | null;
    end_at: string | null;
    source: string;
    store_id: number | null;
  } | null;
  excused: {
    type: string;
    hours: number;
    scheduled_hours: number;
    is_paid: boolean;
    is_full_day: boolean;
  } | null;
  positions: Record<PositionKey, DayPosition | null>;
  // Where the PRIMARY shift's paid time began when Restrict Paid Time to Shift
  // Start clamped it to the scheduled start (canonical tt_shifts.paid_start_at);
  // null = paid from the actual Clock In. Display only — see paidFromAt().
  paid_start_at?: string | null;
  event_count: number;
  has_extra_events: boolean;
  // Pending (unresolved) day + its reason labels; and whether the clock-out shown
  // is an unverified system auto-clock-out needing administrative review.
  pending: boolean;
  pending_reasons: string[];
  // Machine-readable PendingReason values (missing_clock_out | missing_lunch |
  // incomplete_lunch). Reasons compose and resolve independently.
  pending_reason_codes?: string[];
  clock_out_unverified: boolean;
  // A lunch is REQUIRED for this shift but none was recorded → the Lunch area
  // shows "Missing Lunch / Pending" and offers Add Lunch / Override.
  lunch_missing?: boolean;
  // Active per-shift/date Lunch Override (explains a qualifying no-lunch day
  // that is not Pending), or null.
  lunch_override?: LunchOverrideInfo | null;
  flags: string[];
  events: ClockEventRow[];
}

export interface TimeReview {
  employee: { id: number; full_name: string };
  period: { from: string; to: string; timezone: string; label: string | null };
  totals: PayrollFields;
  days: TimeReviewDay[];
}

export interface TimeReviewParams {
  period?: 'current' | 'previous';
  from?: string;
  to?: string;
}

/** The authoritative per-day pay-period review for one employee. */
export async function fetchTimeReview(userId: number, params: TimeReviewParams): Promise<TimeReview> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (!params.from && !params.to && params.period) qs.set('period', params.period);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const res = (await api.get(`/admin/employees/${userId}/time-review${suffix}`)) as ApiEnvelope & {
    employee: TimeReview['employee'];
    period: TimeReview['period'];
    totals: PayrollFields;
    days: TimeReviewDay[];
  };

  return { employee: res.employee, period: res.period, totals: res.totals, days: res.days ?? [] };
}

// The six primary positions, in display order, with their column labels.
export const POSITION_COLUMNS: { key: PositionKey; label: string }[] = [
  { key: 'clock_in', label: 'Clock In' },
  { key: 'lunch_start', label: 'Lunch Out' },
  { key: 'lunch_end', label: 'Lunch In' },
  { key: 'other_start', label: 'Break Out' },
  { key: 'other_end', label: 'Break In' },
  { key: 'clock_out', label: 'Clock Out' },
];

/**
 * The instant the day's paid time began when it is LATER than the actual Clock
 * In (Restrict Paid Time to Shift Start clamped it to the scheduled start), else
 * null. Drives the "Paid from 7:00 AM" note beside the real punch so Paid vs the
 * punches is explainable. Pure display: the decision is the server's
 * paid_start_at — nothing is calculated here.
 */
export function paidFromAt(day: Pick<TimeReviewDay, 'paid_start_at' | 'positions'>): string | null {
  const paid = day.paid_start_at ?? null;
  const punch = day.positions?.clock_in?.at ?? null;
  if (!paid || !punch) return null;
  return new Date(paid).getTime() > new Date(punch).getTime() ? paid : null;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Per-day CSV for the pay period, in the same payroll ordering as the grid:
 * Date | Day | Day Type | (punches) | Paid | Unpaid | Total Worked. Times render
 * in the tenant timezone; values come straight from the authoritative day rows.
 */
export function timeReviewToCsv(review: TimeReview, tz: string): string {
  const header = [
    'Date',
    'Day',
    'Day Type',
    'Clock In',
    'Lunch Out',
    'Lunch In',
    'Break Out',
    'Break In',
    'Clock Out',
    'Paid',
    'Unpaid',
    'Total Worked',
  ];
  const at = (d: TimeReviewDay, k: PositionKey) => (d.positions[k]?.at ? formatClock(d.positions[k]!.at, tz) : '');
  const rows = review.days.map((d) => [
    d.date,
    d.weekday_label,
    d.day_type,
    at(d, 'clock_in'),
    at(d, 'lunch_start'),
    at(d, 'lunch_end'),
    at(d, 'other_start'),
    at(d, 'other_end'),
    at(d, 'clock_out'),
    d.paid_hours.toFixed(2),
    d.unpaid_hours.toFixed(2),
    d.gross_hours.toFixed(2),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

/** Trigger a browser download of a CSV string. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Cross-employee pay-period summary (Phase 3B) ──────────────────────────

// Payroll-explicit fields (mirrors PayPeriodSummaryService):
//   paid   = the number to PAY (canonical net-of-breaks projection value)
//   unpaid = lunch + other break time
//   gross  = paid + unpaid = elapsed work-period span ("Worked")
// The identity paid = gross − unpaid holds by construction — no double subtraction.
export interface PayPeriodRow {
  employee: { id: number; full_name: string };
  paid_seconds: number;
  paid_hours: number;
  unpaid_seconds: number;
  unpaid_hours: number;
  gross_seconds: number;
  gross_hours: number;
  lunch_seconds: number;
  other_break_seconds: number;
  shift_count: number;
  open_shift_count: number;
  has_open_shift: boolean;
  correction_count: number;
  system_event_count: number;
  auto_clock_out_count: number;
  mandatory_lunch_count: number;
  flags: string[];
}

export interface PayPeriodTotals {
  employees: number;
  employees_with_activity: number;
  paid_seconds: number;
  paid_hours: number;
  unpaid_seconds: number;
  unpaid_hours: number;
  gross_seconds: number;
  gross_hours: number;
  shift_count: number;
  lunch_seconds: number;
  other_break_seconds: number;
  open_shift_count: number;
  correction_count: number;
  system_event_count: number;
}

export interface PayPeriodSummary {
  period: { from: string; to: string; timezone: string; label: string | null };
  totals: PayPeriodTotals;
  data: PayPeriodRow[];
}

export interface PayPeriodParams {
  period?: 'current' | 'previous';
  from?: string;
  to?: string;
  sort?: 'name' | 'paid_desc';
  flagged?: boolean;
  store_id?: number;
}

/** The authoritative cross-employee summary (server computes all totals). */
export async function fetchPayPeriodSummary(params: PayPeriodParams): Promise<PayPeriodSummary> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (!params.from && !params.to && params.period) qs.set('period', params.period);
  if (params.sort && params.sort !== 'name') qs.set('sort', params.sort);
  if (params.flagged) qs.set('flagged', '1');
  if (params.store_id) qs.set('store_id', String(params.store_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const res = (await api.get<PayPeriodRow[]>(`/admin/pay-periods/summary${suffix}`)) as ApiEnvelope<
    PayPeriodRow[]
  > & { period: PayPeriodSummary['period']; totals: PayPeriodTotals };

  return { period: res.period, totals: res.totals, data: res.data ?? [] };
}

// Post-cutover the only Pay Period flag is Pending (unresolved Missing Lunch /
// Incomplete Lunch / Missing Clock Out, from the canonical PendingTimeResolver).
// The legacy badges (open shift / auto clock-out / auto lunch / no activity /
// corrected) are retired and never rendered.
const FLAG_LABEL: Record<string, string> = {
  pending: 'Pending',
};

export function flagLabel(flag: string): string {
  return FLAG_LABEL[flag] ?? flag;
}

/**
 * CSV of the same authoritative rows shown in the grid, in the same payroll
 * column order: Paid first, then Unpaid, then Worked. Operational/audit columns
 * follow the primary payroll set. Values come straight from the authoritative
 * fields — no separate calculation path.
 */
export function payPeriodToCsv(summary: PayPeriodSummary): string {
  const header = [
    'Employee',
    'Paid Hours',
    'Unpaid Hours',
    'Worked (h)',
    'Lunch (h)',
    'Other (h)',
    'Shifts',
    'Flags',
    // Operational / audit columns follow the primary payroll set.
    'Open shifts',
    'Corrections',
    'System events',
  ];
  const hours = (seconds: number) => (seconds / 3600).toFixed(2);
  const rows = summary.data.map((r) => [
    r.employee.full_name,
    r.paid_hours.toFixed(2),
    r.unpaid_hours.toFixed(2),
    r.gross_hours.toFixed(2),
    hours(r.lunch_seconds),
    hours(r.other_break_seconds),
    r.shift_count,
    r.flags.map(flagLabel).join('; '),
    r.open_shift_count,
    r.correction_count,
    r.system_event_count,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

// Re-export the (tz-agnostic) duration formatter; wall-clock formatting comes
// from ./tz and is always tenant-timezone based.
export { formatDuration };
