import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Fake employee history API. Records calls and serves the compact synopsis + the
// full per-day Work History (current / previous / custom), so the tests prove the
// read-only wiring end-to-end.
const server = vi.hoisted(() => ({ calls: [] as string[] }));

const ZERO = {
  paid_seconds: 0, paid_hours: 0, unpaid_seconds: 0, unpaid_hours: 0, gross_seconds: 0, gross_hours: 0,
  lunch_seconds: 0, other_break_seconds: 0, shift_count: 0, open_shift_count: 0, has_open_shift: false,
};

const NO_POS = { clock_in: null, lunch_start: null, lunch_end: null, other_start: null, other_end: null, clock_out: null };

// Sidebar synopsis: two worked days + one Missing-Clock-Out Pending day, newest first.
const SYNOPSIS = {
  period: { from: '2026-09-14', to: '2026-09-27', timezone: 'UTC', label: 'Sep 14 – Sep 27, 2026' },
  days: [
    {
      date: '2026-09-16', day_label: 'Wed, Sep 16', weekday_label: 'Wed',
      clock_in: '2026-09-16T13:02:00+00:00', clock_out: null, lunch_seconds: 0,
      paid_seconds: 0, paid_hours: 0, pending: true, pending_reasons: ['Missing Clock Out'], clock_out_unverified: true,
    },
    {
      date: '2026-09-15', day_label: 'Tue, Sep 15', weekday_label: 'Tue',
      clock_in: '2026-09-15T13:55:00+00:00', clock_out: '2026-09-15T22:40:00+00:00', lunch_seconds: 2700,
      paid_seconds: 32400, paid_hours: 9.0, pending: false, pending_reasons: [], clock_out_unverified: false,
    },
    {
      date: '2026-09-14', day_label: 'Mon, Sep 14', weekday_label: 'Mon',
      clock_in: '2026-09-14T13:00:00+00:00', clock_out: '2026-09-14T22:00:00+00:00', lunch_seconds: 1800,
      paid_seconds: 34200, paid_hours: 9.5, pending: false, pending_reasons: [], clock_out_unverified: false,
    },
  ],
};

// Full Work History (current period): one worked day + one Pending day.
const HISTORY_CUR = {
  employee: { id: 7, full_name: 'Gary Jez' },
  period: { from: '2026-09-14', to: '2026-09-27', timezone: 'UTC', label: 'Sep 14 – Sep 27, 2026' },
  totals: {
    paid_seconds: 34200, paid_hours: 9.5, unpaid_seconds: 1800, unpaid_hours: 0.5, gross_seconds: 36000, gross_hours: 10,
    lunch_seconds: 1800, other_break_seconds: 0, shift_count: 1, open_shift_count: 0, has_open_shift: false,
  },
  days: [
    {
      date: '2026-09-15', day_of_week: 2, weekday_label: 'Tue', day_label: 'Tue, Sep 15', day_type: 'Working Day',
      schedule: { is_working_day: true, start_at: null, end_at: null, source: 'recurring', store_id: null }, excused: null,
      positions: {
        clock_in: { event_id: 1, at: '2026-09-15T13:00:00+00:00', source: 'employee' },
        lunch_start: { event_id: 2, at: '2026-09-15T17:00:00+00:00', source: 'employee' },
        lunch_end: { event_id: 3, at: '2026-09-15T17:30:00+00:00', source: 'employee' },
        other_start: null, other_end: null,
        clock_out: { event_id: 4, at: '2026-09-15T22:00:00+00:00', source: 'employee' },
      },
      event_count: 4, has_extra_events: false, pending: false, pending_reasons: [], clock_out_unverified: false, flags: [],
      paid_seconds: 34200, paid_hours: 9.5, unpaid_seconds: 1800, unpaid_hours: 0.5, gross_seconds: 36000, gross_hours: 10,
      lunch_seconds: 1800, other_break_seconds: 0, shift_count: 1, open_shift_count: 0, has_open_shift: false,
    },
    {
      date: '2026-09-16', day_of_week: 3, weekday_label: 'Wed', day_label: 'Wed, Sep 16', day_type: 'Working Day',
      schedule: { is_working_day: true, start_at: null, end_at: null, source: 'recurring', store_id: null }, excused: null,
      positions: {
        ...NO_POS,
        clock_in: { event_id: 5, at: '2026-09-16T13:02:00+00:00', source: 'employee' },
      },
      event_count: 1, has_extra_events: false, pending: true, pending_reasons: ['Missing Clock Out'], clock_out_unverified: true, flags: ['pending'],
      ...ZERO,
    },
  ],
};

// Previous period: no activity (proves the selector re-fetches with period=previous).
const HISTORY_PREV = {
  employee: { id: 7, full_name: 'Gary Jez' },
  period: { from: '2026-08-31', to: '2026-09-13', timezone: 'UTC', label: 'Aug 31 – Sep 13, 2026' },
  totals: { ...ZERO },
  days: [],
};

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  const api = {
    getToken: () => 'tok',
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path.startsWith('/history/synopsis')) return { success: true, ...SYNOPSIS };
      if (path.startsWith('/history')) {
        if (path.includes('period=previous')) return { success: true, ...HISTORY_PREV };
        return { success: true, ...HISTORY_CUR };
      }
      return { success: true, data: [] };
    },
    post: async () => ({ success: true }),
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import WorkHistorySynopsis from '../components/history/WorkHistorySynopsis';
import EmployeeWorkHistory from '../components/history/EmployeeWorkHistory';
import TimeClockCard from '../components/TimeClockCard';

