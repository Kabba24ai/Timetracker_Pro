// TimeTracker V2 — admin review/reporting API layer.
//
// Thin wrappers over the master-admin-only V2 endpoints:
//   GET  /admin/employees/{id}/shifts   — the derived shift/break projection
//   GET  /admin/employees/{id}/events   — the immutable event ledger (audit)
//   POST /admin/corrections             — append-only adjust / void / insert
//
// The server enforces the master_admin role; this layer only shuttles data.

import { api, ApiEnvelope } from './api';
import { ClockShift, formatDuration } from './timeclock';
import { formatInstant } from './tz';

export interface AdminEmployee {
  id: number;
  full_name: string;
}

// One row of the immutable ledger (mirrors ClockEventResource).
export interface ClockEventRow {
  id: number;
  kind: 'clock_in' | 'clock_out' | 'lunch_start' | 'lunch_end' | 'other_start' | 'other_end';
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
}

export type CorrectionType = 'adjust' | 'void' | 'insert';
export type CorrectableKind = ClockEventRow['kind'];

export interface CorrectionPayload {
  type: CorrectionType;
  event_id?: number; // adjust | void
  user_id?: number; // insert
  kind?: CorrectableKind; // insert
  effective_at?: string; // adjust | insert (ISO 8601)
  reason?: string;
}

/** Active employees for the admin picker (reuses the login roster endpoint). */
export async function fetchEmployees(): Promise<AdminEmployee[]> {
  const res = (await api.get<AdminEmployee[]>('/auth/login-users')) as ApiEnvelope<AdminEmployee[]>;
  return res.data ?? [];
}

/** An employee's shift/break projection over a date range (YYYY-MM-DD). */
export async function fetchEmployeeShifts(
  userId: number,
  from: string,
  to: string,
): Promise<ClockShift[]> {
  const res = (await api.get<ClockShift[]>(
    `/admin/employees/${userId}/shifts?from=${from}&to=${to}`,
  )) as ApiEnvelope<ClockShift[]>;
  return res.data ?? [];
}

/** An employee's immutable event ledger over a date range (YYYY-MM-DD). */
export async function fetchEmployeeEvents(
  userId: number,
  from: string,
  to: string,
): Promise<ClockEventRow[]> {
  const res = (await api.get<ClockEventRow[]>(
    `/admin/employees/${userId}/events?from=${from}&to=${to}`,
  )) as ApiEnvelope<ClockEventRow[]>;
  return res.data ?? [];
}

/** Apply an append-only correction; returns the affected employee's rebuilt shifts. */
export async function applyCorrection(payload: CorrectionPayload): Promise<ClockShift[]> {
  const res = (await api.post<ClockShift[]>('/admin/corrections', payload)) as ApiEnvelope<
    ClockShift[]
  > & { shifts?: ClockShift[] };
  // The endpoint returns { success, correction_event_id, shifts: [...] }.
  return res.shifts ?? [];
}

// ── Summary + CSV ─────────────────────────────────────────────────────────

export interface RangeSummary {
  shiftCount: number;
  workedSeconds: number;
  lunchSeconds: number;
  otherSeconds: number;
  openShifts: number;
}

export function summarize(shifts: ClockShift[]): RangeSummary {
  return shifts.reduce<RangeSummary>(
    (acc, s) => {
      acc.shiftCount += 1;
      acc.workedSeconds += s.worked_seconds;
      if (s.status === 'open') acc.openShifts += 1;
      for (const b of s.breaks) {
        if (b.type === 'lunch') acc.lunchSeconds += b.duration_seconds;
        else acc.otherSeconds += b.duration_seconds;
      }
      return acc;
    },
    { shiftCount: 0, workedSeconds: 0, lunchSeconds: 0, otherSeconds: 0, openShifts: 0 },
  );
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a per-shift CSV for the range (client-side; no backend needed). Times
 * are rendered in the tenant timezone so the export matches the on-screen data.
 */
export function shiftsToCsv(employeeName: string, shifts: ClockShift[], tz: string): string {
  const dt: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };
  const header = [
    'Employee',
    'Shift ID',
    'Status',
    `Clock In (${tz})`,
    `Clock Out (${tz})`,
    'Worked (h)',
    'Lunch (min)',
    'Other Break (min)',
  ];

  const rows = shifts.map((s) => {
    const lunch = s.breaks.filter((b) => b.type === 'lunch').reduce((n, b) => n + b.duration_seconds, 0);
    const other = s.breaks.filter((b) => b.type === 'other').reduce((n, b) => n + b.duration_seconds, 0);
    return [
      employeeName,
      s.id,
      s.status,
      s.clock_in_at ? formatInstant(s.clock_in_at, tz, dt) : '',
      s.clock_out_at ? formatInstant(s.clock_out_at, tz, dt) : '',
      (s.worked_seconds / 3600).toFixed(2),
      Math.round(lunch / 60),
      Math.round(other / 60),
    ];
  });

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

// Re-export the (tz-agnostic) duration formatter; wall-clock formatting comes
// from ./tz and is always tenant-timezone based.
export { formatDuration };
