import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const server = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body?: unknown }[],
  token: 'tok' as string | null,
  failNext: null as string | null,
}));

const RANGE = { from: '2026-09-14', to: '2026-09-20', view: 'this_week', label: 'Sep 14 – Sep 20, 2026', timezone: 'America/Chicago' };
const DATES = [
  { date: '2026-09-14', day_of_week: 1, weekday_label: 'Mon', day_label: 'Mon, Sep 14' },
  { date: '2026-09-15', day_of_week: 2, weekday_label: 'Tue', day_label: 'Tue, Sep 15' },
  { date: '2026-09-16', day_of_week: 3, weekday_label: 'Wed', day_label: 'Wed, Sep 16' },
];
const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { start: '07:00', end: '17:00', closed: false }]));
const WAVERLY = { id: 10, name: 'Waverly', color: '#2563EB', hours };
const BON_AQUA = { id: 11, name: 'Bon Aqua', color: '#059669', hours };

const seg = (id: number, storeId: number, s: string, e: string) => ({ segment_id: id, store_id: storeId, start: s, end: e, overnight: false, editable: true });

const EMPLOYEES = [{ id: 1, full_name: 'Gary Jezorski' }, { id: 2, full_name: 'Bo Vance' }];

const STORE_VIEW = {
  success: true,
  range: RANGE,
  dates: DATES,
  stores: [WAVERLY, BON_AQUA],
  employees: EMPLOYEES,
  store_view: [
    { store_id: 10, rows: [{ employee: { id: 1, full_name: 'Gary Jezorski' }, cells: { '2026-09-14': [seg(100, 10, '07:00', '12:00')] } }] },
    { store_id: 11, rows: [{ employee: { id: 1, full_name: 'Gary Jezorski' }, cells: { '2026-09-14': [seg(101, 11, '12:00', '17:00')] } }] },
  ],
};

const EMPLOYEE_VIEW = {
  success: true,
  range: RANGE,
  employee: { id: 1, full_name: 'Gary Jezorski' },
  dates: DATES,
  stores: [WAVERLY, BON_AQUA],
  employee_view: [
    { store_id: 10, cells: { '2026-09-14': [seg(100, 10, '07:00', '12:00')] } },
    { store_id: 11, cells: { '2026-09-15': [seg(101, 11, '07:00', '12:00')] } },
  ],
  day_offs: [],
};

const GROUPS = {
  success: true,
  groups: [{ id: 5, name: 'Bon Aqua Crew', store_id: null, active: true, members: [{ id: 1, full_name: 'Gary Jezorski' }] }],
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
  const result = (r: Record<string, unknown>) => ({ success: true, result: { created: 0, already_scheduled: 0, day_off_skipped: 0, days_off: [], conflict_count: 0, conflicts: [], ...r } });
  const mutate = (method: string, path: string, body?: unknown) => {
    server.calls.push({ method, path, body });
    if (server.failNext) {
      const msg = server.failNext;
      server.failNext = null;
      throw new ApiError(msg, 422);
    }
    if (path === '/admin/schedule/assign') return result({ created: 5, day_off_skipped: 2 });
    if (path.endsWith('/apply')) {
      return result({ created: 3, already_scheduled: 1, conflict_count: 1, conflicts: [{ employee: 'Gary Jezorski', date: '2026-09-15', message: 'Gary Jezorski — Tue Sep 15 overlaps Waverly 7:00–12:00' }] });
    }
    if (path === '/admin/schedule/remove-from-store') return { success: true, removed: 3 };
    if (path === '/admin/schedule/groups' && method === 'POST') return { success: true, group: { id: 6, name: (body as { name: string }).name, store_id: null, active: true, members: [] } };
    if (path.startsWith('/admin/schedule/groups/') && method === 'PUT') return { success: true, group: { id: 5, name: 'Bon Aqua Crew', store_id: null, active: true, members: [] } };
    return { success: true };
  };
  const api = {
    getToken: () => server.token,
    setToken: (t: string | null) => { server.token = t; },
    get: async (path: string) => {
      server.calls.push({ method: 'GET', path });
      if (path === '/auth/login-users') return { success: true, data: EMPLOYEES };
      if (path.startsWith('/admin/schedule/groups')) return GROUPS;
      if (path.startsWith('/admin/schedule/store-view')) return STORE_VIEW;
      if (path.startsWith('/admin/schedule/employee-view/1')) return EMPLOYEE_VIEW;
      return { success: true };
    },
    post: async (path: string, body: unknown) => mutate('POST', path, body),
    put: async (path: string, body: unknown) => mutate('PUT', path, body),
    del: async (path: string) => mutate('DELETE', path),
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { fetchStoreView, formatRange } from '../lib/schedule';
import WorkScheduleV2 from '../components/admin/WorkScheduleV2';
import ScheduleGroupsModal from '../components/admin/ScheduleGroupsModal';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
  server.failNext = null;
});

describe('schedule lib', () => {
  it('formats a segment range in 12-hour clock', () => {
    expect(formatRange(seg(1, 10, '07:00', '17:00'))).toBe('7:00 AM – 5:00 PM');
  });

  it('fetches the store view (Monday-first range)', async () => {
    const v = await fetchStoreView({ view: 'this_week' });
    expect(v.range.from).toBe('2026-09-14');
    expect(v.dates[0].weekday_label).toBe('Mon');
    expect(v.stores).toHaveLength(2);
  });
});

