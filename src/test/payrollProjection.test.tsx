import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Work Schedule → Calculate Payroll (Phase 3): the toolbar button is shown only
// to holders of the real grant, prices the range the grid shows, re-reads the
// saved schedule on demand, and never shows an unpriced wage as money. The
// date-specific editor carries the explicit unpaid lunch to the server.

const server = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body?: unknown }[],
  token: 'tok' as string | null,
  failNextGet: null as string | null,
  unresolved: false,
}));

const auth = vi.hoisted(() => ({
  permissions: [] as string[],
  isAdmin: false,
}));

const RANGE = { from: '2026-09-14', to: '2026-09-20', view: 'this_week', label: 'Sep 14 – Sep 20, 2026', timezone: 'America/Chicago' };
const DATES = [
  { date: '2026-09-14', day_of_week: 1, weekday_label: 'Mon', day_label: 'Mon, Sep 14' },
  { date: '2026-09-15', day_of_week: 2, weekday_label: 'Tue', day_label: 'Tue, Sep 15' },
];
const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { start: '07:00', end: '17:00', closed: false }]));
const WAVERLY = { id: 10, name: 'Waverly', color: '#2563EB', hours };
const EMPLOYEES = [{ id: 1, full_name: 'Gary Jezorski' }, { id: 2, full_name: 'Bo Vance' }];

const seg = (id: number, lunch: number | null = null) => ({ segment_id: id, store_id: 10, start: '07:00', end: '17:00', overnight: false, editable: true, unpaid_lunch_minutes: lunch, unpaid_lunch_start: null });
// Bo's Monday is projected from his recurring rule: no dated entry exists.
const RECURRING_CELL = { segment_id: null, store_id: 10, start: '08:00', end: '16:00', overnight: false, editable: false, unpaid_lunch_minutes: null, unpaid_lunch_start: null };

const STORE_VIEW = {
  success: true,
  range: RANGE,
  dates: DATES,
  stores: [WAVERLY],
  employees: EMPLOYEES,
  store_view: [
    {
      store_id: 10,
      rows: [
        { employee: { id: 1, full_name: 'Gary Jezorski' }, cells: { '2026-09-14': [seg(100, 30)] } },
        { employee: { id: 2, full_name: 'Bo Vance' }, cells: { '2026-09-14': [RECURRING_CELL] } },
      ],
    },
  ],
};

const BO_RULES = {
  success: true,
  employee: { id: 2, full_name: 'Bo Vance', store_id: 10 },
  timezone: 'America/Chicago',
  rules: [
    { day_of_week: 1, is_working_day: true, start_time: '08:00', end_time: '16:00', crosses_midnight: false, unpaid_lunch_minutes: null, unpaid_lunch_start: null, store_id: 10 },
    { day_of_week: 2, is_working_day: true, start_time: '08:00', end_time: '16:00', crosses_midnight: false, unpaid_lunch_minutes: 30, unpaid_lunch_start: null, store_id: 10 },
  ],
};

const EMPLOYEE_VIEW = {
  success: true,
  range: RANGE,
  employee: { id: 1, full_name: 'Gary Jezorski' },
  dates: DATES,
  stores: [WAVERLY],
  employee_view: [{ store_id: 10, cells: { '2026-09-14': [seg(100)] } }],
  day_offs: [],
};

const H = 3600;
const fig = (over: Record<string, unknown> = {}) => ({
  scheduled_seconds: 48 * H,
  unpaid_lunch_seconds: 0,
  paid_seconds: 48 * H,
  regular_seconds: 40 * H,
  overtime_seconds: 8 * H,
  unresolved_seconds: 0,
  regular_cents: 80000,
  overtime_cents: 24000,
  total_cents: 104000,
  regular_display: '$800.00',
  overtime_display: '$240.00',
  total_display: '$1,040.00',
  status: 'calculated',
  status_label: 'Calculated',
  notes: [] as string[],
  ...over,
});

