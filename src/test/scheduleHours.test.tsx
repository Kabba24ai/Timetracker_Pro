import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Admin Work Schedule → Scheduled Hours: an Hours column per employee row, a
// Store Scheduled Hours row under each store, and a company Total Scheduled
// Hours row after all stores. Every figure is the server's (integer seconds);
// the UI only formats, so these tests prove what is DISPLAYED reconciles and
// that totals follow the established load-after-save refresh.

const server = vi.hoisted(() => ({
  calls: [] as { method: string; path: string }[],
  version: 0,
  failNext: null as string | null,
  legacy: false,
}));

const H = 3600;
const WEEK_DATES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
  const date = `2026-11-${String(9 + i).padStart(2, '0')}`;
  return { date, day_of_week: (i + 1) % 7, weekday_label: d, day_label: `${d}, Nov ${9 + i}` };
});
const MONTH_DATES = Array.from({ length: 30 }, (_, i) => {
  const date = `2026-11-${String(i + 1).padStart(2, '0')}`;
  const dow = (i + 0) % 7; // Nov 1 2026 is a Sunday
  return { date, day_of_week: dow, weekday_label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow], day_label: date };
});
const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { start: '07:00', end: '17:00', closed: false }]));
const WAVERLY = { id: 10, name: 'Waverly/Gorman', color: '#2563EB', hours };
const BON_AQUA = { id: 11, name: 'Bon Aqua', color: '#059669', hours };
const EMPLOYEES = [
  { id: 1, full_name: 'Ada Ant' },
  { id: 2, full_name: 'Bea Bee' },
  { id: 3, full_name: 'Cal Cat' },
  { id: 4, full_name: 'Dee Dog' },
];

type Dates = typeof WEEK_DATES;
const fig = (dates: Dates, h: Record<string, number>, overlap?: number) => {
  const daily = Object.fromEntries(dates.map((d) => [d.date, Math.round((h[d.date] ?? 0) * H)]));
  const total = Object.values(daily).reduce((a, b) => a + b, 0);
  return overlap === undefined ? { total_seconds: total, daily_seconds: daily } : { total_seconds: total, daily_seconds: daily, overlap_seconds: overlap };
};
const sum = (dates: Dates, figures: { daily_seconds: Record<string, number> }[]) => {
  const daily = Object.fromEntries(dates.map((d) => [d.date, figures.reduce((a, f) => a + (f.daily_seconds[d.date] ?? 0), 0)]));
  return { total_seconds: Object.values(daily).reduce((a, b) => a + b, 0), daily_seconds: daily };
};
const seg = (id: number, storeId: number, s: string, e: string) => ({ segment_id: id, store_id: storeId, start: s, end: e, overnight: false, editable: true });

type Row = { employee: { id: number; full_name: string }; cells: Record<string, ReturnType<typeof seg>[]>; scheduled_hours: ReturnType<typeof fig> };

/** Build a Store View payload whose store and company figures are the sums of its rows (as the server guarantees). */
const storeView = (dates: Dates, view: string, label: string, sections: { store_id: number; rows: Row[] }[]) => {
  const withTotals = sections.map((s) => ({ ...s, scheduled_hours: sum(dates, s.rows.map((r) => r.scheduled_hours)) }));
  return {
    success: true,
    range: { from: dates[0].date, to: dates[dates.length - 1].date, view, label, timezone: 'America/Chicago' },
    dates,
    stores: [BON_AQUA, WAVERLY],
    employees: EMPLOYEES,
    store_view: withTotals,
    scheduled_hours: sum(dates, withTotals.map((s) => s.scheduled_hours)),
  };
};

const D = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;
const weekdays = (h: number) => ({ [D(9)]: h, [D(10)]: h, [D(11)]: h, [D(12)]: h, [D(13)]: h });

// Bon Aqua: Ada 40.00 (Mon–Fri 8 h), Bea 27.50 (Mon 10, Tue 10, Sat 7.5).
// Waverly/Gorman: Ada 5.00 (Sat — she works both stores), Cal 10.00 (Mon) with an overlap counted once.
const BEFORE = storeView(WEEK_DATES, 'this_week', 'Nov 9 – Nov 15, 2026', [
  {
    store_id: 11,
    rows: [
      { employee: EMPLOYEES[0], cells: { [D(9)]: [seg(1, 11, '08:00', '16:00')] }, scheduled_hours: fig(WEEK_DATES, weekdays(8), 0) },
      { employee: EMPLOYEES[1], cells: { [D(9)]: [seg(2, 11, '07:00', '17:00')] }, scheduled_hours: fig(WEEK_DATES, { [D(9)]: 10, [D(10)]: 10, [D(14)]: 7.5 }, 0) },
    ],
  },
  {
    store_id: 10,
    rows: [
      { employee: EMPLOYEES[0], cells: { [D(14)]: [seg(3, 10, '12:00', '17:00')] }, scheduled_hours: fig(WEEK_DATES, { [D(14)]: 5 }, 0) },
      { employee: EMPLOYEES[2], cells: { [D(9)]: [seg(4, 10, '07:00', '17:00')] }, scheduled_hours: fig(WEEK_DATES, { [D(9)]: 10 }, H) },
    ],
  },
]);

