import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Regression tests for the Settings input FOCUS bug: numeric/text fields were
// losing focus after every keystroke because Section/NumberField/MessageField
// were declared inside the render body (new identity each render → remount).
// These tests exercise the real component + real settings lib over a mocked API.

const server = vi.hoisted(() => ({ calls: [] as string[], lastBody: null as any, putError: null as string | null }));

const SETTINGS = {
  pay_increments: 5,
  pay_period_type: 'biweekly',
  pay_period_start_date: '2026-01-01',
  overtime_workweek_starts_on: 0,
  paid_leave_counts_toward_overtime: false,
  minimum_lunch_duration_minutes: 45,
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
  pending_time_reminder_message: 'Hi {name}, {pending_date} is Pending: {pending_reason}.',
  pending_time_reminder_message_multi: 'Hi {name}, {count} Pending records.',
  pending_time_escalation_message: '{employee_name} — {pending_date}: {pending_reason}.',
  pending_time_escalation_message_multi: '{employee_name} has {count} Pending records.',
};

vi.mock('../lib/api', () => {
  const api = {
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      return { success: true, data: { ...SETTINGS }, timezone: 'America/Chicago' };
    },
    put: async (path: string, body: unknown) => {
      server.calls.push(`PUT ${path}`);
      server.lastBody = body;
      if (server.putError) throw new ApiError(server.putError, 422);
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

import SystemSettings from '../components/admin/SystemSettings';

// The <label> is a sibling of the control (not wrapping it, no htmlFor), so find
// the field by its label text then reach the input/textarea in the same block.
const control = (label: string): HTMLInputElement | HTMLTextAreaElement =>
  screen.getByText(label).parentElement!.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;

const renderSettings = async () => {
  render(<SystemSettings />);
  // Wait for the async load to populate the form.
  await screen.findByText('Minimum Lunch (minutes)');
};

beforeEach(() => {
  server.calls = [];
  server.lastBody = null;
  server.putError = null;
});

describe('Settings form — focus retention', () => {
  it('accepts 180 from a single focus/click and keeps focus on the same input the whole time', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Missed-Lunch Reminder (minutes before shift end)') as HTMLInputElement;
    await user.click(input); // one click to focus
    expect(document.activeElement).toBe(input);

    await user.keyboard('{Control>}a{/Control}'); // select the existing 60
    await user.keyboard('180'); // type continuously, no re-click

    expect(input.value).toBe('180');
    // The SAME node is still mounted and focused (would fail if it remounted).
    expect(control('Missed-Lunch Reminder (minutes before shift end)')).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it('does not remount the field on each keystroke (stable component identity)', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Minimum Lunch (minutes)') as HTMLInputElement;
    await user.click(input);
    const before = control('Minimum Lunch (minutes)');
    await user.keyboard('{Control>}a{/Control}9');
    const after = control('Minimum Lunch (minutes)');

    expect(after).toBe(before); // identical DOM node → no remount
    expect(document.activeElement).toBe(after);
    expect((after as HTMLInputElement).value).toBe('9');
  });

  it('selecting an existing multi-digit value and typing replaces it', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Minimum Lunch (minutes)') as HTMLInputElement; // starts at 45
    expect(input.value).toBe('45');
    await user.tripleClick(input); // select existing value
    await user.keyboard('120');

    expect(input.value).toBe('120');
    expect(document.activeElement).toBe(input);
  });

  it('backspace/delete clears digits and does not snap back to the old/default value', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Missed-Lunch Reminder (minutes before shift end)') as HTMLInputElement; // 60
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    // Cleared to empty and STAYS empty (no forced coercion back to 60/0 in the box).
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);

    await user.keyboard('120');
    expect(input.value).toBe('120');
  });

  it('pastes a multi-digit number', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Missing Clock-Out Trigger') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('24');

    expect(input.value).toBe('24');
    expect(document.activeElement).toBe(input);
  });

  it('a reminder-message textarea accepts a full sentence without losing focus', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const area = control('Missed-Lunch Reminder Message') as HTMLTextAreaElement;
    await user.click(area);
    await user.keyboard('{Control>}a{/Control}');
    await user.keyboard('Please take your lunch now');

    expect(area.value).toBe('Please take your lunch now');
    expect(document.activeElement).toBe(area);
  });

  it('editing one setting does not reset another unsaved setting', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const minLunch = control('Minimum Lunch (minutes)') as HTMLInputElement;
    await user.tripleClick(minLunch);
    await user.keyboard('90');

    const grace = control('Late Grace Period (minutes)') as HTMLInputElement;
    await user.tripleClick(grace);
    await user.keyboard('12');

    // The first (still-unsaved) edit is intact.
    expect((control('Minimum Lunch (minutes)') as HTMLInputElement).value).toBe('90');
    expect((control('Late Grace Period (minutes)') as HTMLInputElement).value).toBe('12');
  });
});

