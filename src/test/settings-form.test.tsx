import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Regression tests for the Settings input FOCUS bug: numeric/text fields were
// losing focus after every keystroke because Section/NumberField/MessageField
// were declared inside the render body (new identity each render → remount).
// These tests exercise the real component + real settings lib over a mocked API.

const server = vi.hoisted(() => ({ calls: [] as string[], lastBody: null as any }));

const SETTINGS = {
  pay_increments: 5,
  pay_period_type: 'biweekly',
  pay_period_start_date: '2026-01-01',
  minimum_lunch_duration_minutes: 30,
  default_lunch_duration_minutes: 45,
  auto_lunch_minutes: 60,
  auto_lunch_message: 'lunch msg',
  first_clock_in_reminder_minutes: 30,
  second_clock_in_reminder_minutes: 45,
  clock_in_message_1: 'back 1',
  clock_in_message_2: 'back 2',
  missed_clock_out_reminder_minutes: 15,
  missed_clock_out_message: 'missed',
  auto_clock_out_warning_minutes: 15,
  auto_clock_out_warning_message: 'warn',
  auto_clock_out_time: null,
  auto_clock_out_limit_minutes: 0,
  auto_clock_out_message: 'auto',
  max_shift_hours: 16,
  attendance_grace_minutes: 5,
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
});

describe('Settings form — focus retention', () => {
  it('accepts 180 from a single focus/click and keeps focus on the same input the whole time', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Missed-Lunch Reminder Lead (minutes)') as HTMLInputElement;
    await user.click(input); // one click to focus
    expect(document.activeElement).toBe(input);

    await user.keyboard('{Control>}a{/Control}'); // select the existing 60
    await user.keyboard('180'); // type continuously, no re-click

    expect(input.value).toBe('180');
    // The SAME node is still mounted and focused (would fail if it remounted).
    expect(control('Missed-Lunch Reminder Lead (minutes)')).toBe(input);
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

    const input = control('Mandatory Lunch (minutes)') as HTMLInputElement; // starts at 45
    expect(input.value).toBe('45');
    await user.tripleClick(input); // select existing value
    await user.keyboard('120');

    expect(input.value).toBe('120');
    expect(document.activeElement).toBe(input);
  });

  it('backspace/delete clears digits and does not snap back to the old/default value', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const input = control('Missed-Lunch Reminder Lead (minutes)') as HTMLInputElement; // 60
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

    const input = control('Max Open Shift (hours)') as HTMLInputElement;
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
    expect(body.auto_lunch_message).toBe('Take lunch');
    // Full canonical key set still present and untouched where unedited.
    expect(body.pay_period_type).toBe('biweekly');
    expect(body.max_shift_hours).toBe(16);
    expect(body.auto_clock_out_time).toBeNull();
    expect(Object.keys(body).length).toBe(Object.keys(SETTINGS).length);
  });
});