// After "Add employee": Dee is scheduled at Waverly/Gorman Mon–Fri 8 h (+40.00).
const AFTER = storeView(WEEK_DATES, 'this_week', 'Nov 9 – Nov 15, 2026', [
  BEFORE.store_view[0],
  {
    store_id: 10,
    rows: [...BEFORE.store_view[1].rows, { employee: EMPLOYEES[3], cells: { [D(9)]: [seg(5, 10, '08:00', '16:00')] }, scheduled_hours: fig(WEEK_DATES, weekdays(8), 0) }],
  },
]);

// Month: Ada 21 weekdays × 9.5 h at Bon Aqua.
const MONTH_WEEKDAYS = Object.fromEntries(MONTH_DATES.filter((d) => d.day_of_week >= 1 && d.day_of_week <= 5).map((d) => [d.date, 9.5]));
const MONTH = storeView(MONTH_DATES, 'month', 'November 2026', [
  { store_id: 11, rows: [{ employee: EMPLOYEES[0], cells: {}, scheduled_hours: fig(MONTH_DATES, MONTH_WEEKDAYS, 0) }] },
  { store_id: 10, rows: [] },
]);

const EMPLOYEE_VIEW = {
  success: true,
  range: BEFORE.range,
  employee: EMPLOYEES[0],
  dates: WEEK_DATES,
  stores: [BON_AQUA, WAVERLY],
  employee_view: [
    { store_id: 11, cells: { [D(9)]: [seg(1, 11, '08:00', '16:00')] }, scheduled_hours: fig(WEEK_DATES, weekdays(8)) },
    { store_id: 10, cells: { [D(14)]: [seg(3, 10, '12:00', '17:00')] }, scheduled_hours: fig(WEEK_DATES, { [D(14)]: 5 }) },
  ],
  day_offs: [],
  scheduled_hours: { ...fig(WEEK_DATES, { ...weekdays(8), [D(14)]: 5 }), overlap_seconds: 0 },
};

