import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Employee READ-ONLY Work Schedule: mode toggle, range modes, split-store, Day
// Off vs blank, and the approved-time-off overlay (Vacation / Unpaid / generic
// Time Off) — all with NO edit controls and NO private PTO data.

const server = vi.hoisted(() => ({ calls: [] as string[], emptyMe: false }));

const DATES = [
  { date: '2026-09-14', day_of_week: 1, weekday_label: 'Mon', day_label: 'Mon, Sep 14' },
  { date: '2026-09-15', day_of_week: 2, weekday_label: 'Tue', day_label: 'Tue, Sep 15' },
  { date: '2026-09-16', day_of_week: 3, weekday_label: 'Wed', day_label: 'Wed, Sep 16' },
  { date: '2026-09-17', day_of_week: 4, weekday_label: 'Thu', day_label: 'Thu, Sep 17' },
  { date: '2026-09-18', day_of_week: 5, weekday_label: 'Fri', day_label: 'Fri, Sep 18' },
];

const STORES = [
  { id: 1, name: 'Waverly', color: '#2563eb', hours: {} },
  { id: 2, name: 'Bon Aqua', color: '#16a34a', hours: {} },
];

const seg = (start: string, end: string, store_id: number) => ({ segment_id: 1, store_id, start, end, overnight: false, editable: false });

// mode=me: split-store Monday, Day Off Tuesday, Vacation Wed–Thu, blank Friday.
const ME = {
  success: true,
  mode: 'me',
  range: { from: '2026-09-14', to: '2026-09-18', view: 'this_week', label: 'Sep 14 – Sep 18, 2026', timezone: 'America/Chicago' },
  employee: { id: 7, full_name: 'Gary Jez' },
  dates: DATES,
  stores: STORES,
  employee_view: [
    { store_id: 1, cells: { '2026-09-14': [seg('08:00', '12:00', 1)] } },
    { store_id: 2, cells: { '2026-09-14': [seg('12:00', '17:00', 2)] } },
  ],
  day_offs: ['2026-09-15'],
  time_off: {
    '2026-09-16': { status: 'vacation', label: 'Vacation', is_full_day: true },
    '2026-09-17': { status: 'vacation', label: 'Vacation', is_full_day: true },
  },
};

// mode=all: two coworkers, alphabetical, coworker on Unpaid + generic Time Off.
const ALL = {
  success: true,
  mode: 'all',
  range: ME.range,
  dates: DATES,
  stores: STORES,
  employees: [
    { id: 3, full_name: 'Ada Ant' },
    { id: 9, full_name: 'Zoe Zed' },
  ],
  store_view: [
    {
      store_id: 1,
      rows: [
        { employee: { id: 3, full_name: 'Ada Ant' }, cells: { '2026-09-14': [seg('09:00', '17:00', 1)] }, time_off: {} },
        {
          employee: { id: 9, full_name: 'Zoe Zed' },
          cells: { '2026-09-14': [seg('09:00', '17:00', 1)] },
          time_off: { '2026-09-15': { status: 'unpaid_time_off', label: 'Unpaid Time Off', is_full_day: true }, '2026-09-16': { status: 'time_off', label: 'Time Off', is_full_day: true } },
        },
      ],
    },
    { store_id: 2, rows: [] },
  ],
};

const EMPTY_ME = { ...ME, employee_view: [], day_offs: [], time_off: {} };

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(m: string, s: number) {
      super(m);
      this.name = 'ApiError';
      this.status = s;
    }
    firstError() {
      return this.message;
    }
  }
  const api = {
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path.includes('mode=all')) return ALL;
      if (server.emptyMe) return EMPTY_ME;
      return ME;
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import EmployeeWorkSchedule from '../components/schedule/EmployeeWorkSchedule';