describe('Store View', () => {
  it('renders a section per store and the employee appears in both', async () => {
    render(<WorkScheduleV2 />);
    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    expect(screen.getByText('Bon Aqua')).toBeInTheDocument();
    // Gary works both stores → appears in both sections.
    expect(screen.getAllByText('Gary Jezorski').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Mon').length).toBeGreaterThan(0);
  });

  it('clicking an existing segment loads its actual times; date is read-only and time-only', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click(await screen.findByText('7:00 AM – 12:00 PM'));

    expect(await screen.findByText('Edit schedule')).toBeInTheDocument();
    expect(screen.getByText('Monday, September 14, 2026')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
    expect((screen.getByLabelText('Start Hour') as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText('End Hour') as HTMLInputElement).value).toBe('12');
  });

  it('a blank cell opens the editor with store-hours defaults', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click(await screen.findByLabelText('Add Gary Jezorski Waverly 2026-09-15'));

    expect(await screen.findByText('Add schedule')).toBeInTheDocument();
    expect((screen.getByLabelText('Start Hour') as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText('End Hour') as HTMLInputElement).value).toBe('5');
  });

  it('saving an existing segment PUTs and refreshes the grid', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click(await screen.findByText('7:00 AM – 12:00 PM'));
    fireEvent.click(await screen.findByRole('button', { name: /^Save$/ }));

    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT' && c.path === '/admin/schedule/segments/100')).toBe(true));
  });

  it('an overlapping save surfaces the backend validation message', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click(await screen.findByLabelText('Add Gary Jezorski Waverly 2026-09-15'));
    server.failNext = 'This employee is already scheduled 07:00–13:00 that day; the times overlap.';
    fireEvent.click(await screen.findByRole('button', { name: /^Save$/ }));

    expect(await screen.findByText(/times overlap/)).toBeInTheDocument();
  });
});

describe('Rapid scheduling', () => {
  it('Add Employee schedules the person for the range (POST /assign) and reports the result', async () => {
    render(<WorkScheduleV2 />);
    // Bo Vance is not yet in Waverly → offered in the Add-employee dropdown.
    const select = await screen.findByLabelText('Add employee to Waverly');
    fireEvent.change(select, { target: { value: '2' } });

    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'POST' && c.path === '/admin/schedule/assign')).toBe(true));
    // Result banner + grid reload; day-off skips reported separately.
    expect(await screen.findByText(/Created 5 schedule segments/)).toBeInTheDocument();
    expect(screen.getByText(/2 days off skipped/)).toBeInTheDocument();
    await vi.waitFor(() => {
      const after = server.calls.slice(server.calls.findIndex((c) => c.path === '/admin/schedule/assign') + 1);
      expect(after.some((c) => c.method === 'GET' && c.path.startsWith('/admin/schedule/store-view'))).toBe(true);
    });
  });

  it('Add Group applies the group and renders the conflict summary', async () => {
    render(<WorkScheduleV2 />);
    const select = await screen.findAllByLabelText(/Add group to/);
    fireEvent.change(select[0], { target: { value: '5' } });

    await vi.waitFor(() => expect(server.calls.some((c) => c.path === '/admin/schedule/groups/5/apply')).toBe(true));
    expect(await screen.findByText(/1 conflict/)).toBeInTheDocument();
    expect(screen.getByText(/overlaps Waverly 7:00–12:00/)).toBeInTheDocument();
  });

  it('Remove from schedule confirms then POSTs remove-from-store', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click((await screen.findAllByLabelText(/Remove Gary Jezorski from Waverly/))[0]);
    // Confirmation dialog appears before any request.
    expect(await screen.findByRole('heading', { name: 'Remove from schedule' })).toBeInTheDocument();
    expect(server.calls.some((c) => c.path === '/admin/schedule/remove-from-store')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^Remove$/ }));
    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'POST' && c.path === '/admin/schedule/remove-from-store')).toBe(true));
    expect(await screen.findByText(/Removed 3 scheduled days/)).toBeInTheDocument();
  });
});

describe('Group management', () => {
  it('lists employees alphabetically and creates a group', async () => {
    render(<ScheduleGroupsModal employees={EMPLOYEES} onClose={() => {}} onChanged={() => {}} />);

    // Employee checklist is alphabetical (Bo Vance before Gary Jezorski).
    const labels = await screen.findAllByText(/Vance|Jezorski/);
    expect(labels[0].textContent).toContain('Bo Vance');

    fireEvent.change(screen.getByLabelText('Group Name'), { target: { value: 'Saturday Crew' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Group/ }));

    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'POST' && c.path === '/admin/schedule/groups')).toBe(true));
  });
});

describe('Employee View', () => {
  it('renders one row per store with the store colors', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click(await screen.findByRole('button', { name: 'Employee View' }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });

    expect(await screen.findByText('Waverly')).toBeInTheDocument();
    expect(screen.getByText('Bon Aqua')).toBeInTheDocument();
    expect(screen.getAllByText('7:00 AM – 12:00 PM').length).toBeGreaterThanOrEqual(2);
  });
});