describe('Settings form — persistence', () => {
  it('Save Settings sends the canonical V2 payload with edited numeric + message values', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const minLunch = control('Minimum Lunch (minutes)') as HTMLInputElement;
    await user.tripleClick(minLunch);
    await user.keyboard('90');

    const area = control('Missed-Lunch Reminder Message') as HTMLTextAreaElement;
    await user.tripleClick(area);
    await user.keyboard('Take lunch');

    await user.click(screen.getByRole('button', { name: /Save Settings/ }));

    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
    const body = server.lastBody as typeof SETTINGS;
    // Edited values, as NUMBERS / strings — not string-coerced numerics.
    expect(body.minimum_lunch_duration_minutes).toBe(90);
    expect(body.missed_lunch_reminder_message).toBe('Take lunch');
    // Full canonical key set present; the retired auto-clock-out / max-shift keys
    // are gone entirely.
    expect(body.pay_period_type).toBe('biweekly');
    expect(body.missing_clock_out_trigger_minutes).toBe(60);
    expect(body).not.toHaveProperty('auto_clock_out_time');
    expect(body).not.toHaveProperty('auto_clock_out_limit_minutes');
    expect(body).not.toHaveProperty('max_shift_hours');
    expect(Object.keys(body).length).toBe(Object.keys(SETTINGS).length);
  });
});

describe('Settings form — Missing Clock-Out contract (no auto clock-out)', () => {
  it('labels reminder, warning and trigger all as minutes after shift end', async () => {
    await renderSettings();

    expect(screen.getByText('Missed Clock-Out Reminder').parentElement!.textContent).toContain('minutes after shift end');
    expect(screen.getByText('Missing Clock-Out Warning').parentElement!.textContent).toContain('minutes after shift end');
    expect(screen.getByText('Missing Clock-Out Trigger').parentElement!.textContent).toContain('marks Pending');
  });

  it('no longer renders any Auto Clock-Out control, Max Open Shift, or store-close text', async () => {
    await renderSettings();
    expect(screen.queryByText('Auto Clock-Out')).toBeNull();
    expect(screen.queryByText('Auto Clock-Out Warning')).toBeNull();
    expect(screen.queryByText('Max Open Shift (hours)')).toBeNull();
    expect(document.querySelector('input[type="time"]')).toBeNull();
    expect(document.body.textContent).not.toContain('minutes after store close');
  });
});

describe('Settings form — message merge tokens', () => {
  const field = (label: string) => screen.getByText(label).parentElement as HTMLElement;

  it('advertises the Pending-era tokens for the missed-lunch message and not retired ones', async () => {
    await renderSettings();
    const text = field('Missed-Lunch Reminder Message').textContent ?? '';
    expect(text).toContain('{shift_end}');
    expect(text).toContain('{name}');
    // Retired tokens are NOT advertised (nothing is applied; no auto clock-out).
    expect(text).not.toContain('{lunch_minutes}');
    expect(text).not.toContain('{time}');
  });

  it('saves the edited missed-lunch message', async () => {
    const user = userEvent.setup();
    await renderSettings();
    // fireEvent (not user.keyboard) so the literal {tokens} are not parsed as keys.
    const area = control('Missed-Lunch Reminder Message') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'Hi {name}, record your lunch by {shift_end}.' } });
    await user.click(screen.getByRole('button', { name: /Save Settings/ }));

    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
    expect((server.lastBody as typeof SETTINGS).missed_lunch_reminder_message).toBe('Hi {name}, record your lunch by {shift_end}.');
  });

  it('surfaces an unsupported-token validation error returned by the backend', async () => {
    const user = userEvent.setup();
    await renderSettings();
    server.putError = 'Unsupported merge token: {foobar}';

    const area = control('Missed-Lunch Reminder Message') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'Hi {name}, {foobar}.' } });
    await user.click(screen.getByRole('button', { name: /Save Settings/ }));

    expect(await screen.findByText('Unsupported merge token: {foobar}')).toBeInTheDocument();
  });
});

