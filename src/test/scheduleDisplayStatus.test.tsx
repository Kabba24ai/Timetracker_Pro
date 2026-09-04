import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Work Schedule DISPLAY statuses + global Holidays.
//
// Schedule/display only: nothing here pays anyone. The REAL grid and the REAL
// modals are rendered; only the api transport is mocked, so the assertions are
// on HTTP method + path + body, exactly like schedule.test.tsx.

const server = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body?: unknown }[],
  token: 'tok' as string | null,
  failNext: null as string | null,
  storeView: null as unknown,
  employeeView: null as unknown,
  holidays: [] as unknown[],
}));

const RANGE = { from: '2026-09-14', to: '2026-09-20', view: 'this_week', label: 'Sep 14 – Sep 20, 2026', timezone: 'America/Chicago' };
const DATES = [
  { date: '2026-09-14', day_of_week: 1, weekday_label: 'Mon', day_label: 'Mon, Sep 14' },
  { date: '2026-09-15', day_of_week: 2, weekday_label: 'Tue', day_label: 'Tue, Sep 15' },
];
const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { start: '07:00', end: '17:00', closed: false }]));
const WAVERLY = { id: 10, name: 'Waverly', color: '#2563EB', hours };
const BON_AQUA = { id: 11, name: 'Bon Aqua', color: '#059669', hours };
const EMPLOYEES = [{ id: 1, full_name: 'Gary Jezorski' }, { id: 2, full_name: 'Bo Vance' }];

const seg = (id: number, storeId: number, s: string, e: string) => ({ segment_id: id, store_id: storeId, start: s, end: e, overnight: false, editable: true });

type Row = Record<string, unknown>;

function storeView(rows: Row[], holidays: Record<string, { id: number; name: string }[]> = {}) {
  return {
    success: true,
    range: RANGE,
    dates: DATES,
    stores: [WAVERLY, BON_AQUA],
    employees: EMPLOYEES,
    store_view: [
      { store_id: 10, rows, holidays },
      { store_id: 11, rows: [], holidays: {} },
    ],
  };
}

const GROUPS = { success: true, groups: [] };

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
    if (server.failNext) {
      const msg = server.failNext;
      server.failNext = null;
      throw new ApiError(msg, 422);
    }
    if (path === '/admin/schedule/holidays' && method === 'POST') {
      const b = body as { name: string; start_date: string; end_date: string; store_ids: number[] };
      return { success: true, holiday: { id: 77, ...b } };
    }
    return { success: true };
  };
  const api = {
    getToken: () => server.token,
    setToken: (t: string | null) => { server.token = t; },
    get: async (path: string) => {
      server.calls.push({ method: 'GET', path });
      if (path === '/auth/login-users') return { success: true, data: EMPLOYEES };
      if (path.startsWith('/admin/schedule/groups')) return GROUPS;
      if (path.startsWith('/admin/schedule/holidays')) return { success: true, holidays: server.holidays };
      if (path.startsWith('/admin/schedule/store-view')) return server.storeView;
      if (path.startsWith('/admin/schedule/employee-view/1')) return server.employeeView;
      if (path.startsWith('/schedule?mode=all')) return server.storeView;
      if (path.startsWith('/schedule')) return server.employeeView;
      return { success: true };
    },
    post: async (path: string, body: unknown) => mutate('POST', path, body),
    put: async (path: string, body: unknown) => mutate('PUT', path, body),
    del: async (path: string, body?: unknown) => mutate('DELETE', path, body),
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import WorkScheduleV2 from '../components/admin/WorkScheduleV2';
import EmployeeWorkSchedule from '../components/schedule/EmployeeWorkSchedule';
import ScheduleCellModal, { CellDraft } from '../components/admin/ScheduleCellModal';
import ScheduleHolidayModal from '../components/admin/ScheduleHolidayModal';
import { DAY_STATUS_OPTIONS } from '../lib/schedule';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
  server.failNext = null;
  server.holidays = [];
  server.storeView = storeView([]);
  server.employeeView = { success: true, range: RANGE, employee: { id: 1, full_name: 'Gary Jezorski' }, dates: DATES, stores: [WAVERLY], employee_view: [], day_offs: [] };
});

