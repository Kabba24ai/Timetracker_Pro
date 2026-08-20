// TimeTracker V2 — employee READ-ONLY Work History API layer.
//
// Self-scoped over the SAME canonical Time Review read-model the admin uses:
//   GET /history           — the authenticated employee's per-day pay-period grid
//                            + period totals (period=current|previous OR from/to)
//   GET /history/synopsis   — the compact most-recent-days dashboard widget
//
// The server derives the employee from the auth token (no user_id is ever sent),
// owns all payroll math, and omits the admin audit ledger. This layer only
// shuttles data — it performs no calculation and exposes no mutation.

import { api, ApiEnvelope } from './api';
import type { PayrollFields, TimeReview, TimeReviewDay, TimeReviewParams } from './admin';
import { formatDuration } from './timeclock';

// Reuse the canonical admin read-model types. The employee full history is the
// admin Time Review payload MINUS the raw audit `events` ledger (stripped
// server-side for read-only self-service), so a day omits only that field.
export type HistoryDay = Omit<TimeReviewDay, 'events'>;
export type HistoryReview = Omit<TimeReview, 'days'> & { days: HistoryDay[] };

export type { PayrollFields, TimeReviewParams, PositionKey, DayPosition } from './admin';
export { POSITION_COLUMNS } from './admin';

/** The authenticated employee's own per-day Work History (server derives the user). */
export async function fetchMyHistory(params: TimeReviewParams): Promise<HistoryReview> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (!params.from && !params.to && params.period) qs.set('period', params.period);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const res = (await api.get(`/history${suffix}`)) as ApiEnvelope & {
    employee: HistoryReview['employee'];
    period: HistoryReview['period'];
    totals: PayrollFields;
    days: HistoryDay[];
  };

  return { employee: res.employee, period: res.period, totals: res.totals, days: res.days ?? [] };
}

// ── Compact dashboard synopsis (current pay period) ───────────────────────

export interface HistorySynopsisDay {
  date: string;
  day_label: string;
  weekday_label: string;
  clock_in: string | null; // ISO instant; null when none recorded (e.g. Missing Clock Out)
  clock_out: string | null; // ISO instant; null when Pending / not recorded
  lunch_seconds: number; // total unpaid lunch for the day (Other breaks excluded)
  paid_seconds: number; // canonical Paid seconds
  paid_hours: number; // canonical Paid hours
  pending: boolean;
  pending_reasons: string[];
  clock_out_unverified: boolean;
}

export interface HistorySynopsis {
  period: { from: string; to: string; timezone: string; label: string | null };
  days: HistorySynopsisDay[];
}

/** The compact most-recent-days synopsis for the current pay period. */
export async function fetchMyHistorySynopsis(): Promise<HistorySynopsis> {
  const res = (await api.get('/history/synopsis')) as ApiEnvelope & {
    period: HistorySynopsis['period'];
    days: HistorySynopsisDay[];
  };
  return { period: res.period, days: res.days ?? [] };
}

// ── Display helpers ───────────────────────────────────────────────────────

/** Human-readable lunch duration for the synopsis: "30 min", "1 hr", "1 hr 15 min". */
export function formatLunchDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  if (total === 0) return '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** Compact Paid-hours for the synopsis Hours column, e.g. 9.5 → "9.5", 9 → "9". */
export function formatPaidHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

// Re-export the tz-agnostic duration formatter for the full-history grid.
export { formatDuration };
