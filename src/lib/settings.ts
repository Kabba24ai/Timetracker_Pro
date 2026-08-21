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
  // Overtime is classified per FIXED seven-day workweek (statutory 40h), not per
  // pay period. This is the weekday that workweek starts (0=Sun … 6=Sat), and an
  // optional more-generous company policy letting paid leave count toward the 40h.
  overtime_workweek_starts_on: number;
  paid_leave_counts_toward_overtime: boolean;

  // Lunch (no auto lunch — a missing required lunch becomes Pending)
  minimum_lunch_duration_minutes: number;
  missed_lunch_reminder_minutes: number;
  missed_lunch_reminder_message: string;
  // Lunch-requirement eligibility: canonical weekday numbers (0=Sun … 6=Sat) a
  // lunch is required on, and the minimum qualifying scheduled work duration
  // (stored as minutes) at/above which a lunch is required.
  lunch_required_days: number[];
  lunch_required_min_work_minutes: number;

  // Return-from-lunch reminders
  first_clock_in_reminder_minutes: number;
  second_clock_in_reminder_minutes: number;
  clock_in_message_1: string;
  clock_in_message_2: string;

  // Missing Clock-Out: reminder → warning → Pending trigger (all minutes after
  // the scheduled shift end). No clock-out is ever generated.
  missed_clock_out_reminder_minutes: number;
  missed_clock_out_message: string;
  missing_clock_out_warning_minutes: number;
  missing_clock_out_warning_message: string;
  missing_clock_out_trigger_minutes: number;
  missing_clock_out_pending_message: string;

  // Attendance
  attendance_grace_minutes: number;
  // Early Clock Ins are recorded, but paid time begins at the scheduled shift
  // start (no schedule → paid time begins at the actual clock-in).
  restrict_paid_time_to_shift_start: boolean;

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