describe('Settings form — Lunch requirement eligibility', () => {
  const weekdayBtn = (name: string) => screen.getByRole('button', { name });

  it('renders seven weekday controls', async () => {
    await renderSettings();
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => {
      expect(weekdayBtn(d)).toBeInTheDocument();
    });
  });

  it('reflects the approved defaults: Mon–Fri on, Sat and Sun off', async () => {
    await renderSettings();
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach((d) => {
      expect(weekdayBtn(d).getAttribute('aria-pressed')).toBe('true');
    });
    expect(weekdayBtn('Sat').getAttribute('aria-pressed')).toBe('false');
    expect(weekdayBtn('Sun').getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles a weekday independently', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(weekdayBtn('Sat'));
    expect(weekdayBtn('Sat').getAttribute('aria-pressed')).toBe('true');
    // Other days are unaffected.
    expect(weekdayBtn('Mon').getAttribute('aria-pressed')).toBe('true');
    expect(weekdayBtn('Sun').getAttribute('aria-pressed')).toBe('false');

    await user.click(weekdayBtn('Sat'));
    expect(weekdayBtn('Sat').getAttribute('aria-pressed')).toBe('false');
  });

  it('renders Minimum Work Hours as a dropdown with exactly the approved options and 5.0 default', async () => {
    await renderSettings();

    const select = screen.getByLabelText('Minimum Work Hours') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    // Not a free-entry numeric input.
    expect(select.getAttribute('type')).toBeNull();
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual(['4.0 hours', '4.5 hours', '5.0 hours', '5.5 hours', '6.0 hours']);
    expect(select.value).toBe('300'); // default 5.0h
  });

  it('lets the admin pick 4.5 and 5.5 hours', async () => {
    const user = userEvent.setup();
    await renderSettings();
    const select = screen.getByLabelText('Minimum Work Hours') as HTMLSelectElement;

    await user.selectOptions(select, '270');
    expect(select.value).toBe('270');
    await user.selectOptions(select, '330');
    expect(select.value).toBe('330');
  });

  it('Save sends canonical weekdays and the selected minimum, and a reload restores them', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(weekdayBtn('Sat')); // enable Saturday
    await user.selectOptions(screen.getByLabelText('Minimum Work Hours'), '330');
    await user.click(screen.getByRole('button', { name: /Save Settings/ }));

    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
    const body = server.lastBody as typeof SETTINGS;
    expect(body.lunch_required_days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(body.lunch_required_min_work_minutes).toBe(330);

    // The mocked PUT echoes the saved values back → the controls reflect them.
    expect(weekdayBtn('Sat').getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Minimum Work Hours') as HTMLSelectElement).value).toBe('330');
  });
});

describe('Settings form — Overtime workweek', () => {
  const otToggle = () =>
    screen
      .getByText('Paid Leave Counts Toward Company Overtime Threshold')
      .closest('label')!
      .querySelector('input[type="checkbox"]') as HTMLInputElement;

  it('renders Workweek Starts On as a dropdown defaulting to Sunday', async () => {
    await renderSettings();
    const select = screen.getByLabelText('Workweek Starts On') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(select.value).toBe('0'); // Kabba default: Sunday
  });

  it('renders the paid-leave company-overtime toggle defaulting OFF', async () => {
    await renderSettings();
    expect(otToggle().checked).toBe(false);
  });

  it('never describes overtime as "over 80 hours per pay period"', async () => {
    await renderSettings();
    expect(document.body.textContent).not.toMatch(/80 hours per pay period/i);
    expect(document.body.textContent).toMatch(/40 hours/); // the weekly threshold
  });

  it('Save persists the workweek start day and the paid-leave toggle', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.selectOptions(screen.getByLabelText('Workweek Starts On'), '1'); // Monday
    await user.click(otToggle());
    await user.click(screen.getByRole('button', { name: /Save Settings/ }));

    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
    const body = server.lastBody as typeof SETTINGS;
    expect(body.overtime_workweek_starts_on).toBe(1);
    expect(body.paid_leave_counts_toward_overtime).toBe(true);

    // Echoed back → controls reflect the saved values.
    expect((screen.getByLabelText('Workweek Starts On') as HTMLSelectElement).value).toBe('1');
    expect(otToggle().checked).toBe(true);
  });
});

