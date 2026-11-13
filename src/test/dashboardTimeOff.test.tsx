import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// The simplified Employee Dashboard: Time Clock + Today's Time Entries on the
// left; this week's Work Schedule, the Work History / Work Schedule buttons and
// a compact Vacation card on the right — nothing else is fetched or shown.
// Request Time Off opens the /time-off page, which keeps the request form, the
// request history with statuses, and cancellation.

const server = vi.hoisted(() => ({
  calls: [] as string[],
  posts: [] as { path: string; body: unknown }[],
  vacation: null as unknown,
  requests: [] as unknown[],
  failSubmit: false,
  failVacation: false,
}));

const RANGE = { from: '2026-11-09', to: '2026-11-15', view: 'this_week', label: 'Nov 9 – Nov 15, 2026', timezone: 'America/Chicago' };
const DATES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
  date: `2026-11-${String(9 + i).padStart(2, '0')}`, day_of_week: (i + 1) % 7, weekday_label: d, day_label: `${d}, Nov ${9 + i}`,
}));
const daily = Object.fromEntries(DATES.map((d, i) => [d.date, i < 5 ? 34200 : 0]));
const WEEK = {
  success: true, mode: 'me', range: RANGE, employee: { id: 7, full_name: 'Ada Clockwell' }, dates: DATES,
  stores: [{ id: 1, name: 'Bon Aqua', color: '#059669', hours: {} }],
  employee_view: [{
    store_id: 1,
    cells: Object.fromEntries(DATES.slice(0, 5).map((d, i) => [d.date, [{ segment_id: i + 1, store_id: 1, start: '07:00', end: '17:00', overnight: false, editable: false }]])),
    holidays: {},
    scheduled_hours: { total_seconds: 171000, daily_seconds: daily },
  }],
  day_offs: [], time_off: {}, day_status: {},
  scheduled_hours: { total_seconds: 171000, daily_seconds: daily, overlap_seconds: 0 },
};

const ZERO = {
  paid_seconds: 0, paid_hours: 0, unpaid_seconds: 0, unpaid_hours: 0, gross_seconds: 0, gross_hours: 0,
  lunch_seconds: 0, other_break_seconds: 0, shift_count: 0, open_shift_count: 0, has_open_shift: false,
};
const HISTORY = {
  success: true, employee: { id: 7, full_name: 'Ada Clockwell' },
  period: { from: '2026-11-09', to: '2026-11-22', timezone: 'America/Chicago', label: 'Nov 9 – Nov 22, 2026' }, totals: ZERO, days: [],
};

const VACATION = {
  available: 24.5, accrual_enabled: true, annual_entitlement_hours: 80, using_override: false, effective_rate: 0.038462,
  eligibility_date: '2026-04-01', is_eligible: true, accrual_year: 2026, accrued_this_year: 24.5, annual_remaining_capacity: 55.5,
};

const request = (id: number, code: string, label: string, status: string, start: string, end: string) => ({
  id, employee_id: 7, employee_name: 'Ada Clockwell', type: { code, label }, status, start_date: start, end_date: end,
  requested_hours: 9.5, approved_hours: status === 'approved' ? 9.5 : null, is_paid: code === 'vacation', is_balance_tracked: code === 'vacation',
  balance_bucket: code === 'vacation' ? 'vacation' : null, notes: null, source: 'employee', decided_at: null, decision_reason: null,
  cancelled_at: null, cancellation_reason: null, days: [], created_at: null,
});
const REQUESTS = [
  request(4, 'vacation', 'Vacation', 'pending', '2099-12-21', '2099-12-24'),
  request(3, 'vacation', 'Vacation', 'approved', '2099-11-27', '2099-11-27'),
  request(2, 'unpaid', 'Unpaid Time Off', 'denied', '2020-10-30', '2020-10-30'),
  request(1, 'vacation', 'Vacation', 'cancelled', '2020-09-28', '2020-10-02'),
];

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
      server.calls.push(path);
      if (path.startsWith('/schedule')) return WEEK;
      if (path.startsWith('/history')) return HISTORY;
      if (path === '/time-off/vacation-status') {
        if (server.failVacation) throw new ApiError('Could not load your vacation balance.', 500);
        return { success: true, data: server.vacation };
      }
      if (path === '/time-off/requests') return { success: true, data: server.requests };
      return { success: true, data: [] };
    },
    post: async (path: string, body?: unknown) => {
      server.posts.push({ path, body });
      if (path === '/time-off/requests' && server.failSubmit) throw new ApiError('Requests must be for scheduled days.', 422);
      return { success: true, data: {} };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7 },
    employee: { id: 7, first_name: 'Ada', last_name: 'Clockwell', role: 'employee' },
    isAdmin: false,
    timezone: 'America/Chicago',
    can: () => false,
    signOut: vi.fn(),
  }),
}));