const draft = (over: Partial<CellDraft> = {}): CellDraft => ({
  userId: 1,
  employeeName: 'Gary Jezorski',
  storeId: 10,
  storeName: 'Waverly',
  storeColor: '#2563EB',
  date: '2026-09-14',
  segmentId: null,
  start24: '07:00',
  end24: '17:00',
  ...over,
});

const modal = (over: Partial<CellDraft> = {}, props: Record<string, unknown> = {}) =>
  render(
    <ScheduleCellModal
      draft={draft(over)}
      stores={[WAVERLY, BON_AQUA]}
      onClose={() => {}}
      onSaved={() => {}}
      {...props}
    />,
  );

const grid = async () => {
  render(<WorkScheduleV2 />);
  await screen.findByText('Waverly');
};

// ── The status vocabulary ───────────────────────────────────────────────────

describe('Day status options', () => {
  it('offers Working plus the seven display statuses, in the approved order', () => {
    expect(DAY_STATUS_OPTIONS.map((o) => o.label)).toEqual([
      'Working',
      'Vacation',
      'Sick',
      'Paid Time Off',
      'Jury Duty',
      'Bereavement',
      'Unpaid Time Off',
      'Holiday',
    ]);
    expect(DAY_STATUS_OPTIONS[0].value).toBe('working');
  });
});

// ── ScheduleCellModal ───────────────────────────────────────────────────────

