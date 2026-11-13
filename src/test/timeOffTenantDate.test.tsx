import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// The Time Off page decides "today" — the earliest date the form offers and
// whether approved time off can still be cancelled — on the TENANT calendar
// (America/Chicago), exactly as the server does (approved is cancellable only
// while today < start_date). Never the UTC date, never the device's: the suite
// runs with the device in Asia/Kolkata, so all three disagree near midnight.

const server = vi.hoisted(() => ({ requests: [] as unknown[], posts: [] as string[] }));

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(m: string, s: number) {
      super(m);
      this.status = s;
    }
    firstError() {
      return this.message;
    }
  }
  const api = {
    getToken: () => 'tok',
    get: async (path: string) => {
      if (path === '/time-off/vacation-status') {
        return { success: true, data: { available: 24.5, accrual_enabled: true, is_eligible: true, eligibility_date: null } };
      }
      if (path === '/time-off/requests') return { success: true, data: server.requests };
      return { success: true, data: [] };
    },
    post: async (path: string) => {
      server.posts.push(path);
      return { success: true, data: {} };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ timezone: 'America/Chicago' }) }));

import TimeOffManager from '../components/TimeOffManager';

const request = (id: number, label: string, status: string, start: string) => ({
  id, employee_id: 7, employee_name: 'Ada Clockwell', type: { code: label === 'Vacation' ? 'vacation' : 'unpaid', label }, status,
  start_date: start, end_date: start, requested_hours: 9.5, approved_hours: status === 'approved' ? 9.5 : null,
  is_paid: true, is_balance_tracked: true, balance_bucket: 'vacation', notes: null, source: 'employee', decided_at: null,
  decision_reason: null, cancelled_at: null, cancellation_reason: null, days: [], created_at: null,
});

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// [moment, instant (UTC), the tenant (Central) calendar date at that instant]
const CASES: [string, string, string][] = [
  ['6:00 PM CST (standard time): UTC is already tomorrow', '2026-11-13T00:00:00Z', '2026-11-12'],
  ['6:30 PM CST: the device (Kolkata) is already tomorrow too', '2026-11-13T00:30:00Z', '2026-11-12'],
  ['11:59 PM CST', '2026-11-13T05:59:59Z', '2026-11-12'],
  ['midnight CST starts the next Central day', '2026-11-13T06:00:00Z', '2026-11-13'],
  ['spring forward eve: 11:30 PM CST', '2026-03-08T05:30:00Z', '2026-03-07'],
  ['spring forward day: midnight CST', '2026-03-08T06:00:00Z', '2026-03-08'],
  ['first CDT night: 11:59 PM CDT (UTC−5)', '2026-03-09T04:59:00Z', '2026-03-08'],
  ['first CDT midnight (UTC−5)', '2026-03-09T05:00:00Z', '2026-03-09'],
  ['fall back eve: 11:59 PM CDT', '2026-11-01T04:59:00Z', '2026-10-31'],
  ['fall back day: midnight CDT', '2026-11-01T05:00:00Z', '2026-11-01'],
  ['first CST night after fall back: 11:30 PM CST (UTC−6)', '2026-11-02T05:30:00Z', '2026-11-01'],
  ['first CST midnight after fall back', '2026-11-02T06:00:00Z', '2026-11-02'],
];

beforeEach(() => {
  server.posts = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Time Off uses the tenant calendar date', () => {
  it.each(CASES)('%s', async (_moment, instant, today) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instant));
    const tomorrow = shift(today, 1);
    server.requests = [
      request(3, 'Vacation', 'approved', today), // started today (tenant) — admin only
      request(2, 'Vacation', 'approved', tomorrow), // not started yet — employee may cancel
      request(1, 'Unpaid Time Off', 'pending', today), // pending — always cancellable
    ];

    render(<TimeOffManager />);
    const [startedToday, startsTomorrow, pending] = await screen.findAllByRole('listitem');
    expect(within(startedToday).queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(within(startsTomorrow).getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
    expect(within(pending).getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();

    // Both date pickers start at the tenant's today: it is selectable, the day before is not,
    // and the calendar opens on the tenant's month.
    for (const label of ['Start Date', 'End Date']) {
      fireEvent.click(screen.getByLabelText(`${label} calendar`));
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.getByRole('button', { name: today })).toBeEnabled();
      expect(dialog.getByRole('button', { name: tomorrow.slice(0, 7) === today.slice(0, 7) ? tomorrow : today })).toBeEnabled();
      const yesterday = shift(today, -1);
      if (!dialog.queryByRole('button', { name: yesterday })) fireEvent.click(dialog.getByRole('button', { name: 'Previous month' }));
      expect(dialog.getByRole('button', { name: yesterday })).toBeDisabled();
      fireEvent.click(screen.getByLabelText(`${label} calendar`));
    }
  });

  it('cancelling a not-yet-started approved request at 6:30 PM Central reaches the server', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T00:30:00Z')); // Nov 12, 6:30 PM CST; UTC already Nov 13
    server.requests = [request(9, 'Vacation', 'approved', '2026-11-13')];

    render(<TimeOffManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));
    await vi.waitFor(() => expect(server.posts).toEqual(['/time-off/requests/9/cancel']));
  });
});