describe('Settings form — Pending Time Follow-Up', () => {
  const slotCard = (label: string): HTMLElement => screen.getByText(label).closest('.bg-white') as HTMLElement;

  it('renders the escalation phone field and the three reminder slots with defaults', async () => {
    await renderSettings();

    expect(screen.getByText('Pending Time Escalation Phone')).toBeInTheDocument();
    ['First reminder', 'Second reminder', 'Third reminder'].forEach((l) =>
      expect(screen.getByText(l)).toBeInTheDocument(),
    );
    expect((slotCard('First reminder').querySelector('input[type="number"]') as HTMLInputElement).value).toBe('30');
    expect((slotCard('Second reminder').querySelector('input[type="number"]') as HTMLInputElement).value).toBe('90');
    expect((slotCard('Third reminder').querySelector('input[type="number"]') as HTMLInputElement).value).toBe('180');
  });

  it('advertises the correct merge tokens per template', async () => {
    await renderSettings();
    const emp = screen.getByText('Employee Message').parentElement!.textContent ?? '';
    expect(emp).toContain('{pending_date}');
    expect(emp).toContain('{pending_reason}');

    const esc = screen.getByText('Escalation Message').parentElement!.textContent ?? '';
    expect(esc).toContain('{employee_name}');
    // The escalation template does not use the employee-only {name} token.
    expect(esc).not.toContain('{name},');

    const empMulti = screen.getByText('Employee Message — Multiple Pending').parentElement!.textContent ?? '';
    expect(empMulti).toContain('{count}');
  });

  it('saves the phone, offsets and messages in the canonical payload', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const phone = control('Pending Time Escalation Phone') as HTMLInputElement;
    fireEvent.change(phone, { target: { value: '512-555-0142' } });

    await user.click(screen.getByRole('button', { name: /Save Settings/ }));
    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));

    const body = server.lastBody as typeof SETTINGS;
    expect(body.pending_time_escalation_phone).toBe('512-555-0142');
    expect(body.pending_reminder_1_minutes).toBe(30);
    expect(body.pending_reminder_2_minutes).toBe(90);
    expect(body.pending_reminder_3_minutes).toBe(180);
  });

  it('respects a disabled reminder slot in the saved payload', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const toggle = slotCard('Second reminder').querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    await user.click(toggle);

    await user.click(screen.getByRole('button', { name: /Save Settings/ }));
    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
    expect((server.lastBody as typeof SETTINGS).pending_reminder_2_enabled).toBe(false);
  });

  it('rejects out-of-order enabled reminders client-side (no PUT)', async () => {
    const user = userEvent.setup();
    await renderSettings();

    // Make slot 1 (200) later than slot 2 (90) while all are enabled.
    const first = slotCard('First reminder').querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(first, { target: { value: '200' } });

    await user.click(screen.getByRole('button', { name: /Save Settings/ }));

    expect(await screen.findByText(/ascending order/i)).toBeInTheDocument();
    expect(server.calls).not.toContain('PUT /admin/settings');
  });

  it('ignores a disabled slot in the ordering check', async () => {
    const user = userEvent.setup();
    await renderSettings();

    // Slot 2 out of order but DISABLED → save proceeds (1=30 < 3=180).
    const second = slotCard('Second reminder').querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(second, { target: { value: '5' } });
    await user.click(slotCard('Second reminder').querySelector('input[type="checkbox"]') as HTMLInputElement);

    await user.click(screen.getByRole('button', { name: /Save Settings/ }));
    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
  });
});

describe('Settings form — Vacation Accrual section', () => {
  it('renders the Kabba defaults: 80 annual, 80 eligible cap, 90-day wait', async () => {
    await renderSettings();
    expect(screen.getByText('Vacation Accrual')).toBeInTheDocument();
    expect((control('Standard Annual Vacation Hours') as HTMLInputElement).value).toBe('80');
    expect((control('Max Accrual-Eligible Hours / Pay Period') as HTMLInputElement).value).toBe('80');
    expect((control('Accrual Starts After (days)') as HTMLInputElement).value).toBe('90');
    // Enable toggle present and on by default.
    expect((screen.getByText('Enable Vacation Accrual').closest('label')!.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
  });

  it('Save includes the vacation-accrual keys in the canonical payload', async () => {
    const user = userEvent.setup();
    await renderSettings();
    await user.click(screen.getByRole('button', { name: /Save Settings/ }));
    await vi.waitFor(() => expect(server.calls).toContain('PUT /admin/settings'));
    const body = server.lastBody as Record<string, unknown>;
    expect(body.vacation_annual_hours).toBe(80);
    expect(body.vacation_max_eligible_hours_per_period).toBe(80);
    expect(body.vacation_accrual_waiting_days).toBe(90);
    expect(body.vacation_accrual_enabled).toBe(true);
  });
});
