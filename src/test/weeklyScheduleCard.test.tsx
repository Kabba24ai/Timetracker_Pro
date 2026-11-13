import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Employee Dashboard → this week's Work Schedule card: loads on its own (no
// click) from the canonical mode=me endpoint, shows Monday–Sunday with real
// store names, statuses decided exactly as the full Work Schedule page decides
// them, and the server's Total Scheduled Hours. The full /schedule page and its
// button are untouched.

const server = vi.hoisted(() => ({
  calls: [] as string[],
  me: null as unknown,
  failSchedule: false,
}));

const RANGE = { from: '2026-11-09', to: '2026-11-15', view: 'this_week', label: 'Nov 9 – Nov 15, 2026', timezone: 'America/Chicago' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATES = DAYS.map((d, i) => {
  const date = `2026-11-${String(9 + i).padStart(2, '0')}`;
  return { date, day_of_week: (i + 1) % 7, weekday_label: d, day_label: `${d}, Nov ${9 + i}` };
});
const BON_AQUA = { id: 1, name: 'Bon Aqua', color: '#059669', hours: {} };
const WAVERLY = { id: 2, name: 'Waverly/Gorman', color: '#2563EB', hours: {} };

const seg = (id: number, store_id: number, start: string, end: string) => ({ segment_id: id, store_id, start, end, overnight: false, editable: false });
const daily = (h: Record<string, number>) => Object.fromEntries(DATES.map((d) => [d.date, Math.round((h[d.date] ?? 0) * 3600)]));
const figure = (h: Record<string, number>) => {
  const d = daily(h);
  return { total_seconds: Object.values(d).reduce((a, b) => a + b, 0), daily_seconds: d };
};

// Mon/Tue Bon Aqua; Wed Waverly on Veterans Day; Thu split across both stores;
// Fri approved full-day Vacation (the shift is still on the schedule); Sat half
// day; Sun nothing. Scheduled hours exclude Friday: 10+10+10+9+5 = 44.
const WEEK = {
  success: true,
  mode: 'me',
  range: RANGE,
  employee: { id: 7, full_name: 'Ada Clockwell' },
  dates: DATES,
  stores: [BON_AQUA, WAVERLY],
  employee_view: [
    {
      store_id: 1,
      cells: {
        '2026-11-09': [seg(1, 1, '07:00', '17:00')],
        '2026-11-10': [seg(2, 1, '07:00', '17:00')],
        '2026-11-12': [seg(3, 1, '07:00', '12:00')],
        '2026-11-13': [seg(4, 1, '07:00', '17:00')],
        '2026-11-14': [seg(5, 1, '07:00', '12:00')],
      },
      holidays: {},
      scheduled_hours: figure({ '2026-11-09': 10, '2026-11-10': 10, '2026-11-12': 5, '2026-11-14': 5 }),
    },
    {
      store_id: 2,
      cells: { '2026-11-11': [seg(6, 2, '07:00', '17:00')], '2026-11-12': [seg(7, 2, '13:00', '17:00')] },
      holidays: { '2026-11-11': [{ id: 3, name: 'Veterans Day' }] },
      scheduled_hours: figure({ '2026-11-11': 10, '2026-11-12': 4 }),
    },
  ],
  day_offs: [],
  time_off: { '2026-11-13': { status: 'vacation', label: 'Vacation', is_full_day: true } },
  day_status: {},
  scheduled_hours: { ...figure({ '2026-11-09': 10, '2026-11-10': 10, '2026-11-11': 10, '2026-11-12': 9, '2026-11-14': 5 }), overlap_seconds: 0 },
};

// Privacy-safe status (the server already collapsed the reason) + explicit day off.
const STATUSES = {
  ...WEEK,
  employee_view: [{ store_id: 1, cells: { '2026-11-09': [seg(1, 1, '08:00', '16:30')] }, holidays: {}, scheduled_hours: figure({ '2026-11-09': 8.5 }) }],
  time_off: {},
  day_status: { '2026-11-10': { status: 'time_off', label: 'Time Off', is_full_day: true } },
  day_offs: ['2026-11-15'],
  scheduled_hours: { ...figure({ '2026-11-09': 8.5 }), overlap_seconds: 0 },
};

const EMPTY = { ...WEEK, employee_view: [], time_off: {}, day_status: {}, day_offs: [], scheduled_hours: { ...figure({}), overlap_seconds: 0 } };

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
      if (path.startsWith('/schedule')) {
        if (server.failSchedule) throw new ApiError('Could not load your schedule.', 500);
        return server.me;
      }
      return { success: true, data: [] };
    },
    post: async () => ({ success: true }),
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
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