vi.mock('../contexts/TimeClockContext', () => ({
  useTimeClock: () => ({
    state: null, status: 'off', statusLabel: 'Clocked Out', allowedActions: [] as string[],
    shift: null, openBreak: null, loading: false, working: false, error: null, perform: async () => undefined,
  }),
}));

vi.mock('../components/TodayTimeEntries', () => ({ default: () => <div>Today's Time Entries</div> }));

import EmployeeDashboard from '../pages/EmployeeDashboard';
import WorkHistoryPage from '../pages/WorkHistoryPage';
import SchedulePage from '../pages/SchedulePage';
import TimeOffPage from '../pages/TimeOffPage';

const renderApp = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="/history" element={<WorkHistoryPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/time-off" element={<TimeOffPage />} />
      </Routes>
    </MemoryRouter>,
  );

const pageHeading = () => screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent);

beforeEach(() => {
  server.calls = [];
  server.posts = [];
  server.vacation = VACATION;
  server.requests = REQUESTS;
  server.failSubmit = false;
  server.failVacation = false;
});

describe('Employee Dashboard — only what employees need immediately', () => {
  it('shows the weekly schedule on its own, then the two buttons, then a compact Vacation card', async () => {
    renderApp();
    const schedule = await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    expect(screen.getByText('47.50 hrs')).toBeInTheDocument();
    expect(await screen.findByText('24.50')).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Work History and Work Schedule' });
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Work History', '/history'],
      ['Work Schedule', '/schedule'],
    ]);
    const vacation = screen.getByRole('link', { name: /Request Time Off/ });
    expect(schedule.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.compareDocumentPosition(vacation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The right column holds exactly those three; the left keeps the Time Clock and today's entries.
    const [left, right] = Array.from((screen.getByText('Time Clock').closest('.grid') as HTMLElement).children);
    expect(right.children).toHaveLength(3);
    expect(left.textContent).toContain('Time Clock');
    expect(left.textContent).toContain("Today's Time Entries");
  });

  it('has no Work History preview — nothing shown and nothing fetched', async () => {
    renderApp();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    await screen.findByText('24.50');
    expect(screen.queryByText('No recent time activity this pay period.')).toBeNull();
    expect(screen.queryByText('Loading recent history…')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Clock In' })).toBeNull();
    expect(server.calls.some((c) => c.startsWith('/history'))).toBe(false);
  });

  it('has no vacation request history — nothing shown and no requests fetched', async () => {
    renderApp();
    await screen.findByText('24.50');
    expect(screen.queryByRole('listitem')).toBeNull();
    for (const status of ['pending', 'approved', 'denied', 'cancelled']) expect(screen.queryByText(new RegExp(status, 'i'))).toBeNull();
    expect(screen.queryByText('My Requests')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(server.calls).not.toContain('/time-off/requests');
  });

  it('shows when accrual begins for an employee who is not yet eligible', async () => {
    server.vacation = { ...VACATION, available: 0, is_eligible: false, eligibility_date: '2099-04-01' };
    renderApp();
    expect(await screen.findByText('Accrual begins Apr 1, 2099')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('a balance failure keeps Request Time Off usable', async () => {
    server.failVacation = true;
    renderApp();
    expect(await screen.findByText('Could not load your vacation balance.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request Time Off/ })).toHaveAttribute('href', '/time-off');
  });
});

describe('Dashboard buttons', () => {
  it('Work History opens the full Work History page', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('link', { name: 'Work History' }));
    expect(await screen.findByText('Nov 9 – Nov 22, 2026')).toBeInTheDocument();
    expect(pageHeading()).toContain('Work History');
    expect(server.calls.some((c) => c.startsWith('/history?period=current'))).toBe(true);
  });

  it('Work Schedule opens the unchanged Work Schedule page', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('link', { name: 'Work Schedule' }));
    expect(await screen.findByRole('button', { name: 'Employee Only' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Employees' })).toBeInTheDocument();
    expect(pageHeading()).toContain('Work Schedule');
  });

  it('Request Time Off opens the Time Off page', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('link', { name: /Request Time Off/ }));
    expect(await screen.findByRole('button', { name: 'Submit Request' })).toBeInTheDocument();
    expect(pageHeading()).toContain('Time Off');
  });
});

describe('Time Off page', () => {
  it('shows the balance, the request form, and every request with its status', async () => {
    renderApp('/time-off');
    expect(await screen.findByText('24.50')).toBeInTheDocument();
    const options = Array.from((screen.getByLabelText('Type') as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(['Vacation', 'Unpaid Time Off']);
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();

    const list = within(screen.getByRole('region', { name: 'My Requests' }));
    const rows = list.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatch(/^Vacation · Dec 21.*pending$/);
    expect(rows[1]).toMatch(/^Vacation · Nov 27.*approved$/);
    expect(rows[2]).toMatch(/^Unpaid Time Off · Oct 30.*denied$/);
    expect(rows[3]).toMatch(/^Vacation · Sep 28.*cancelled$/);
    // Cancellation follows the existing rule: pending, or approved and not yet started.
    expect(list.getAllByRole('button', { name: 'Cancel request' })).toHaveLength(2);
  });

  it('submits a request and refreshes the request history', async () => {
    renderApp('/time-off');
    await screen.findByText('24.50');
    const before = server.calls.filter((c) => c === '/time-off/requests').length;
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'unpaid' } });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2099-09-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Time off request submitted.');
    expect(server.posts).toEqual([{ path: '/time-off/requests', body: { type_code: 'unpaid', start_date: '2099-09-14', end_date: '2099-09-14', notes: undefined } }]);
    expect(server.calls.filter((c) => c === '/time-off/requests').length).toBe(before + 1);
  });

  it('a refused request shows the server’s reason and keeps what was entered', async () => {
    server.failSubmit = true;
    renderApp('/time-off');
    await screen.findByText('24.50');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2099-09-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    expect(await screen.findByText('Requests must be for scheduled days.')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toHaveValue('2099-09-14');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cancels a request and refreshes the history', async () => {
    renderApp('/time-off');
    await screen.findByText('24.50');
    const before = server.calls.filter((c) => c === '/time-off/requests').length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel request' })[0]);
    await vi.waitFor(() => expect(server.calls.filter((c) => c === '/time-off/requests').length).toBe(before + 1));
    expect(server.posts.map((p) => p.path)).toEqual(['/time-off/requests/4/cancel']);
  });

  it('says so when there are no requests', async () => {
    server.requests = [];
    renderApp('/time-off');
    expect(await screen.findByText('You have no time off requests.')).toBeInTheDocument();
  });

  it('returns to the dashboard', async () => {
    renderApp('/time-off');
    await screen.findByText('24.50');
    const back = screen.getByRole('link', { name: 'Back to Dashboard' });
    expect(back).toHaveAttribute('href', '/');
    fireEvent.click(back);
    expect(await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026')).toBeInTheDocument();
  });
});
