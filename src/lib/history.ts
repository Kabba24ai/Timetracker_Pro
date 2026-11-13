// TimeTracker V2 — employee READ-ONLY Work History API layer.
//
// Self-scoped over the SAME canonical Time Review read-model the admin uses:
//   GET /history           — the authenticated employee's per-day pay-period grid
//                            + period totals (period=current|previous OR from/to)
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
export { POSITION_COLUMNS, paidFromAt } from './admin';

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

// Re-export the tz-agnostic duration formatter for the full-history grid.
export { formatDuration };
