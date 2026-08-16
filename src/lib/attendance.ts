// TimeTracker V2 — attendance admin API layer (derived projection).
//
// The server derives all attendance from the canonical schedule + V2 shifts +
// excused input; this layer only reads the cross-employee summary / per-employee
// detail and triggers an explicit rebuild.

import { api, ApiEnvelope } from './api';

export interface AttendanceSummaryRow {
  employee: { id: number; full_name: string };
  present: number;
  late: number;
  absent: number;
  excused: number;
  day_off: number;
  unscheduled: number;
  minutes_late: number;
  worked_seconds: number;
  flags: string[];
}

export interface AttendanceSummary {
  period: { from: string; to: string; timezone: string; label: string | null };
  totals: { employees: number; present: number; late: number; absent: number; excused: number; minutes_late: number };
  data: AttendanceSummaryRow[];
}

export interface AttendanceDayRow {
  date: string;
  status: 'present' | 'late' | 'absent' | 'excused' | 'day_off' | 'unscheduled';
  status_label: string;
  scheduled: boolean;
  schedule_source: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  first_clock_in: string | null;
  last_clock_out: string | null;
  minutes_late: number;
  minutes_early: number;
  worked_seconds: number;
  shift_count: number;
  excused_type: string | null;
}

export interface EmployeeAttendance {
  employee: { id: number; full_name: string };
  timezone: string;
  from: string;
  to: string;
  data: AttendanceDayRow[];
}

export async function fetchAttendanceSummary(params: {
  period?: 'current' | 'previous';
  from?: string;
  to?: string;
}): Promise<AttendanceSummary> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (!params.from && !params.to && params.period) qs.set('period', params.period);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = (await api.get(`/admin/attendance/summary${suffix}`)) as ApiEnvelope & AttendanceSummary;
  return { period: res.period, totals: res.totals, data: res.data ?? [] };
}

export async function fetchEmployeeAttendance(
  userId: number,
  params: { from?: string; to?: string },
): Promise<EmployeeAttendance> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = (await api.get(`/admin/employees/${userId}/attendance${suffix}`)) as ApiEnvelope & EmployeeAttendance;
  return { employee: res.employee, timezone: res.timezone, from: res.from, to: res.to, data: res.data ?? [] };
}

export async function rebuildAttendance(payload: {
  from: string;
  to: string;
  employee_id?: number;
}): Promise<{ employees: number; days_derived: number }> {
  const res = (await api.post('/admin/attendance/rebuild', payload)) as ApiEnvelope & {
    employees: number;
    days_derived: number;
  };
  return { employees: res.employees, days_derived: res.days_derived };
}

export const ATTENDANCE_STATUS_STYLE: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-amber-100 text-amber-800',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-blue-100 text-blue-700',
  day_off: 'bg-gray-100 text-gray-500',
  unscheduled: 'bg-purple-100 text-purple-700',
};