describe('ScheduleCellModal — day status selector', () => {
  it('defaults to Working and shows Store, Start Time and End Time', () => {
    modal();
    expect((screen.getByLabelText('Day Status') as HTMLSelectElement).value).toBe('working');
    expect(screen.getByLabelText('Store')).toBeInTheDocument();
    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();
  });

  it.each([
    ['vacation', 'Vacation'],
    ['sick', 'Sick'],
    ['paid_time_off', 'Paid Time Off'],
    ['jury_duty', 'Jury Duty'],
    ['bereavement', 'Bereavement'],
    ['unpaid_time_off', 'Unpaid Time Off'],
  ])('hides the time controls for the full-day status %s', async (value, label) => {
    const user = userEvent.setup();
    modal();
    await user.selectOptions(screen.getByLabelText('Day Status'), value);

    expect(screen.queryByText('Start Time')).not.toBeInTheDocument();
    expect(screen.queryByText('End Time')).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${label} applies to the whole day`, 'i'))).toBeInTheDocument();
  });

  it('keeps the time controls for Holiday, because employees may work a holiday', async () => {
    const user = userEvent.setup();
    modal();
    await user.selectOptions(screen.getByLabelText('Day Status'), 'holiday');

    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();
    expect(screen.queryByText(/applies to the whole day/i)).not.toBeInTheDocument();
  });

  it('warns before replacing existing work hours with a full-day status', async () => {
    const user = userEvent.setup();
    modal({ segmentId: 100 });
    await user.selectOptions(screen.getByLabelText('Day Status'), 'vacation');

    expect(screen.getByText("Saving Vacation will remove this employee's scheduled work hours for this date.")).toBeInTheDocument();
  });

  it('uses the selected label in the warning', async () => {
    const user = userEvent.setup();
    modal({ segmentId: 100 });
    await user.selectOptions(screen.getByLabelText('Day Status'), 'jury_duty');

    expect(screen.getByText("Saving Jury Duty will remove this employee's scheduled work hours for this date.")).toBeInTheDocument();
  });

  it('does not warn for Holiday, which preserves the work', async () => {
    const user = userEvent.setup();
    modal({ segmentId: 100 });
    await user.selectOptions(screen.getByLabelText('Day Status'), 'holiday');

    expect(screen.queryByText(/will remove this employee's scheduled work hours/)).not.toBeInTheDocument();
  });

  it('saves a full-day status through the day-status endpoint, never the segment endpoint', async () => {
    const user = userEvent.setup();
    modal();
    await user.selectOptions(screen.getByLabelText('Day Status'), 'sick');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(server.calls).toEqual([
      { method: 'POST', path: '/admin/schedule/day-status', body: { user_id: 1, date: '2026-09-14', status: 'sick' } },
    ]);
  });

  it('saving Working still creates a normal segment', async () => {
    const user = userEvent.setup();
    modal();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(server.calls[0]).toEqual({
      method: 'POST',
      path: '/admin/schedule/segments',
      body: { user_id: 1, store_id: 10, date: '2026-09-14', start_time: '07:00', end_time: '17:00' },
    });
  });

  it('opens with an existing status preselected and offers Remove Status', async () => {
    modal({}, { dayStatus: { status: 'vacation', label: 'Vacation', is_full_day: true } });

    expect((screen.getByLabelText('Day Status') as HTMLSelectElement).value).toBe('vacation');
    expect(screen.getByRole('button', { name: /Remove status/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove schedule/i })).not.toBeInTheDocument();
  });

  it('Remove Status clears it without creating work hours', async () => {
    const user = userEvent.setup();
    modal({}, { dayStatus: { status: 'vacation', label: 'Vacation', is_full_day: true } });
    await user.click(screen.getByRole('button', { name: /Remove status/i }));

    expect(server.calls).toEqual([
      { method: 'DELETE', path: '/admin/schedule/day-status', body: { user_id: 1, date: '2026-09-14' } },
    ]);
  });

  it('switching an existing status back to Working restores the time controls and clears the status first', async () => {
    const user = userEvent.setup();
    modal({}, { dayStatus: { status: 'vacation', label: 'Vacation', is_full_day: true } });
    await user.selectOptions(screen.getByLabelText('Day Status'), 'working');

    expect(screen.getByText('Start Time')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(server.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'DELETE /admin/schedule/day-status',
      'POST /admin/schedule/segments',
    ]);
  });

  it('surfaces a server rejection inline and keeps the modal open', async () => {
    const user = userEvent.setup();
    server.failNext = 'That status could not be saved.';
    modal();
    await user.selectOptions(screen.getByLabelText('Day Status'), 'vacation');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('That status could not be saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Day Status')).toBeInTheDocument();
  });
});

// ── WorkScheduleV2 badges ───────────────────────────────────────────────────

describe('WorkScheduleV2 — status and holiday badges', () => {
  const rowWith = (over: Row = {}) => [{ employee: { id: 1, full_name: 'Gary Jezorski' }, cells: {}, ...over }];

  it.each([
    ['vacation', 'Vacation'],
    ['sick', 'Sick'],
    ['paid_time_off', 'Paid Time Off'],
    ['jury_duty', 'Jury Duty'],
    ['bereavement', 'Bereavement'],
    ['unpaid_time_off', 'Unpaid Time Off'],
    ['holiday', 'Holiday'],
  ])('renders the %s badge', async (status, label) => {
    server.storeView = storeView(rowWith({ day_status: { '2026-09-14': { status, label, is_full_day: status !== 'holiday' } } }));
    await grid();

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('shows a global Holiday on every employee row in scope, and keeps the + affordance when there are no hours', async () => {
    server.storeView = storeView(rowWith(), { '2026-09-14': [{ id: 77, name: 'Labor Day' }] });
    await grid();

    expect(await screen.findByText('Labor Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Gary Jezorski Waverly 2026-09-14')).toBeInTheDocument();
  });

  it('shows a global Holiday alongside the employee work chip', async () => {
    server.storeView = storeView(
      rowWith({ cells: { '2026-09-14': [seg(100, 10, '07:00', '12:00')] } }),
      { '2026-09-14': [{ id: 77, name: 'Labor Day' }] },
    );
    await grid();

    expect(await screen.findByText('Labor Day')).toBeInTheDocument();
    expect(screen.getByText('7:00 AM – 12:00 PM')).toBeInTheDocument();
  });

  it('shows a global Holiday alongside an individual absence', async () => {
    server.storeView = storeView(
      rowWith({ day_status: { '2026-09-14': { status: 'vacation', label: 'Vacation', is_full_day: true } } }),
      { '2026-09-14': [{ id: 77, name: 'Labor Day' }] },
    );
    await grid();

    expect(await screen.findByText('Labor Day')).toBeInTheDocument();
    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });

  it('still renders the pre-existing approved-time-off overlay when there is no manual status', async () => {
    server.storeView = storeView(rowWith({ time_off: { '2026-09-14': { status: 'vacation', label: 'Vacation', is_full_day: true } } }));
    await grid();

    expect(await screen.findByText('Vacation')).toBeInTheDocument();
  });

  it('shows only ONE employee-status badge when a manual status and an approved request agree on a date', async () => {
    // The server suppresses `time_off` on a date that has a manual status; the
    // grid must not re-introduce a second badge from stale data either.
    server.storeView = storeView(rowWith({
      day_status: { '2026-09-14': { status: 'jury_duty', label: 'Jury Duty', is_full_day: true } },
      time_off: { '2026-09-14': { status: 'vacation', label: 'Vacation', is_full_day: true } },
    }));
    await grid();

    expect(await screen.findByText('Jury Duty')).toBeInTheDocument();
    expect(screen.queryByText('Vacation')).not.toBeInTheDocument();
  });

  it('clicking a status badge opens the cell modal with that status preselected', async () => {
    const user = userEvent.setup();
    server.storeView = storeView(rowWith({ day_status: { '2026-09-14': { status: 'sick', label: 'Sick', is_full_day: true } } }));
    await grid();

    await user.click(await screen.findByRole('button', { name: /Sick/ }));

    expect((await screen.findByLabelText('Day Status') as HTMLSelectElement).value).toBe('sick');
  });
});

// ── Holiday modal ───────────────────────────────────────────────────────────

describe('ScheduleHolidayModal', () => {
  const holidayModal = (props: Record<string, unknown> = {}) =>
    render(
      <ScheduleHolidayModal
        stores={[WAVERLY, BON_AQUA]}
        date="2026-09-14"
        onClose={() => {}}
        onSaved={() => {}}
        {...props}
      />,
    );

  it('opens from the + Holiday toolbar control in Store View', async () => {
    const user = userEvent.setup();
    await grid();

    await user.click(screen.getByRole('button', { name: /\+ Holiday/ }));

    expect(await screen.findByRole('dialog', { name: /Add Holiday/i })).toBeInTheDocument();
  });

  it('selects every active store by default', () => {
    holidayModal();

    expect(screen.getByRole('checkbox', { name: 'Waverly' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bon Aqua' })).toBeChecked();
  });

  it('saves a one-day holiday with start = end', async () => {
    const user = userEvent.setup();
    holidayModal();
    await user.type(screen.getByLabelText('Holiday Name'), 'Labor Day');
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    expect(server.calls[0]).toEqual({
      method: 'POST',
      path: '/admin/schedule/holidays',
      body: { name: 'Labor Day', start_date: '2026-09-14', end_date: '2026-09-14', store_ids: [10, 11] },
    });
  });

  it('saves a multi-day range', async () => {
    const user = userEvent.setup();
    holidayModal();
    await user.type(screen.getByLabelText('Holiday Name'), 'Thanksgiving');
    await user.clear(screen.getByLabelText('End Date'));
    await user.type(screen.getByLabelText('End Date'), '2026-09-16');
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    expect((server.calls[0].body as { end_date: string }).end_date).toBe('2026-09-16');
  });

  it('requires a name', async () => {
    const user = userEvent.setup();
    holidayModal();
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    expect(screen.getByText('Enter a holiday name.')).toBeInTheDocument();
    expect(server.calls).toHaveLength(0);
  });

  it('requires at least one store', async () => {
    const user = userEvent.setup();
    holidayModal();
    await user.type(screen.getByLabelText('Holiday Name'), 'Labor Day');
    await user.click(screen.getByRole('checkbox', { name: 'Waverly' }));
    await user.click(screen.getByRole('checkbox', { name: 'Bon Aqua' }));
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    expect(screen.getByText('Select at least one store.')).toBeInTheDocument();
    expect(server.calls).toHaveLength(0);
  });

  it('rejects an end date before the start date', async () => {
    const user = userEvent.setup();
    holidayModal();
    await user.type(screen.getByLabelText('Holiday Name'), 'Backwards');
    await user.clear(screen.getByLabelText('End Date'));
    await user.type(screen.getByLabelText('End Date'), '2026-09-13');
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    expect(screen.getByText('The end date cannot be before the start date.')).toBeInTheDocument();
    expect(server.calls).toHaveLength(0);
  });

  it('edits an existing holiday in place and offers delete behind a confirmation', async () => {
    const user = userEvent.setup();
    holidayModal({ existing: { id: 77, name: 'Labor Day', start_date: '2026-09-14', end_date: '2026-09-14', store_ids: [10] } });

    expect(screen.getByRole('dialog', { name: /Edit Holiday/i })).toBeInTheDocument();
    expect((screen.getByLabelText('Holiday Name') as HTMLInputElement).value).toBe('Labor Day');
    expect(screen.getByRole('checkbox', { name: 'Waverly' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bon Aqua' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /Delete Holiday/i }));
    expect(server.calls).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    expect(server.calls[0]).toEqual({ method: 'DELETE', path: '/admin/schedule/holidays/77', body: undefined });
  });

  it('updates an existing holiday through PUT', async () => {
    const user = userEvent.setup();
    holidayModal({ existing: { id: 77, name: 'Labor Day', start_date: '2026-09-14', end_date: '2026-09-14', store_ids: [10] } });
    await user.clear(screen.getByLabelText('Holiday Name'));
    await user.type(screen.getByLabelText('Holiday Name'), 'Labour Day');
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    expect(server.calls[0]).toEqual({
      method: 'PUT',
      path: '/admin/schedule/holidays/77',
      body: { name: 'Labour Day', start_date: '2026-09-14', end_date: '2026-09-14', store_ids: [10] },
    });
  });

  it('refreshes the schedule after a holiday is saved', async () => {
    const user = userEvent.setup();
    await grid();
    const before = server.calls.filter((c) => c.path.startsWith('/admin/schedule/store-view')).length;

    await user.click(screen.getByRole('button', { name: /\+ Holiday/ }));
    await user.type(await screen.findByLabelText('Holiday Name'), 'Labor Day');
    await user.click(screen.getByRole('button', { name: 'Save Holiday' }));

    await vi.waitFor(() => {
      const after = server.calls.filter((c) => c.path.startsWith('/admin/schedule/store-view')).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('clicking a holiday badge opens the modal preloaded for editing', async () => {
    const user = userEvent.setup();
    server.holidays = [{ id: 77, name: 'Labor Day', start_date: '2026-09-14', end_date: '2026-09-14', store_ids: [10] }];
    server.storeView = storeView(
      [{ employee: { id: 1, full_name: 'Gary Jezorski' }, cells: {} }],
      { '2026-09-14': [{ id: 77, name: 'Labor Day' }] },
    );
    await grid();

    await user.click(await screen.findByRole('button', { name: /Labor Day/ }));

    const dialog = await screen.findByRole('dialog', { name: /Edit Holiday/i });
    expect((within(dialog).getByLabelText('Holiday Name') as HTMLInputElement).value).toBe('Labor Day');
  });
});

// ── Employee-facing read-only schedule ──────────────────────────────────────

describe('EmployeeWorkSchedule — the same context, read only', () => {
  it('shows the global Holiday above the employee\'s own shift', async () => {
    server.employeeView = {
      success: true,
      range: RANGE,
      employee: { id: 1, full_name: 'Gary Jezorski' },
      dates: DATES,
      stores: [WAVERLY],
      employee_view: [{ store_id: 10, cells: { '2026-09-14': [seg(100, 10, '07:00', '12:00')] }, holidays: { '2026-09-14': [{ id: 77, name: 'Labor Day' }] } }],
      day_offs: [],
    };
    render(<EmployeeWorkSchedule />);

    expect(await screen.findByText('Labor Day')).toBeInTheDocument();
    expect(screen.getByText('7:00 AM – 12:00 PM')).toBeInTheDocument();
  });

  it('shows the manager\'s schedule status instead of the shift on a full-day absence', async () => {
    server.employeeView = {
      success: true,
      range: RANGE,
      employee: { id: 1, full_name: 'Gary Jezorski' },
      dates: DATES,
      stores: [WAVERLY],
      employee_view: [{ store_id: 10, cells: {}, holidays: {} }],
      day_offs: [],
      day_status: { '2026-09-14': { status: 'bereavement', label: 'Bereavement', is_full_day: true } },
    };
    render(<EmployeeWorkSchedule />);

    expect(await screen.findByText('Bereavement')).toBeInTheDocument();
  });

  it('offers no edit controls for the holiday or the status', async () => {
    server.employeeView = {
      success: true,
      range: RANGE,
      employee: { id: 1, full_name: 'Gary Jezorski' },
      dates: DATES,
      stores: [WAVERLY],
      employee_view: [{ store_id: 10, cells: {}, holidays: { '2026-09-14': [{ id: 77, name: 'Labor Day' }] } }],
      day_offs: [],
      day_status: { '2026-09-14': { status: 'vacation', label: 'Vacation', is_full_day: true } },
    };
    render(<EmployeeWorkSchedule />);
    await screen.findByText('Labor Day');

    expect(screen.queryByRole('button', { name: /Labor Day/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vacation/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Holiday/ })).not.toBeInTheDocument();
  });
});

// ── Employee-facing privacy rendering ───────────────────────────────────────
//
// The SERVER already collapsed sensitive reasons before the payload left it;
// these prove the employee surface renders exactly what it is given and never
// reconstructs a detailed status.

describe('EmployeeWorkSchedule — privacy-safe statuses', () => {
  const mine = (dayStatus: Record<string, unknown>) => ({
    success: true,
    range: RANGE,
    employee: { id: 1, full_name: 'Gary Jezorski' },
    dates: DATES,
    stores: [WAVERLY],
    employee_view: [{ store_id: 10, cells: {}, holidays: {} }],
    day_offs: [],
    day_status: dayStatus,
  });

  it.each(['Sick', 'Paid Time Off', 'Jury Duty', 'Bereavement'])(
    'renders a generic Time Off where the admin status was %s',
    async (adminLabel) => {
      // What the server sends for any sensitive reason.
      server.employeeView = mine({ '2026-09-14': { status: 'time_off', label: 'Time Off', is_full_day: true } });
      render(<EmployeeWorkSchedule />);

      expect(await screen.findByText('Time Off')).toBeInTheDocument();
      expect(screen.queryByText(adminLabel)).not.toBeInTheDocument();
    },
  );

  it('still names Vacation', async () => {
    server.employeeView = mine({ '2026-09-14': { status: 'vacation', label: 'Vacation', is_full_day: true } });
    render(<EmployeeWorkSchedule />);

    expect(await screen.findByText('Vacation')).toBeInTheDocument();
  });

  it('still names Unpaid Time Off', async () => {
    server.employeeView = mine({ '2026-09-14': { status: 'unpaid_time_off', label: 'Unpaid Time Off', is_full_day: true } });
    render(<EmployeeWorkSchedule />);

    expect(await screen.findByText('Unpaid Time Off')).toBeInTheDocument();
  });

  it('still names Holiday', async () => {
    server.employeeView = mine({ '2026-09-14': { status: 'holiday', label: 'Holiday', is_full_day: false } });
    render(<EmployeeWorkSchedule />);

    expect(await screen.findByText('Holiday')).toBeInTheDocument();
  });
});