const PROJECTION = {
  success: true,
  range: { from: '2026-09-14', to: '2026-09-20', label: 'Sep 14 – Sep 20, 2026', timezone: 'America/Chicago' },
  workweeks: [{ start: '2026-09-13', end: '2026-09-19' }, { start: '2026-09-20', end: '2026-09-26' }],
  overtime_multiplier: '1.50',
  summary: fig({ status: 'incomplete', status_label: 'Incomplete' }),
  coverage: { employees: 2, calculated: 1, not_set: 1, not_classified: 0, salary: 0, lunch_timing_needed: 0, incomplete: 0 },
  notices: [{ code: 'lunch_not_configured', message: '6 scheduled entries specify no unpaid lunch, so nothing was deducted for them. Set an unpaid lunch on a schedule entry to deduct it.' }],
  unresolved_shifts: [] as { employee: string; date: string; store_id: number | null; store_name: string; start: string; end: string; lunch_minutes: number; message: string }[],
  stores: [{ store_id: 10, store_name: 'Waverly', employees: 2, ...fig({ status: 'incomplete', status_label: 'Incomplete' }) }],
  employees: [
    { employee_id: 1, employee: 'Gary Jezorski', store_id: 10, store_name: 'Waverly', ...fig() },
    {
      employee_id: 2,
      employee: 'Bo Vance',
      store_id: 10,
      store_name: 'Waverly',
      ...fig({ regular_cents: 0, overtime_cents: 0, total_cents: 0, regular_display: '—', overtime_display: '—', total_display: '—', status: 'not_set', status_label: 'Not Set', notes: ['No compensation record applies to 2026-09-14.'] }),
    },
  ],
};

// A projection where one shift's lunch placement is material and unstated.
const UNRESOLVED_SHIFT = {
  employee: 'Gary Jezorski', date: '2026-09-19', store_id: 10, store_name: 'Waverly', start: '22:00', end: '06:00', lunch_minutes: 60,
  message: 'Gary Jezorski — Sat Sep 19, 10:00 PM – 6:00 AM (60 min lunch): set when the lunch starts to price this shift; its workweek wages are withheld until then.',
};
const PROJECTION_UNRESOLVED = {
  ...PROJECTION,
  summary: fig({ status: 'lunch_timing_needed', status_label: 'Lunch Timing Needed', regular_seconds: 0, overtime_seconds: 0, unresolved_seconds: 48 * H, regular_cents: 0, overtime_cents: 0, total_cents: 0, regular_display: '—', overtime_display: '—', total_display: '—' }),
  coverage: { employees: 1, calculated: 0, not_set: 0, not_classified: 0, salary: 0, lunch_timing_needed: 1, incomplete: 0 },
  notices: [{ code: 'lunch_timing', message: UNRESOLVED_SHIFT.message }],
  unresolved_shifts: [UNRESOLVED_SHIFT],
  stores: [],
  employees: [],
};

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
  const mutate = (method: string, path: string, body?: unknown) => {
    server.calls.push({ method, path, body });
    return { success: true, segment: { id: 100 } };
  };
  const api = {
    getToken: () => server.token,
    setToken: (t: string | null) => { server.token = t; },
    get: async (path: string) => {
      server.calls.push({ method: 'GET', path });
      if (path.startsWith('/admin/schedule/payroll-projection') && server.failNextGet) {
        const msg = server.failNextGet;
        server.failNextGet = null;
        throw new ApiError(msg, 500);
      }
      if (path === '/auth/login-users') return { success: true, data: EMPLOYEES };
      if (path.startsWith('/admin/schedule/groups')) return { success: true, groups: [] };
      if (path.startsWith('/admin/schedule/store-view')) return STORE_VIEW;
      if (path.startsWith('/admin/schedule/employee-view/1')) return EMPLOYEE_VIEW;
      if (path.startsWith('/admin/schedule/payroll-projection')) return server.unresolved ? PROJECTION_UNRESOLVED : PROJECTION;
      if (path === '/admin/employees/2/schedule') return BO_RULES;
      return { success: true };
    },
    post: async (path: string, body: unknown) => mutate('POST', path, body),
    put: async (path: string, body: unknown) => mutate('PUT', path, body),
    del: async (path: string) => mutate('DELETE', path),
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 9, full_name: 'Admin' },
    employee: null,
    roles: auth.isAdmin ? ['master_admin'] : [],
    isAdmin: auth.isAdmin,
    permissions: auth.permissions,
    can: (p: string) => auth.isAdmin || auth.permissions.includes(p),
    loading: false,
    initialClockState: null,
    timezone: 'America/Chicago',
    signIn: async () => {},
    signOut: async () => {},
  }),
}));

import WorkScheduleV2 from '../components/admin/WorkScheduleV2';
import { formatUnpaidLunch, parseLunchMinutes } from '../lib/schedule';
import { fetchPayrollProjection, formatProjectedHours } from '../lib/payrollProjection';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
  server.failNextGet = null;
  server.unresolved = false;
  auth.permissions = [];
  auth.isAdmin = false;
});

const projectionCalls = () => server.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/admin/schedule/payroll-projection'));