const strip = <T extends Record<string, unknown>>(o: T) => {
  // An API that predates Scheduled Hours.
  const copy = JSON.parse(JSON.stringify(o));
  delete copy.scheduled_hours;
  (copy.store_view ?? []).forEach((s: Record<string, unknown> & { rows: Record<string, unknown>[] }) => {
    delete s.scheduled_hours;
    s.rows.forEach((r) => delete r.scheduled_hours);
  });
  return copy;
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
  const mutate = (method: string, path: string) => {
    server.calls.push({ method, path });
    if (server.failNext) {
      const msg = server.failNext;
      server.failNext = null;
      throw new ApiError(msg, 422);
    }
    server.version += 1;
    if (path === '/admin/schedule/assign') return { success: true, result: { created: 5, already_scheduled: 0, day_off_skipped: 0, days_off: [], conflict_count: 0, conflicts: [] } };
    return { success: true };
  };
  const api = {
    getToken: () => 'tok',
    get: async (path: string) => {
      server.calls.push({ method: 'GET', path });
      if (path === '/auth/login-users') return { success: true, data: EMPLOYEES };
      if (path.startsWith('/admin/schedule/groups')) return { success: true, groups: [] };
      if (path.startsWith('/admin/schedule/store-view')) {
        const payload = path.includes('view=month') ? MONTH : server.version > 0 ? AFTER : BEFORE;
        return server.legacy ? strip(payload) : payload;
      }
      if (path.startsWith('/admin/schedule/employee-view/1')) return server.legacy ? strip(EMPLOYEE_VIEW) : EMPLOYEE_VIEW;
      return { success: true };
    },
    post: async (path: string) => mutate('POST', path),
    put: async (path: string) => mutate('PUT', path),
    del: async (path: string) => mutate('DELETE', path),
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { formatScheduledHours, formatScheduledHoursLabel } from '../lib/schedule';
import WorkScheduleV2 from '../components/admin/WorkScheduleV2';

beforeEach(() => {
  server.calls = [];
  server.version = 0;
  server.failNext = null;
  server.legacy = false;
});

/** The section (store card) whose heading is this store's name. */
const sectionOf = (name: string) => screen.getByRole('heading', { name }).closest('div.border') as HTMLElement;
const num = (text: string | null | undefined) => Number((text ?? '').replace(/[^0-9.]/g, ''));
/** The far-right Hours cell of a row. */
const lastCell = (row: HTMLElement) => row.querySelector('td:last-child')?.textContent ?? '';
const employeeRow = (section: HTMLElement, name: string) => within(section).getByText(name, { selector: 'span' }).closest('tr') as HTMLElement;
const totalsRow = (scope: HTMLElement, label: string) => within(scope).getByRole('rowheader', { name: label }).closest('tr') as HTMLElement;
const companyBlock = () => screen.getByRole('region', { name: 'Total Scheduled Hours, all stores' });

describe('Scheduled Hours formatting', () => {
  it('formats integer seconds as two-decimal hours, exactly', () => {
    expect(formatScheduledHours(40 * H)).toBe('40.00');
    expect(formatScheduledHours(27.5 * H)).toBe('27.50');
    expect(formatScheduledHours(0)).toBe('0.00');
    expect(formatScheduledHours(9 * H + 40 * 60)).toBe('9.67'); // 9 h 40 min
    expect(formatScheduledHours(8 * H + 15 * 60)).toBe('8.25');
    expect(formatScheduledHours(1404 * H)).toBe('1,404.00');
    expect(formatScheduledHoursLabel(351 * H)).toBe('351.00 hrs');
  });
});

describe('Store View — Hours column and totals', () => {
  it('adds an Hours column with each employee’s scheduled hours at that store', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    const bon = sectionOf('Bon Aqua');
    expect(within(bon).getByRole('columnheader', { name: 'Hours' })).toBeInTheDocument();
    expect(lastCell(employeeRow(bon, 'Ada Ant'))).toBe('40.00 hrs');
    expect(lastCell(employeeRow(bon, 'Bea Bee'))).toBe('27.50 hrs');
    // Ada also works Waverly/Gorman: her row there carries only that store's share.
    expect(lastCell(employeeRow(sectionOf('Waverly/Gorman'), 'Ada Ant'))).toBe('5.00 hrs');
  });

  it('each store’s totals row is the sum of its employee rows, by day and for the period', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    for (const name of ['Bon Aqua', 'Waverly/Gorman']) {
      const section = sectionOf(name);
      const totals = totalsRow(section, 'Store Scheduled Hours');
      const bodyRows = within(section).getAllByRole('row').filter((r) => r.closest('tbody'));
      const employeeTotals = bodyRows.map((r) => num(lastCell(r))).reduce((a, b) => a + b, 0);
      expect(num(lastCell(totals))).toBeCloseTo(employeeTotals, 2);
      // Day cells sum to the period cell.
      const dayCells = Array.from(totals.querySelectorAll('td')).slice(0, -1).map((c) => num(c.textContent));
      expect(dayCells).toHaveLength(7);
      expect(dayCells.reduce((a, b) => a + b, 0)).toBeCloseTo(num(lastCell(totals)), 2);
    }
    const bon = totalsRow(sectionOf('Bon Aqua'), 'Store Scheduled Hours');
    expect(Array.from(bon.querySelectorAll('td')).map((c) => c.textContent)).toEqual(['18.00', '18.00', '8.00', '8.00', '8.00', '7.50', '0.00', '67.50 hrs']);
  });

  it('the company Total Scheduled Hours equals the store totals shown, day by day and in total', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    const company = totalsRow(companyBlock(), 'Total Scheduled Hours');
    const stores = ['Bon Aqua', 'Waverly/Gorman'].map((n) => totalsRow(sectionOf(n), 'Store Scheduled Hours'));
    const cells = (r: HTMLElement) => Array.from(r.querySelectorAll('td')).map((c) => num(c.textContent));
    const companyCells = cells(company);
    const storeCells = stores.map(cells);
    companyCells.forEach((v, i) => expect(v).toBeCloseTo(storeCells[0][i] + storeCells[1][i], 2));
    expect(lastCell(company)).toBe('82.50 hrs');
    // The grand total is the most prominent figure.
    expect(company.querySelector('td:last-child')?.className).toContain('font-bold');
    expect(company.querySelector('td:last-child')?.className).toContain('text-base');
  });

  it('flags an employee whose overlapping entries were counted once', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Waverly/Gorman' });
    const cal = employeeRow(sectionOf('Waverly/Gorman'), 'Cal Cat');
    expect(within(cal).getByLabelText('Overlapping schedule entries counted once')).toBeInTheDocument();
    expect(within(employeeRow(sectionOf('Bon Aqua'), 'Ada Ant')).queryByLabelText('Overlapping schedule entries counted once')).toBeNull();
  });

  it('totals refresh after a successful scheduling action (the established reload)', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Waverly/Gorman' });
    expect(lastCell(totalsRow(companyBlock(), 'Total Scheduled Hours'))).toBe('82.50 hrs');

    fireEvent.change(screen.getByLabelText('Add employee to Waverly/Gorman'), { target: { value: '4' } });

    expect(await screen.findByText('Dee Dog', { selector: 'span' })).toBeInTheDocument();
    expect(lastCell(employeeRow(sectionOf('Waverly/Gorman'), 'Dee Dog'))).toBe('40.00 hrs');
    expect(lastCell(totalsRow(sectionOf('Waverly/Gorman'), 'Store Scheduled Hours'))).toBe('55.00 hrs');
    expect(lastCell(totalsRow(companyBlock(), 'Total Scheduled Hours'))).toBe('122.50 hrs');
  });

  it('a failed save leaves every displayed total exactly as committed', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Waverly/Gorman' });
    server.failNext = 'Dee Dog is already scheduled; the times overlap.';

    fireEvent.change(screen.getByLabelText('Add employee to Waverly/Gorman'), { target: { value: '4' } });

    expect(await screen.findByText(/times overlap/)).toBeInTheDocument();
    expect(screen.queryByText('Dee Dog', { selector: 'span' })).toBeNull();
    expect(lastCell(totalsRow(sectionOf('Waverly/Gorman'), 'Store Scheduled Hours'))).toBe('15.00 hrs');
    expect(lastCell(totalsRow(companyBlock(), 'Total Scheduled Hours'))).toBe('82.50 hrs');
  });

  it('Month shows a total for every displayed date, not an assumed seven', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    expect(await screen.findByText('November 2026')).toBeInTheDocument();
    expect(server.calls.some((c) => c.path.includes('view=month'))).toBe(true);
    const company = totalsRow(companyBlock(), 'Total Scheduled Hours');
    expect(company.querySelectorAll('td')).toHaveLength(31); // 30 dates + the period total
    expect(lastCell(company)).toBe('199.50 hrs'); // 21 weekdays × 9.5 h
    expect(lastCell(totalsRow(sectionOf('Waverly/Gorman'), 'Store Scheduled Hours'))).toBe('0.00 hrs');
  });

  it('keeps horizontal scrolling and a sticky label column for wide ranges', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    const totals = totalsRow(sectionOf('Bon Aqua'), 'Store Scheduled Hours');
    expect(totals.closest('table')?.parentElement?.className).toContain('overflow-x-auto');
    expect(within(totals).getByRole('rowheader').className).toContain('sticky');
  });

  it('fits a desktop week: long names wrap, Remove is icon-only below 2xl, shift labels keep their size', async () => {
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    const bon = sectionOf('Bon Aqua');
    expect(within(bon).getByRole('columnheader', { name: 'Employee' }).className).toContain('min-w-[11rem]');

    const row = employeeRow(bon, 'Ada Ant');
    const nameCell = row.querySelector('td') as HTMLElement;
    expect(nameCell.className).toContain('sticky');
    expect(nameCell.className).not.toContain('whitespace-nowrap');
    // Remove keeps its accessible name and tooltip; only the visible word is 2xl-only.
    const remove = within(row).getByRole('button', { name: 'Remove Ada Ant from Bon Aqua' });
    expect(remove).toHaveAttribute('title', 'Remove Ada Ant from Bon Aqua for this range');
    expect(within(remove).getByText('Remove').className.split(/\s+/)).toEqual(['hidden', '2xl:inline']);

    const chip = within(row).getAllByRole('button', { name: /AM|PM/ })[0];
    expect(chip.className).toContain('text-xs');
    expect(chip.className).toContain('whitespace-nowrap');
  });

  it('an API without Scheduled Hours shows the grid exactly as before (no Hours column, no totals)', async () => {
    server.legacy = true;
    render(<WorkScheduleV2 />);
    await screen.findByRole('heading', { name: 'Bon Aqua' });
    expect(screen.queryByRole('columnheader', { name: 'Hours' })).toBeNull();
    expect(screen.queryByText('Store Scheduled Hours')).toBeNull();
    expect(screen.queryByText(/Total Scheduled Hours/)).toBeNull();
  });
});

describe('Employee View — scheduled hours', () => {
  it('shows each store row’s hours and the employee’s daily and period total', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.click(await screen.findByRole('button', { name: 'Employee View' }));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });

    const bonRow = (await screen.findByText('Bon Aqua')).closest('tr') as HTMLElement;
    expect(screen.getByRole('columnheader', { name: 'Hours' })).toBeInTheDocument();
    expect(lastCell(bonRow)).toBe('40.00 hrs');
    expect(lastCell(screen.getByText('Waverly/Gorman').closest('tr') as HTMLElement)).toBe('5.00 hrs');

    const total = screen.getByRole('rowheader', { name: 'Total Scheduled Hours' }).closest('tr') as HTMLElement;
    expect(Array.from(total.querySelectorAll('td')).map((c) => c.textContent)).toEqual(['8.00', '8.00', '8.00', '8.00', '8.00', '5.00', '0.00', '45.00 hrs']);
  });
});