beforeEach(() => {
  server.calls = [];
  server.emptyMe = false;
});

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('Employee Work Schedule — scope + range', () => {
  it('renders the All Employees | Employee Only toggle and defaults to Employee Only + This Week', async () => {
    render(<EmployeeWorkSchedule />);
    expect(await screen.findByRole('button', { name: 'Employee Only' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Employees' })).toBeInTheDocument();
    // Defaults: mode=me, view=this_week.
    await vi.waitFor(() => expect(server.calls.some((c) => c.includes('mode=me') && c.includes('view=this_week'))).toBe(true));
    expect(screen.queryByText(/mode=all/)).toBeNull();
  });

  it('This Week / Next Week / Month drive the canonical range param', async () => {
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    fireEvent.click(screen.getByRole('button', { name: 'Next Week' }));
    await vi.waitFor(() => expect(server.calls.some((c) => c.includes('view=next_week'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    await vi.waitFor(() => expect(server.calls.some((c) => c.includes('view=month'))).toBe(true));
  });

  it('Monday is the first date column', async () => {
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    const cols = screen.getAllByRole('columnheader');
    // First column is the row label ("Store"); the first DATE column is Monday.
    expect(cols[0].textContent).toBe('Store');
    expect(cols[1].textContent).toContain('Mon');
  });
});

describe('Employee Only — my schedule', () => {
  it('shows split-store segments under the correct stores', async () => {
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    // Waverly row → 08:00–12:00; Bon Aqua row → 12:00–5:00.
    expect(within(row('Waverly')).getByText(/8:00 AM – 12:00 PM/)).toBeInTheDocument();
    expect(within(row('Bon Aqua')).getByText(/12:00 PM – 5:00 PM/)).toBeInTheDocument();
  });

  it('renders Day Off distinctly and leaves a blank day blank', async () => {
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    // Tuesday is an explicit Day Off (appears on the store rows).
    expect(screen.getAllByText('Day Off').length).toBeGreaterThan(0);
    // Friday is blank — shown as a muted dash, never "Day Off".
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows approved Vacation as "Vacation" in place of the shift', async () => {
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    // Wed + Thu vacation → two store rows each = at least 2 badges.
    expect(screen.getAllByText('Vacation').length).toBeGreaterThanOrEqual(2);
  });

  it('never exposes balances, accrual, or notes', async () => {
    const { container } = render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/balance/i);
    expect(text).not.toMatch(/accru/i);
    expect(text).not.toMatch(/entitlement/i);
  });

  it('shows a concise empty state when nothing is scheduled', async () => {
    server.emptyMe = true;
    render(<EmployeeWorkSchedule />);
    expect(await screen.findByText('No scheduled shifts for this period.')).toBeInTheDocument();
  });
});

describe('All Employees — read-only roster', () => {
  it('lists coworkers alphabetically with store colors and coworker absences', async () => {
    render(<EmployeeWorkSchedule />);
    fireEvent.click(await screen.findByRole('button', { name: 'All Employees' }));

    await screen.findByText('Ada Ant');
    expect(screen.getByText('Zoe Zed')).toBeInTheDocument();
    // Coworker Zoe: Unpaid Time Off (Tue) + generic Time Off (Wed).
    expect(screen.getByText('Unpaid Time Off')).toBeInTheDocument();
    expect(screen.getByText('Time Off')).toBeInTheDocument();
    // Store section header present.
    expect(screen.getByRole('heading', { name: 'Waverly' })).toBeInTheDocument();
  });
});

describe('Read-only — no management controls anywhere', () => {
  it('exposes no edit / assign / group / save controls', async () => {
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Waverly');
    for (const label of [/add employee/i, /add group/i, /manage groups/i, /^remove$/i, /^save/i, /^apply/i, /set day off/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
    // Switch to All Employees — still no controls.
    fireEvent.click(screen.getByRole('button', { name: 'All Employees' }));
    await screen.findByText('Ada Ant');
    expect(screen.queryByRole('button', { name: /add employee/i })).toBeNull();
  });
});
