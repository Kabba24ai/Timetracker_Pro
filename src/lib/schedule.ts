// TimeTracker V2 — employee work-schedule admin API layer.
//
// Talks to the canonical V2 schedule endpoints (master-admin only): recurring
// weekly rules + date-specific overrides. The server owns all schedule
// resolution and tenant-timezone interpretation; this layer only shuttles data.

import { api, ApiEnvelope } from './api';

export interface ScheduleRuleRow {
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  is_working_day: boolean;
  start_time: string | null; // 'HH:MM'
  end_time: string | null;
  crosses_midnight: boolean;
  store_id: number | null;
}

export interface ScheduleOverrideRow {
  id: number;
  date: string; // YYYY-MM-DD
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  crosses_midnight: boolean;
  store_id: number | null;
  reason: string | null;
}

export interface EmployeeSchedule {
  employee: { id: number; full_name: string; store_id: number | null };
  timezone: string;
  rules: ScheduleRuleRow[];
  overrides: ScheduleOverrideRow[];
}

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** An employee's stored recurring rules + overrides (in a range). */
export async function fetchEmployeeSchedule(
  userId: number,
  params?: { from?: string; to?: string },
): Promise<EmployeeSchedule> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = (await api.get(`/admin/employees/${userId}/schedule${suffix}`)) as ApiEnvelope & EmployeeSchedule;
  return {
    employee: res.employee,
    timezone: res.timezone,
    rules: res.rules ?? [],
    overrides: res.overrides ?? [],
  };
}

/** Bulk upsert the recurring weekly schedule (send all 7 days). */
export async function saveEmployeeSchedule(userId: number, rules: ScheduleRuleRow[]): Promise<void> {
  await api.put(`/admin/employees/${userId}/schedule`, { rules });
}

/** Create/replace a date-specific override; returns its id. */
export async function saveScheduleOverride(
  userId: number,
  payload: {
    date: string;
    is_working_day: boolean;
    start_time?: string | null;
    end_time?: string | null;
    crosses_midnight?: boolean;
    store_id?: number | null;
    reason?: string | null;
  },
): Promise<number> {
  const res = (await api.post(`/admin/employees/${userId}/schedule/overrides`, payload)) as ApiEnvelope & {
    override_id: number;
  };
  return res.override_id;
}

export async function deleteScheduleOverride(userId: number, overrideId: number): Promise<void> {
  await api.del(`/admin/employees/${userId}/schedule/overrides/${overrideId}`);
}

/** True when a working window ends at/before it starts (overnight). */
export function isOvernight(start: string | null, end: string | null): boolean {
  return !!start && !!end && end <= start;
}