describe('Calculate Payroll button', () => {
  it('is hidden without the payroll cost permission', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    expect(screen.queryByText('Calculate Payroll')).not.toBeInTheDocument();
    expect(projectionCalls()).toHaveLength(0);
  });

  it('is shown to a holder of the real grant and prices the visible range', async () => {
    auth.permissions = ['payroll_cost.view'];
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Calculate Payroll'));

    expect(await screen.findByText('Projected Gross Wages — Based on Scheduled Hours')).toBeInTheDocument();
    await vi.waitFor(() => expect(projectionCalls()).toHaveLength(1));
    expect(projectionCalls()[0].path).toBe('/admin/schedule/payroll-projection?from=2026-09-14&to=2026-09-20');

    const summary = await screen.findByTestId('projection-summary');
    expect(within(summary).getByText('$1,040.00')).toBeInTheDocument();
    expect(within(summary).getByText('$800.00')).toBeInTheDocument();
    expect(within(summary).getByText('$240.00')).toBeInTheDocument();
    expect(within(summary).getByText('48:00')).toBeInTheDocument();
    expect(within(summary).getByText('8:00')).toBeInTheDocument();
    expect(within(summary).getByText('None configured')).toBeInTheDocument();
    // The total is flagged, never presented as the complete payroll.
    expect(screen.getByTestId('projection-incomplete')).toHaveTextContent('Incomplete');
    expect(screen.getByTestId('projection-problems')).toHaveTextContent('1 employee has no pay rate');
    expect(screen.getByTestId('projection-problems')).toHaveTextContent('specify no unpaid lunch');
    // Overtime context is explained with the workweeks actually used.
    expect(screen.getByText(/2026-09-13 – 2026-09-26/)).toBeInTheDocument();
    expect(screen.getByText(/×1\.50/)).toBeInTheDocument();
  });

  it('is also shown to a Master Admin', async () => {
    auth.isAdmin = true;
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    expect(screen.getByText('Calculate Payroll')).toBeInTheDocument();
  });

  it('scopes an Employee View projection to the selected employee', async () => {
    auth.permissions = ['payroll_cost.view'];
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Employee View'));
    const button = screen.getByText('Calculate Payroll').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByDisplayValue('Select an employee…'), { target: { value: '1' } });
    await vi.waitFor(() => expect(server.calls.some((c) => c.path.startsWith('/admin/schedule/employee-view/1'))).toBe(true));
    await vi.waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);
    await vi.waitFor(() => expect(projectionCalls()).toHaveLength(1));
    expect(projectionCalls()[0].path).toBe('/admin/schedule/payroll-projection?from=2026-09-14&to=2026-09-20&user_id=1');
    expect(await screen.findByText('Sep 14 – Sep 20, 2026 · Gary Jezorski')).toBeInTheDocument();
  });
});

