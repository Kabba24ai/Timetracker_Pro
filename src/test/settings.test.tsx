import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSettings, saveSettings, TimeTrackerSettings } from '../lib/settings';

// Fake V2 admin settings API — records calls and serves a canonical settings
// payload so the tests prove the wiring (GET → unwrap, PUT → body + unwrap).
const server = vi.hoisted(() => ({
  calls: [] as string[],
  lastBody: null as unknown,
}));

const SETTINGS: TimeTrackerSettings = {
  pay_increments: 5,
  pay_period_type: 'biweekly',
  pay_period_start_date: '2026-01-01',
  overtime_workweek_starts_on: 0,
  paid_leave_counts_toward_overtime: false,
  minimum_lunch_duration_minutes: 30,
  missed_lunch_reminder_minutes: 60,
  missed_lunch_reminder_message: 'lunch msg',
  lunch_required_days: [1, 2, 3, 4, 5],
  lunch_required_min_work_minutes: 300,
  first_clock_in_reminder_minutes: 30,
  second_clock_in_reminder_minutes: 45,
  clock_in_message_1: 'back 1',
  clock_in_message_2: 'back 2',
  missed_clock_out_reminder_minutes: 30,
  missed_clock_out_message: 'missed',
  missing_clock_out_warning_minutes: 45,
  missing_clock_out_warning_message: 'warn',
  missing_clock_out_trigger_minutes: 60,
  missing_clock_out_pending_message: 'pending',
  attendance_grace_minutes: 5,
  vacation_accrual_enabled: true,
  vacation_annual_hours: 80,
  vacation_max_eligible_hours_per_period: 80,
  vacation_accrual_waiting_days: 90,
  pending_time_escalation_phone: '',
  pending_reminder_1_enabled: true,
  pending_reminder_1_minutes: 30,
  pending_reminder_2_enabled: true,
  pending_reminder_2_minutes: 90,
  pending_reminder_3_enabled: true,
  pending_reminder_3_minutes: 180,
  pending_time_reminder_message: 'pending emp',
  pending_time_reminder_message_multi: 'pending emp multi',
  pending_time_escalation_message: 'pending esc',
  pending_time_escalation_message_multi: 'pending esc multi',
};

vi.mock('../lib/api', () => {
  const api = {
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      return { success: true, data: SETTINGS, timezone: 'America/Chicago' };
    },
    put: async (path: string, body: unknown) => {
      server.calls.push(`PUT ${path}`);
      server.lastBody = body;
      return { success: true, data: { ...SETTINGS, ...(body as object) }, timezone: 'America/Chicago' };
    },
  };
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
    firstError() {
      return this.message;
    }
  }
  return { api, ApiError, API_ROOT_URL: '', AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

describe('settings lib', () => {
  beforeEach(() => {
    server.calls = [];
    server.lastBody = null;
  });

  it('fetches and unwraps settings + timezone', async () => {
    const res = await fetchSettings();
    expect(server.calls).toContain('GET /admin/settings');
    expect(res.settings.pay_increments).toBe(5);
    expect(res.settings.missing_clock_out_trigger_minutes).toBe(60);
    expect(res.timezone).toBe('America/Chicago');
  });

  it('saves the full settings object and returns resolved values', async () => {
    const res = await saveSettings({ ...SETTINGS, pay_increments: 15, missing_clock_out_trigger_minutes: 90 });
    expect(server.calls).toContain('PUT /admin/settings');
    expect((server.lastBody as TimeTrackerSettings).pay_increments).toBe(15);
    expect(res.settings.pay_increments).toBe(15);
    expect(res.settings.missing_clock_out_trigger_minutes).toBe(90);
  });
});