const renderRouted = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  server.calls = [];
});

// TimeClockCard no longer owns the Work Schedule button (moved to the sidebar).
vi.mock('../contexts/TimeClockContext', () => ({
  useTimeClock: () => ({
    status: 'off', statusLabel: 'Clocked Out', allowedActions: [] as string[],
    shift: null, loading: false, working: false, error: null, perform: async () => undefined,
  }),
}));

describe('Dashboard cleanup', () => {
  it('the Time Clock card no longer contains a Work Schedule button', () => {
    renderRouted(<TimeClockCard />);
    expect(screen.getByText('Time Clock')).toBeInTheDocument();
    expect(screen.queryByText('Work Schedule')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Sidebar Work History synopsis', () => {
  it('shows Work History and Work Schedule buttons that navigate correctly', async () => {
    renderRouted(<WorkHistorySynopsis />);
    const history = await screen.findByRole('link', { name: /Work History/ });
    const schedule = screen.getByRole('link', { name: /Work Schedule/ });
    expect(history).toHaveAttribute('href', '/history');
    expect(schedule).toHaveAttribute('href', '/schedule');
  });

  it('renders the compact Date / Clock In / Lunch / Clock Out / Hours table', async () => {
    renderRouted(<WorkHistorySynopsis />);
    for (const h of ['Date', 'Clock In', 'Lunch', 'Clock Out', 'Hours']) {
      expect(await screen.findByText(h)).toBeInTheDocument();
    }
    // Most recent first.
    const rows = screen.getAllByRole('row');
    // rows[0] is the header; rows[1] is the newest day (Wed).
    expect(within(rows[1]).getByText('Wed, Sep 16')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Mon, Sep 14')).toBeInTheDocument();
  });

  it('shows Lunch as a duration and Hours as the canonical paid value', async () => {
    renderRouted(<WorkHistorySynopsis />);
    expect(await screen.findByText('30 min')).toBeInTheDocument(); // 1800s
    expect(screen.getByText('45 min')).toBeInTheDocument(); // 2700s
    expect(screen.getByText('9.5')).toBeInTheDocument(); // paid_hours 9.5
    expect(screen.getByText('9')).toBeInTheDocument(); // paid_hours 9.0
  });

  it('shows a Pending day as Pending / Missing rather than a zero-hour day', async () => {
    renderRouted(<WorkHistorySynopsis />);
    const rows = await screen.findAllByRole('row');
    const pendingRow = rows[1]; // Wed, Sep 16 (Missing Clock Out)
    expect(within(pendingRow).getByText('Missing')).toBeInTheDocument();
    expect(within(pendingRow).getByText('Pending')).toBeInTheDocument();
    // It is NOT rendered as 0 / 0.0.
    expect(within(pendingRow).queryByText('0')).not.toBeInTheDocument();
    expect(within(pendingRow).queryByText('0.0')).not.toBeInTheDocument();
  });
});

describe('Full employee Work History screen', () => {
  it('loads the current period on mount with no employee selector', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(); // no employee picker
    expect(server.calls.some((c) => c.startsWith('GET /history?period=current'))).toBe(true);
  });

  it('renders Current / Previous / Custom controls and full punch columns', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    expect(screen.getByRole('button', { name: /current period/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous period/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Custom$/i })).toBeInTheDocument();
    for (const col of ['Clock In', 'Lunch Out', 'Lunch In', 'Break Out', 'Break In', 'Clock Out']) {
      expect(screen.getByText(col)).toBeInTheDocument();
    }
  });

  it('orders the summary cards Paid → Unpaid → Total Worked', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    const body = document.body.textContent ?? '';
    expect(body.indexOf('Paid')).toBeGreaterThanOrEqual(0);
    expect(body.indexOf('Paid')).toBeLessThan(body.indexOf('Unpaid'));
    expect(body.indexOf('Unpaid')).toBeLessThan(body.indexOf('Total Worked'));
  });

  it('has zero mutation controls (no Add / Edit / Delete / Correction / Actions)', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    expect(screen.queryByText(/Add time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Actions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Adjust/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Void|Delete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ledger/i)).not.toBeInTheDocument();
  });

  it('makes Pending days obvious rather than a finalized zero', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    expect(screen.getByText(/Pending — Missing Clock Out/)).toBeInTheDocument();
    expect(screen.getByText('Missing / Pending')).toBeInTheDocument();
  });

  it('switches to the Previous period and re-fetches', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    fireEvent.click(screen.getByRole('button', { name: /previous period/i }));
    await screen.findByText('Aug 31 – Sep 13, 2026');
    expect(server.calls.some((c) => c.startsWith('GET /history?period=previous'))).toBe(true);
  });

  it('supports a Custom date range', async () => {
    renderRouted(<EmployeeWorkHistory />);
    await screen.findByText('Sep 14 – Sep 27, 2026');
    fireEvent.click(screen.getByRole('button', { name: /^Custom$/i }));
    const refresh = screen.getByRole('button', { name: /Refresh/i });
    // The switch to Custom auto-loads; wait for it to settle (Refresh re-enables).
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-07' } });
    fireEvent.click(refresh);
    await waitFor(() =>
      expect(server.calls.some((c) => c.includes('/history?from=2026-09-01&to=2026-09-07'))).toBe(true),
    );
  });
});