describe('Projection modal', () => {
  it('renders the store and employee breakdowns with unpriced rows as a dash', async () => {
    auth.permissions = ['payroll_cost.view'];
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Calculate Payroll'));

    const stores = await screen.findByTestId('projection-stores');
    expect(within(stores).getByText('Waverly')).toBeInTheDocument();
    expect(within(stores).getByText('2')).toBeInTheDocument();

    const employees = screen.getByTestId('projection-employees');
    const bo = within(employees).getByText('Bo Vance').closest('tr') as HTMLTableRowElement;
    expect(within(bo).getByText('No pay rate')).toBeInTheDocument();
    expect(within(bo).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(within(bo).queryByText('$0.00')).not.toBeInTheDocument();
    const gary = within(employees).getByText('Gary Jezorski').closest('tr') as HTMLTableRowElement;
    expect(within(gary).getByText('$1,040.00')).toBeInTheDocument();
  });

  it('shows an error with Retry, and Recalculate re-reads the saved schedule', async () => {
    auth.permissions = ['payroll_cost.view'];
    server.failNextGet = 'The payroll projection could not be calculated.';
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Calculate Payroll'));

    expect(await screen.findByText('The payroll projection could not be calculated.')).toBeInTheDocument();
    expect(screen.queryByTestId('projection-summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry'));
    expect(await screen.findByTestId('projection-summary')).toBeInTheDocument();
    expect(projectionCalls()).toHaveLength(2);

    fireEvent.click(screen.getByText('Recalculate'));
    await vi.waitFor(() => expect(projectionCalls()).toHaveLength(3));

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Projected Gross Wages — Based on Scheduled Hours')).not.toBeInTheDocument();
  });
});

describe('Unpaid lunch on the schedule', () => {
  it('shows a configured lunch on the chip and seeds the editor with it', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('30 min lunch')).toBeInTheDocument();

    fireEvent.click(screen.getByText('7:00 AM – 5:00 PM'));
    const input = (await screen.findByLabelText('Unpaid Lunch (minutes)')) as HTMLInputElement;
    expect(input.value).toBe('30');
  });

  it('sends the lunch with an update and null with a blank create', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();

    fireEvent.click(screen.getByText('7:00 AM – 5:00 PM'));
    fireEvent.change(await screen.findByLabelText('Unpaid Lunch (minutes)'), { target: { value: '45' } });
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT' && c.path === '/admin/schedule/segments/100')).toBe(true));
    const put = server.calls.find((c) => c.method === 'PUT') as { body: Record<string, unknown> };
    expect(put.body.unpaid_lunch_minutes).toBe(45);
    expect(put.body.start_time).toBe('07:00');
    // The editor closes once the save settles; only then open another cell.
    await vi.waitFor(() => expect(screen.queryByText('Edit schedule')).not.toBeInTheDocument());

    fireEvent.click(await screen.findByLabelText('Add Gary Jezorski Waverly 2026-09-15'));
    expect(((await screen.findByLabelText('Unpaid Lunch (minutes)')) as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'POST' && c.path === '/admin/schedule/segments')).toBe(true));
    const post = server.calls.find((c) => c.method === 'POST') as { body: Record<string, unknown> };
    expect(post.body).not.toHaveProperty('unpaid_lunch_minutes'); // blank = none; the payload is unchanged
    expect(post.body.date).toBe('2026-09-15');
  });

  it('rejects a non-numeric or oversized lunch before anything is sent', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    fireEvent.click(screen.getByText('7:00 AM – 5:00 PM'));
    fireEvent.change(await screen.findByLabelText('Unpaid Lunch (minutes)'), { target: { value: '600' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Unpaid lunch cannot exceed 480 minutes.')).toBeInTheDocument();
    expect(server.calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

describe('Lunch placement and the recurring rule', () => {
  it('lists the shifts whose lunch start is needed and withholds their wages visibly', async () => {
    auth.permissions = ['payroll_cost.view'];
    server.unresolved = true;
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Calculate Payroll'));

    const summary = await screen.findByTestId('projection-summary');
    expect(within(summary).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('projection-incomplete')).toHaveTextContent('Lunch Timing Needed');
    expect(screen.getByTestId('projection-unresolved')).toHaveTextContent('48:00 scheduled hours await a lunch start time');
    expect(screen.getByTestId('projection-problems')).toHaveTextContent('withheld, not guessed');
    const shifts = screen.getByTestId('projection-unresolved-shifts');
    expect(shifts).toHaveTextContent('Gary Jezorski');
    expect(shifts).toHaveTextContent('Sat Sep 19, 10:00 PM – 6:00 AM (60 min lunch)');
    // The shift notice is shown once, with the shifts, not again in the general list.
    expect(screen.getByTestId('projection-problems')).not.toHaveTextContent('Sat Sep 19');
  });

  it('sends a stated lunch start with the dated entry, and an explicit zero as 0', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();

    fireEvent.click(screen.getByText('7:00 AM – 5:00 PM'));
    await screen.findByLabelText('Unpaid Lunch (minutes)');
    fireEvent.click(screen.getByText('Set when the lunch starts (optional)'));
    expect(await screen.findByText('Lunch starts at')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT' && c.path === '/admin/schedule/segments/100')).toBe(true));
    const put = server.calls.find((c) => c.method === 'PUT') as { body: Record<string, unknown> };
    expect(put.body.unpaid_lunch_minutes).toBe(30);
    expect(put.body.unpaid_lunch_start).toBe('07:00'); // seeded from the entry's start until changed
    await vi.waitFor(() => expect(screen.queryByText('Edit schedule')).not.toBeInTheDocument());

    server.calls = [];
    fireEvent.click(screen.getByText('7:00 AM – 5:00 PM'));
    fireEvent.change(await screen.findByLabelText('Unpaid Lunch (minutes)'), { target: { value: '0' } });
    expect(screen.queryByText('Set when the lunch starts (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT')).toBe(true));
    const zero = server.calls.find((c) => c.method === 'PUT') as { body: Record<string, unknown> };
    expect(zero.body.unpaid_lunch_minutes).toBe(0);
    expect(zero.body.unpaid_lunch_start).toBeNull();
  });

  it('updates the recurring rule’s lunch from a projected cell, touching nothing else on the rule', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-lunch')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('8:00 AM – 4:00 PM')); // Bo's recurring Monday
    const section = await screen.findByTestId('recurring-lunch');
    expect(section).toHaveTextContent('Recurring Monday rule');
    expect(section).toHaveTextContent('update the rule to change the unpaid lunch for every Monday');
    // The main editor still edits this date only (a dated entry would be created).
    expect(screen.getByText('Add schedule')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Unpaid lunch on the recurring Monday rule (minutes)'), { target: { value: '45' } });
    fireEvent.click(screen.getByText('Update rule'));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT' && c.path === '/admin/employees/2/schedule')).toBe(true));
    expect(server.calls.some((c) => c.method === 'GET' && c.path === '/admin/employees/2/schedule')).toBe(true);
    const put = server.calls.find((c) => c.method === 'PUT') as { body: { rules: Record<string, unknown>[] } };
    expect(put.body.rules).toHaveLength(1);
    expect(put.body.rules[0]).toEqual({
      day_of_week: 1, is_working_day: true, start_time: '08:00', end_time: '16:00', crosses_midnight: false, unpaid_lunch_minutes: 45, unpaid_lunch_start: null, store_id: 10,
    });
    expect(server.calls.some((c) => c.path === '/admin/schedule/segments')).toBe(false); // no dated entry was created
    await vi.waitFor(() => expect(screen.queryByTestId('recurring-lunch')).not.toBeInTheDocument());
  });

  it('accepts an explicit zero on the recurring rule', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    fireEvent.click(screen.getByText('8:00 AM – 4:00 PM'));
    await screen.findByTestId('recurring-lunch');
    fireEvent.change(screen.getByLabelText('Unpaid lunch on the recurring Monday rule (minutes)'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Update rule'));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = server.calls.find((c) => c.method === 'PUT') as { body: { rules: Record<string, unknown>[] } };
    expect(put.body.rules[0].unpaid_lunch_minutes).toBe(0);
  });

  it('reports a missing recurring rule instead of inventing one', async () => {
    BO_RULES.rules = BO_RULES.rules.filter((r) => r.day_of_week !== 1);
    try {
      render(<WorkScheduleV2 />);
      expect(await screen.findByText('Waverly')).toBeInTheDocument();
      fireEvent.click(screen.getByText('8:00 AM – 4:00 PM'));
      await screen.findByTestId('recurring-lunch');
      fireEvent.change(screen.getByLabelText('Unpaid lunch on the recurring Monday rule (minutes)'), { target: { value: '30' } });
      fireEvent.click(screen.getByText('Update rule'));
      expect(await screen.findByText('Bo Vance has no recurring Monday rule to update.')).toBeInTheDocument();
      expect(server.calls.some((c) => c.method === 'PUT')).toBe(false);
    } finally {
      BO_RULES.rules.unshift({ day_of_week: 1, is_working_day: true, start_time: '08:00', end_time: '16:00', crosses_midnight: false, unpaid_lunch_minutes: null, unpaid_lunch_start: null, store_id: 10 });
    }
  });
});

describe('helpers', () => {
  it('parses the lunch field', () => {
    expect(parseLunchMinutes('')).toEqual({ value: null });
    expect(parseLunchMinutes(' 30 ')).toEqual({ value: 30 });
    expect(parseLunchMinutes('0')).toEqual({ value: 0 });
    expect(parseLunchMinutes('abc')).toEqual({ error: 'Unpaid lunch must be a whole number of minutes.' });
    expect(parseLunchMinutes('481')).toEqual({ error: 'Unpaid lunch cannot exceed 480 minutes.' });
  });

  it('formats lunch and projected hours', () => {
    expect(formatUnpaidLunch(null)).toBeNull();
    expect(formatUnpaidLunch(0)).toBeNull();
    expect(formatUnpaidLunch(30)).toBe('30 min lunch');
    expect(formatUnpaidLunch(60)).toBe('1 hr lunch');
    expect(formatUnpaidLunch(75)).toBe('1 hr 15 min lunch');
    expect(formatProjectedHours(0)).toBe('0:00');
    expect(formatProjectedHours(5400)).toBe('1:30');
    expect(formatProjectedHours(40 * 3600 + 59)).toBe('40:00');
  });

  it('builds the projection query with optional filters', async () => {
    await fetchPayrollProjection({ from: '2026-09-14', to: '2026-09-20', store_id: 10, user_id: null });
    expect(projectionCalls()[0].path).toBe('/admin/schedule/payroll-projection?from=2026-09-14&to=2026-09-20&store_id=10');
  });
});
