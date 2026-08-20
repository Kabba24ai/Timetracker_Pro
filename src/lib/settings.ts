// TimeTracker V2 — canonical admin settings API layer.
//
// Thin wrapper over the master-admin-only endpoints:
//   GET /admin/settings — every live timekeeping setting, resolved to the exact
//                         value the V2 engine uses, plus the tenant timezone.
//   PUT /admin/settings — server-validated write; the backend prunes dead keys
//                         and audits every change.
//
// The server is authoritative: it validates every field and owns the canonical
// key set. This layer only shuttles the flat settings object; it never invents
// or persists keys the API did not return.

import { api, ApiEnvelope } from './api';

/** The complete live settings surface — mirrors TimeTrackerSettingsService::all(). */
export interface TimeTrackerSettings {
  // Payroll
  pay_increments: number;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_start_date: string;

  // Lunch
  minimum_lunch_duration_minutes: number;
  default_lunch_duration_minutes: number;
  auto_lunch_minutes: number;
  auto_lunch_message: string;
  // Auto Lunch eligibility: canonical weekday numbers (0=Sun … 6=Sat) it applies
  // on, and the minimum qualifying scheduled work duration stored as minutes.
  auto_lunch_days: number[];
  auto_lunch_min_work_minutes: number;

  // Clock-back-from-lunch reminders
  first_clock_in_reminder_minutes: number;
  second_clock_in_reminder_minutes: number;
  clock_in_message_1: string;
  clock_in_message_2: string;

  // Missed clock-out reminder + auto clock-out
  missed_clock_out_reminder_minutes: number;
  missed_clock_out_message: string;
  auto_clock_out_warning_minutes: number;
  auto_clock_out_warning_message: string;
  auto_clock_out_limit_minutes: number;
  auto_clock_out_message: string;
  max_shift_hours: number;

  // Attendance
  attendance_grace_minutes: number;

  // Vacation accrual
  vacation_accrual_enabled: boolean;
  vacation_annual_hours: number;
  vacation_max_eligible_hours_per_period: number;
  vacation_accrual_waiting_days: number;

  // Pending Time follow-up (next-shift escalation for unresolved prior shifts).
  // The escalation phone is optional (blank = employee-only). Each reminder slot
  // has an independent enable flag + minutes offset after the next-shift clock-in;
  // enabled slots must be strictly ascending (no duplicate offsets). Separate
  // single vs. consolidated (_multi) templates per recipient.
  pending_time_escalation_phone: string;
  pending_reminder_1_enabled: boolean;
  pending_reminder_1_minutes: number;
  pending_reminder_2_enabled: boolean;
  pending_reminder_2_minutes: number;
  pending_reminder_3_enabled: boolean;
  pending_reminder_3_minutes: number;
  pending_time_reminder_message: string;
  pending_time_reminder_message_multi: string;
  pending_time_escalation_message: string;
  pending_time_escalation_message_multi: string;
}

export interface SettingsResponse {
  settings: TimeTrackerSettings;
  timezone: string;
}

interface SettingsEnvelope extends ApiEnvelope<TimeTrackerSettings> {
  timezone?: string;
}

function unwrap(res: SettingsEnvelope): SettingsResponse {
  return {
    settings: (res.data ?? {}) as TimeTrackerSettings,
    timezone: res.timezone ?? 'UTC',
  };
}

/** Load the canonical live settings (master-admin only). */
export async function fetchSettings(): Promise<SettingsResponse> {
  const res = (await api.get<TimeTrackerSettings>('/admin/settings')) as SettingsEnvelope;
  return unwrap(res);
}

/** Persist settings; returns the freshly-resolved values the engine will use. */
export async function saveSettings(
  settings: TimeTrackerSettings,
): Promise<SettingsResponse> {
  const res = (await api.put<TimeTrackerSettings>('/admin/settings', settings)) as SettingsEnvelope;
  return unwrap(res);
}