// Unrelated dashboard panels are stubbed so these tests isolate the schedule card.
vi.mock('../components/TodayTimeEntries', () => ({ default: () => <div>Today's Time Entries</div> }));
vi.mock('../components/VacationSummary', () => ({ default: () => <div data-testid="vacation">Vacation · Request Time Off</div> }));

import WeeklyScheduleCard from '../components/schedule/WeeklyScheduleCard';
import EmployeeDashboard from '../pages/EmployeeDashboard';
import SchedulePage from '../pages/SchedulePage';

const dayRow = (weekday: string) => screen.getByRole('cell', { name: weekday }).closest('tr') as HTMLElement;

const renderCard = () => render(<WeeklyScheduleCard />);

const renderApp = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="/schedule" element={<SchedulePage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  server.calls = [];
  server.me = WEEK;
  server.failSchedule = false;
  vi.restoreAllMocks();
});

describe('Dashboard schedule card — loading', () => {
  it('loads the current week from the canonical endpoint without a click', async () => {
    renderCard();
    expect(await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026')).toBeInTheDocument();
    expect(server.calls).toContain('/schedule?mode=me&view=this_week');
    // Monday through Sunday, in the server's order.
    const rows = within(screen.getByRole('table', { name: /work schedule/i })).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual(DAYS);
  });

  it('shows the authenticated employee’s shifts with real store names (never placeholders)', async () => {
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    expect(within(dayRow('Mon')).getByText('7:00 AM – 5:00 PM')).toBeInTheDocument();
    expect(within(dayRow('Mon')).getByText('Bon Aqua')).toBeInTheDocument();
    expect(within(dayRow('Wed')).getByText('Waverly/Gorman')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\{Store Name\}|undefined|null/);
  });

  it('a split day lists each shift with its own store', async () => {
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    const thu = dayRow('Thu');
    expect(within(thu).getByText('7:00 AM – 12:00 PM')).toBeInTheDocument();
    expect(within(thu).getByText('1:00 PM – 5:00 PM')).toBeInTheDocument();
    expect(within(thu).getByText('Bon Aqua')).toBeInTheDocument();
    expect(within(thu).getByText('Waverly/Gorman')).toBeInTheDocument();
  });

  it('approved full-day vacation replaces the shift, a holiday sits beside it, and an empty day is Not Scheduled', async () => {
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    const fri = dayRow('Fri');
    expect(within(fri).getByText('Vacation')).toBeInTheDocument();
    expect(within(fri).queryByText('7:00 AM – 5:00 PM')).toBeNull();
    expect(within(fri).getByText('—')).toBeInTheDocument();

    const wed = dayRow('Wed');
    expect(within(wed).getByText('Veterans Day')).toBeInTheDocument();
    expect(within(wed).getByText('7:00 AM – 5:00 PM')).toBeInTheDocument();

    const sun = dayRow('Sun');
    expect(within(sun).getByText('Not Scheduled')).toBeInTheDocument();
    expect(within(sun).getByText('—')).toBeInTheDocument();
  });

  it('marks today in the TENANT timezone, not the device’s', async () => {
    // 04:30 UTC Fri Nov 13 = Thu Nov 12, 10:30 PM in Chicago (the test device runs Asia/Kolkata: already Friday).
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-13T04:30:00Z'));
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    expect(dayRow('Thu')).toHaveAttribute('aria-current', 'date');
    expect(dayRow('Fri')).not.toHaveAttribute('aria-current');
  });

  it('shows the server’s Total Scheduled Hours with two decimals', async () => {
    renderCard();
    expect(await screen.findByText('Total Scheduled Hours')).toBeInTheDocument();
    expect(screen.getByText('44.00 hrs')).toBeInTheDocument();
  });

  it('shows privacy-safe statuses and an explicit day off as delivered', async () => {
    server.me = STATUSES;
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    expect(within(dayRow('Tue')).getByText('Time Off')).toBeInTheDocument();
    expect(within(dayRow('Sun')).getByText('Day Off')).toBeInTheDocument();
    expect(within(dayRow('Mon')).getByText('8:00 AM – 4:30 PM')).toBeInTheDocument();
    expect(screen.getByText('8.50 hrs')).toBeInTheDocument();
  });

  it('a week with nothing scheduled shows a clear empty state', async () => {
    server.me = EMPTY;
    renderCard();
    expect(await screen.findByText('No shifts are scheduled for you this week.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('0.00 hrs')).toBeInTheDocument();
  });

  it('an API without scheduled hours still shows the schedule, just no total', async () => {
    server.me = { ...WEEK, scheduled_hours: undefined };
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    expect(screen.queryByText('Total Scheduled Hours')).toBeNull();
  });

  it('a load failure shows an error with a retry', async () => {
    server.failSchedule = true;
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your schedule.');

    server.failSchedule = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refreshes when the employee returns to the dashboard after a while', async () => {
    renderCard();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    const loads = () => server.calls.filter((c) => c.startsWith('/schedule')).length;
    expect(loads()).toBe(1);

    // Returning immediately does not refetch …
    window.dispatchEvent(new Event('focus'));
    expect(loads()).toBe(1);

    // … returning after more than a minute does, and shows the new schedule.
    server.me = { ...WEEK, scheduled_hours: { ...WEEK.scheduled_hours, total_seconds: 48 * 3600 } };
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 2 * 60_000);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(loads()).toBe(2));
    expect(await screen.findByText('48.00 hrs')).toBeInTheDocument();
  });
});

describe('Employee Dashboard placement', () => {
  it('puts the schedule card first, then the Work History / Work Schedule buttons, then Vacation', async () => {
    renderApp();
    const heading = await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    const nav = screen.getByRole('link', { name: /Work Schedule/ });
    const vacation = screen.getByTestId('vacation');
    expect(heading.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.compareDocumentPosition(vacation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The Time Clock is still on the dashboard.
    expect(screen.getByText('Time Clock')).toBeInTheDocument();
    expect(screen.getByText("Today's Time Entries")).toBeInTheDocument();
  });

  it('a schedule failure never affects the Time Clock', async () => {
    server.failSchedule = true;
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your schedule.');
    expect(screen.getByText('Time Clock')).toBeInTheDocument();
    expect(screen.getByText('Clocked Out')).toBeInTheDocument();
  });

  it('the existing Work Schedule button still opens the unchanged /schedule page', async () => {
    renderApp();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    const link = screen.getByRole('link', { name: /Work Schedule/ });
    expect(link).toHaveAttribute('href', '/schedule');

    fireEvent.click(link);
    // The full page: its own heading and its Employee Only / All Employees + range controls.
    expect(await screen.findByRole('heading', { level: 1, name: 'Work Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Employee Only' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Employees' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    expect(screen.queryByText('Total Scheduled Hours')).toBeNull();
  });

  it('stacks on phones and scrolls the card table sideways rather than squeezing it', async () => {
    renderApp();
    await screen.findByText('Work Schedule: Nov 9 – Nov 15, 2026');
    const grid = screen.getByText('Time Clock').closest('.grid') as HTMLElement;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('lg:grid-cols-3');
    const table = screen.getByRole('table', { name: /work schedule/i });
    expect(table.parentElement?.className).toContain('overflow-x-auto');
  });
});
