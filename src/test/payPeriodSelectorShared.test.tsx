import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Pay Periods and Time Review render ONE shared PayPeriodSelector over ONE shared
// selection. These tests pin what that buys: both tabs resolve Current/Previous
// identically, offer only the backend's established periods (never a typed date),
// keep the selection across navigation, format periods the same way, and only
// ever display — or export — data for the period currently selected.

const server = vi.hoisted(() => ({
  calls: [] as string[],
  periods: null as unknown,
  // When `hold` is on, summary + time-review responses wait in `pending` until a
  // test releases (or fails) them — in whatever order it wants.
  hold: false,
  pending: [] as { path: string; release: () => void; fail: () => void }[],
}));

// The canonical list the server resolver returns (newest first): Current, a
// Previous that crosses Aug→Sep, and a December→January period.
const PERIODS = [
  { from: '2026-09-13', to: '2026-09-26', label: 'Sep 13 – Sep 26, 2026', is_current: true, is_previous: false },
  { from: '2026-08-30', to: '2026-09-12', label: 'Aug 30 – Sep 12, 2026', is_current: false, is_previous: true },
  { from: '2026-08-16', to: '2026-08-29', label: 'Aug 16 – Aug 29, 2026', is_current: false, is_previous: false },
  { from: '2026-08-02', to: '2026-08-15', label: 'Aug 2 – Aug 15, 2026', is_current: false, is_previous: false },
  { from: '2025-12-28', to: '2026-01-10', label: 'Dec 28, 2025 – Jan 10, 2026', is_current: false, is_previous: false },
];

// Ada's payroll buckets (hours) per period start — deliberately different for
// every period, so showing the wrong period's numbers cannot pass.
type Buckets = { r: number; o: number; v: number; h: number; x: number };
const ADA: Record<string, Buckets> = {
  '2026-09-13': { r: 40, o: 5, v: 0, h: 0, x: 0 }, // Total Paid 45 (+ Bo 20 = 65)
  '2026-08-30': { r: 38, o: 0, v: 8, h: 0, x: 0 }, // 46 (66)
  '2026-08-16': { r: 36, o: 3, v: 0, h: 8, x: 0 }, // 47 (67)
  '2026-08-02': { r: 30, o: 0, v: 0, h: 0, x: 4 }, // 34 (54)
  '2025-12-28': { r: 32, o: 0, v: 0, h: 8, x: 0 }, // 40 (60)
};
const BO: Buckets = { r: 20, o: 0, v: 0, h: 0, x: 0 };

const hours = (b: Buckets) => {
  const s = (h: number) => h * 3600;
  const worked = b.r + b.o;
  const paid = worked + b.v + b.h + b.x;
  return {
    regular_worked_seconds: s(b.r), regular_worked_hours: b.r,
    overtime_worked_seconds: s(b.o), overtime_worked_hours: b.o,
    vacation_seconds: s(b.v), vacation_hours: b.v,
    holiday_seconds: s(b.h), holiday_hours: b.h,
    other_paid_leave_seconds: s(b.x), other_paid_leave_hours: b.x,
    total_worked_seconds: s(worked), total_worked_hours: worked,
    total_paid_seconds: s(paid), total_paid_hours: paid,
    paid_seconds: s(worked), paid_hours: worked, unpaid_seconds: 0, unpaid_hours: 0,
    gross_seconds: s(worked), gross_hours: worked, lunch_seconds: 0, other_break_seconds: 0,
    shift_count: 5, open_shift_count: 0, has_open_shift: false,
  };
};

const sum = (a: Buckets, b: Buckets): Buckets => ({ r: a.r + b.r, o: a.o + b.o, v: a.v + b.v, h: a.h + b.h, x: a.x + b.x });

// The server's own resolution: explicit dates win, otherwise the canonical
// selector — and with NEITHER it falls back to Current, which is exactly why the
// client must never send an empty Custom request.
const resolve = (qs: URLSearchParams) => {
  if (qs.get('from') && qs.get('to')) return { from: qs.get('from')!, to: qs.get('to')!, label: null };
  const p = qs.get('period') === 'previous' ? PERIODS[1] : PERIODS[0];
  return { from: p.from, to: p.to, label: p.label };
};

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
    firstError() {
      return this.message;
    }
  }
  const api = {
    getToken: () => 'tok',
    setToken: () => {},
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      const qs = new URLSearchParams(path.split('?')[1] ?? '');
      const payroll = path.startsWith('/admin/pay-periods/summary') || path.includes('/time-review');
      if (payroll && server.hold) {
        await new Promise<void>((release, reject) =>
          server.pending.push({
            path,
            release,
            fail: () => reject(new ApiError('The server could not load this period.', 500)),
          }),
        );
      }
      if (path.startsWith('/admin/pay-periods/summary')) {
        const range = resolve(qs);
        const ada = ADA[range.from];
        const rows = [
          { employee: { id: 1, full_name: 'Ada Clockwell' }, ...hours(ada), flags: ['pending'] },
          { employee: { id: 2, full_name: 'Bo Vance' }, ...hours(BO), flags: [] },
        ];
        return {
          success: true,
          period: { ...range, timezone: 'America/Chicago' },
          totals: { employees: 2, employees_with_activity: 2, ...hours(sum(ada, BO)) },
          data: qs.get('flagged') === '1' ? rows.slice(0, 1) : rows,
        };
      }
      if (path.startsWith('/admin/pay-periods')) {
        if (server.periods === 'fail') throw new ApiError('nope', 500);
        return { success: true, timezone: 'America/Chicago', data: PERIODS };
      }
      if (path.includes('/time-review')) {
        const range = resolve(qs);
        return {
          success: true,
          employee: { id: 1, full_name: 'Ada Clockwell' },
          period: { ...range, timezone: 'America/Chicago' },
          totals: hours(ADA[range.from]),
          days: [],
        };
      }
      if (path.startsWith('/auth/login-users')) {
        return { success: true, data: [{ id: 1, full_name: 'Ada Clockwell' }, { id: 2, full_name: 'Bo Vance' }] };
      }
      return { success: true, data: [] };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      return { success: true };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    timezone: 'America/Chicago',
    isAdmin: true,
    employee: { first_name: 'Ada', last_name: 'Admin', role: 'master_admin' },
    signOut: vi.fn(),
  }),
}));

import { formatPeriodRange } from '../lib/admin';
import PayPeriodSummaryGrid from '../components/admin/PayPeriodSummary';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import AdminDashboard from '../pages/AdminDashboard';

// Captured downloads: the serialized CSV + the anchor's download filename.
const downloads: { name: string; text: string }[] = [];
const RealBlob = globalThis.Blob;
class RecordingBlob extends RealBlob {
  __parts: string[];
  constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
    super(parts, options);
    this.__parts = parts.map(String);
  }
}
globalThis.Blob = RecordingBlob as unknown as typeof Blob;

beforeEach(() => {
  server.calls = [];
  server.periods = null;
  server.hold = false;
  server.pending = [];
  downloads.length = 0;
  URL.createObjectURL = vi.fn((blob: Blob & { __parts?: string[] }) => {
    downloads.push({ name: '', text: (blob.__parts ?? []).join('') });
    return 'blob:mock';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (downloads.length) downloads[downloads.length - 1].name = this.download;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Helpers ────────────────────────────────────────────────────────────────

const last = (calls: string[]) => calls[calls.length - 1];
const summaryCalls = () => server.calls.filter((c) => c.startsWith('GET /admin/pay-periods/summary'));
const reviewCalls = () => server.calls.filter((c) => c.includes('/time-review'));
const listCalls = () => server.calls.filter((c) => c.startsWith('GET /admin/pay-periods?'));
const query = (call: string) => new URLSearchParams(call.split('?')[1] ?? '');
const dateInputs = () => document.querySelectorAll('input[type="date"]');
const heading = () => screen.queryByTestId('period-heading');

/** Settle a held response (or failure) and let React finish with it. */
const settle = (step: () => void) =>
  act(async () => {
    step();
    await new Promise((r) => setTimeout(r, 0));
  });

/** The Pay Periods overview card value for a label, e.g. 'Total Paid' → '45:00'. */
const periodCard = (label: string) =>
  within(screen.getByTestId('period-totals')).getByText(label).nextElementSibling?.textContent;

/** A Time Review summary card value for a label (undefined when no cards render). */
const reviewCard = (label: string) =>
  screen.queryAllByText(label).find((el) => el.tagName === 'P')?.nextElementSibling?.textContent;

/** A Pay Periods row's cells: Employee, Regular, OT, Vacation, Holiday, Other, Worked, Paid. */
const rowCells = (name: string) =>
  Array.from(screen.getByText(name, { selector: 'td' }).closest('tr')!.querySelectorAll('td'))
    .slice(0, 8)
    .map((td) => td.textContent?.trim());

const options = (select: HTMLElement) =>
  within(select).getAllByRole('option').map((o) => [(o as HTMLOptionElement).value, o.textContent]);

const modeButtons = () =>
  ['Current Period', 'Previous Period', 'Custom'].map((name) => screen.getByRole('button', { name }));

/** Pay Periods: load, optionally switch to Previous, and wait for that period's data + the list. */
const mountPayPeriods = async (mode: 'Current Period' | 'Previous Period' = 'Current Period') => {
  const lists = listCalls().length;
  render(<PayPeriodSummaryGrid onDrillDown={() => {}} />);
  await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));
  if (mode === 'Previous Period') {
    fireEvent.click(screen.getByText('Previous Period'));
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('66:00'));
  }
  await vi.waitFor(() => expect(listCalls()).toHaveLength(lists + 1));
};

const refreshButton = () => screen.getByRole('button', { name: /Refresh/i });

/** Time Review: load, optionally switch to Previous, and wait for the response + the list. */
const mountTimeReview = async (mode: 'Current Period' | 'Previous Period' = 'Current Period') => {
  const lists = listCalls().length;
  render(<TimeReviewV2 initialUserId={1} />);
  await vi.waitFor(() => expect(reviewCard('Total Paid')).toBe('45:00'));
  if (mode === 'Previous Period') {
    fireEvent.click(screen.getByText('Previous Period'));
    await vi.waitFor(() => expect(reviewCard('Total Paid')).toBe('46:00'));
  }
  await vi.waitFor(() => expect(listCalls()).toHaveLength(lists + 1));
};

const openCustom = async () => {
  fireEvent.click(screen.getByText('Custom'));
  return (await screen.findByLabelText('Pay Period')) as HTMLSelectElement;
};

const pick = (select: HTMLSelectElement, value: string) => fireEvent.change(select, { target: { value } });

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>,
  );

// ── 1 + 2. Current and Previous resolve identically in both tabs ───────────

describe.each([
  ['Current Period', 'current', PERIODS[0]],
  ['Previous Period', 'previous', PERIODS[1]],
] as const)('%s is the same period in both tabs', (button, selector, expected) => {
  it('both tabs ask the server for the canonical selector — neither sends dates', async () => {
    await mountPayPeriods(button);
    expect(query(last(summaryCalls())).get('period')).toBe(selector);
    expect(last(summaryCalls())).not.toContain('from=');
    cleanup();

    await mountTimeReview(button);
    expect(query(last(reviewCalls())).get('period')).toBe(selector);
    expect(last(reviewCalls())).not.toContain('from=');
  });

  it('both tabs show the same resolved period, and Custom opens both on it', async () => {
    const label = formatPeriodRange(expected.from, expected.to);

    await mountPayPeriods(button);
    expect(heading()).toHaveTextContent(new RegExp(`^${label}`));
    expect(await openCustom()).toHaveValue(expected.from);
    await vi.waitFor(() => expect(query(last(summaryCalls())).get('from')).toBe(expected.from));
    expect(query(last(summaryCalls())).get('to')).toBe(expected.to);
    cleanup();

    await mountTimeReview(button);
    expect(heading()).toHaveTextContent(new RegExp(`^${label}`));
    expect(await openCustom()).toHaveValue(expected.from);
    await vi.waitFor(() => expect(query(last(reviewCalls())).get('from')).toBe(expected.from));
    expect(query(last(reviewCalls())).get('to')).toBe(expected.to);
  });
});

// ── 3. Custom offers the identical list; the controls are identical ────────

describe('both tabs present the identical selector', () => {
  it('Custom lists the same established periods: same values, labels, order and markers', async () => {
    await mountPayPeriods();
    const pp = options(await openCustom());
    cleanup();

    await mountTimeReview();
    const tr = options(await openCustom());

    expect(pp).toEqual(tr);
    expect(pp).toEqual([
      ['2026-09-13', 'Sep 13 – Sep 26, 2026 — Current'],
      ['2026-08-30', 'Aug 30 – Sep 12, 2026 — Previous'],
      ['2026-08-16', 'Aug 16 – Aug 29, 2026'],
      ['2026-08-02', 'Aug 2 – Aug 15, 2026'],
      ['2025-12-28', 'Dec 28, 2025 – Jan 10, 2026'],
    ]);
  });

  it('same button labels and the same selected-state marker', async () => {
    await mountPayPeriods('Previous Period');
    const pp = modeButtons().map((b) => [b.textContent, b.getAttribute('aria-pressed'), b.className]);
    cleanup();

    await mountTimeReview('Previous Period');
    const tr = modeButtons().map((b) => [b.textContent, b.getAttribute('aria-pressed'), b.className]);

    expect(pp).toEqual(tr);
    expect(pp.map(([text, pressed]) => [text, pressed])).toEqual([
      ['Current Period', 'false'],
      ['Previous Period', 'true'],
      ['Custom', 'false'],
    ]);
  });

  it('both tabs read the list from the one canonical endpoint, with no tenant or store parameters', async () => {
    await mountPayPeriods();
    cleanup();
    await mountTimeReview();
    expect(listCalls()).toEqual(['GET /admin/pay-periods?count=26', 'GET /admin/pay-periods?count=26']);
  });
});

// ── 4–6. No manual dates, no arbitrary ranges ──────────────────────────────

describe('no manual or arbitrary dates', () => {
  it.each([
    ['Pay Periods', () => mountPayPeriods()],
    ['Time Review', () => mountTimeReview()],
  ])('%s has no date input and no Custom Date Range option in any mode', async (_tab, mount) => {
    await mount();
    expect(dateInputs()).toHaveLength(0);

    fireEvent.click(screen.getByText('Previous Period'));
    expect(dateInputs()).toHaveLength(0);

    const select = await openCustom();
    expect(dateInputs()).toHaveLength(0);
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
    expect(within(select).queryByText(/Custom Date Range/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Custom Date Range/i)).not.toBeInTheDocument();
  });

  it('the dropdown offers only established periods, and any other value is ignored', async () => {
    await mountPayPeriods();
    const select = await openCustom();
    expect(options(select).map(([value]) => value)).toEqual(PERIODS.map((p) => p.from));
    await vi.waitFor(() => expect(query(last(summaryCalls())).get('from')).toBe('2026-09-13'));
    server.calls = [];

    pick(select, '2026-07-07'); // not an established period

    expect(summaryCalls()).toHaveLength(0);
    expect(select).toHaveValue('2026-09-13');
  });

  it.each([
    ['Pay Periods', () => mountPayPeriods()],
    ['Time Review', () => mountTimeReview()],
  ])('%s shows an error with Retry — never date inputs — when the list is unavailable', async (_tab, mount) => {
    server.periods = 'fail';
    await mount();
    fireEvent.click(screen.getByText('Custom'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pay periods could not be loaded.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(dateInputs()).toHaveLength(0);
    expect(screen.queryByLabelText('Pay Period')).not.toBeInTheDocument();

    server.periods = null;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const select = (await screen.findByLabelText('Pay Period')) as HTMLSelectElement;
    expect(options(select).slice(1).map(([value]) => value)).toEqual(PERIODS.map((p) => p.from));
  });
});

// ── 7. Picking a historical period updates every total ─────────────────────

describe('Pay Periods — selecting a historical period', () => {
  it('reloads the summary for exactly that period and updates every payroll total', async () => {
    await mountPayPeriods();
    const select = await openCustom();
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));
    server.calls = [];

    pick(select, '2026-08-16');

    await vi.waitFor(() => expect(summaryCalls()).toHaveLength(1));
    expect(query(summaryCalls()[0]).get('from')).toBe('2026-08-16');
    expect(query(summaryCalls()[0]).get('to')).toBe('2026-08-29');
    expect(summaryCalls()[0]).not.toContain('period=');

    // Ada 36 regular + 3 OT + 8 holiday; Bo 20 regular.
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('67:00'));
    expect(periodCard('Regular')).toBe('56:00');
    expect(periodCard('Overtime')).toBe('3:00');
    expect(periodCard('Vacation')).toBe('0:00');
    expect(periodCard('Holiday')).toBe('8:00');
    expect(periodCard('Other Paid Leave')).toBe('0:00');
    expect(rowCells('Ada Clockwell')).toEqual(['Ada Clockwell', '36:00', '3:00', '—', '8:00', '—', '39:00', '47:00']);
    expect(heading()).toHaveTextContent(/^Aug 16 – Aug 29, 2026/);
    expect(select).toHaveValue('2026-08-16');
  });

  it('Exceptions only, Sort and Refresh keep the selected period', async () => {
    await mountPayPeriods();
    const select = await openCustom();
    pick(select, '2026-08-02');
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('54:00'));

    fireEvent.click(screen.getByLabelText('Exceptions only'));
    await vi.waitFor(() => expect(screen.queryByText('Bo Vance')).not.toBeInTheDocument());
    expect(query(last(summaryCalls())).get('from')).toBe('2026-08-02');
    expect(query(last(summaryCalls())).get('flagged')).toBe('1');

    fireEvent.click(screen.getByText(/^Sort:/));
    await vi.waitFor(() => expect(last(summaryCalls())).toContain('sort=paid_desc'));
    expect(query(last(summaryCalls())).get('from')).toBe('2026-08-02');

    server.calls = [];
    fireEvent.click(refreshButton());
    await vi.waitFor(() => expect(summaryCalls()).toHaveLength(1));
    expect(query(summaryCalls()[0]).get('from')).toBe('2026-08-02');
    expect(query(summaryCalls()[0]).get('to')).toBe('2026-08-15');
    expect(select).toHaveValue('2026-08-02');
    expect(periodCard('Total Paid')).toBe('54:00');
  });
});

// ── 8 + 10. Reconciliation, drill-down and navigation ──────────────────────

describe('the selection survives drill-down and navigation', () => {
  it('drilling in opens Time Review on the SAME period with the SAME totals; Back restores the summary', async () => {
    renderDashboard();
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));
    await vi.waitFor(() => expect(listCalls()).toHaveLength(1));
    pick(await openCustom(), '2026-08-16');
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('67:00'));
    const summaryRow = rowCells('Ada Clockwell');
    const summaryHeading = heading()!.textContent!;

    server.calls = [];
    fireEvent.click(screen.getByText('Ada Clockwell', { selector: 'td' }));
    await screen.findByText(/Back to Pay Period Summary/i);

    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    expect(query(reviewCalls()[0]).get('from')).toBe('2026-08-16');
    expect(query(reviewCalls()[0]).get('to')).toBe('2026-08-29');
    expect(await screen.findByLabelText('Pay Period')).toHaveValue('2026-08-16');

    // Employee, Regular, OT, Vacation, Holiday, Other, Total Worked, Total Paid.
    await vi.waitFor(() => expect(reviewCard('Total Paid')).toBe(summaryRow[7]));
    expect(reviewCard('Regular')).toBe(summaryRow[1]);
    expect(reviewCard('Overtime')).toBe(summaryRow[2]);
    expect(reviewCard('Holiday')).toBe(summaryRow[4]);
    expect(reviewCard('Total Worked')).toBe(summaryRow[6]);
    // Same period heading in both screens.
    expect(summaryHeading.startsWith('Aug 16 – Aug 29, 2026')).toBe(true);
    expect(heading()).toHaveTextContent(/^Aug 16 – Aug 29, 2026/);

    server.calls = [];
    fireEvent.click(screen.getByText(/Back to Pay Period Summary/i));
    expect(await screen.findByLabelText('Pay Period')).toHaveValue('2026-08-16');
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('67:00'));
    expect(query(summaryCalls()[0]).get('from')).toBe('2026-08-16');
  });

  it('switching tabs keeps ONE selection, whichever tab changes it', async () => {
    renderDashboard();
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));
    await vi.waitFor(() => expect(listCalls()).toHaveLength(1));
    pick(await openCustom(), '2026-08-02');
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('54:00'));

    // Pay Periods → Time Review: the same established period, not a reset to Current.
    fireEvent.click(screen.getByRole('button', { name: 'Time Review' }));
    fireEvent.change(await screen.findByLabelText('Employee'), { target: { value: '1' } });
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    expect(query(last(reviewCalls())).get('from')).toBe('2026-08-02');
    expect(query(last(reviewCalls())).get('to')).toBe('2026-08-15');
    expect(await screen.findByLabelText('Pay Period')).toHaveValue('2026-08-02');

    // Changed in Time Review → Pay Periods follows.
    fireEvent.click(screen.getByText('Previous Period'));
    await vi.waitFor(() => expect(query(last(reviewCalls())).get('period')).toBe('previous'));

    server.calls = [];
    fireEvent.click(screen.getByRole('button', { name: 'Pay Periods' }));
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('66:00'));
    expect(query(summaryCalls()[0]).get('period')).toBe('previous');
    expect(screen.getByRole('button', { name: 'Previous Period' })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ── 9. Exports use the selected period ─────────────────────────────────────

describe('Export Full Pay Period follows the selected period', () => {
  it('exports exactly the picked period — every employee, even under Exceptions only', async () => {
    await mountPayPeriods();
    pick(await openCustom(), '2025-12-28');
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('60:00'));
    fireEvent.click(screen.getByLabelText('Exceptions only'));
    await vi.waitFor(() => expect(screen.queryByText('Bo Vance')).not.toBeInTheDocument());

    server.calls = [];
    fireEvent.click(screen.getByRole('button', { name: /Export Full Pay Period/i }));
    await vi.waitFor(() => expect(downloads).toHaveLength(1));

    expect(summaryCalls()).toHaveLength(1);
    expect(query(summaryCalls()[0]).get('from')).toBe('2025-12-28');
    expect(query(summaryCalls()[0]).get('to')).toBe('2026-01-10');
    expect(summaryCalls()[0]).not.toContain('flagged=1');
    expect(downloads[0].name).toBe('pay-period_2025-12-28_2026-01-10.csv');

    // The CSV format is unchanged: ISO dates, decimal hours.
    const lines = downloads[0].text.split('\n');
    expect(lines).toHaveLength(3); // header + both employees
    expect(lines[1].split(',').slice(0, 4)).toEqual(['Ada Clockwell', '2025-12-28', '2026-01-10', '32.00']);
    expect(lines[2].split(',').slice(0, 3)).toEqual(['Bo Vance', '2025-12-28', '2026-01-10']);
  });
});

// ── 11 + 12. One readable date format everywhere ───────────────────────────

describe('pay period formatting', () => {
  it.each([
    ['2026-09-27', '2026-10-10', 'Sep 27 – Oct 10, 2026'],
    ['2026-08-02', '2026-08-15', 'Aug 2 – Aug 15, 2026'],
    ['2025-12-28', '2026-01-10', 'Dec 28, 2025 – Jan 10, 2026'],
    ['2026-12-20', '2027-01-02', 'Dec 20, 2026 – Jan 2, 2027'],
    ['2026-03-01', '2026-03-14', 'Mar 1 – Mar 14, 2026'], // spans a US DST change — calendar dates only
  ])('%s → %s reads "%s"', (from, to, expected) => {
    expect(formatPeriodRange(from, to)).toBe(expected);
  });

  it('never depends on the browser clock or zone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-06-30T23:59:59Z'));
    expect(formatPeriodRange('2025-12-28', '2026-01-10')).toBe('Dec 28, 2025 – Jan 10, 2026');
  });

  it.each([
    ['Pay Periods', () => mountPayPeriods()],
    ['Time Review', () => mountTimeReview()],
  ])('%s headings are readable for same-year and cross-year periods — never raw ISO dates', async (_tab, mount) => {
    await mount();
    expect(heading()).toHaveTextContent(/^Sep 13 – Sep 26, 2026/);

    const select = await openCustom();
    pick(select, '2025-12-28');
    await vi.waitFor(() => expect(heading()).toHaveTextContent(/^Dec 28, 2025 – Jan 10, 2026/));
    expect(heading()!.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

// ── 13. Out-of-order responses can never show the wrong period ─────────────

describe('rapid switching', () => {
  it('Pay Periods: a slower earlier response never overwrites the latest pick, and nothing stale shows meanwhile', async () => {
    await mountPayPeriods();
    const select = await openCustom();
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));

    server.hold = true;
    pick(select, '2026-08-16'); // A — will answer last
    pick(select, '2026-08-02'); // B — the latest selection
    await vi.waitFor(() => expect(server.pending).toHaveLength(2));

    // In flight: the period that WAS showing is not presented as the new one.
    expect(screen.queryByTestId('period-totals')).not.toBeInTheDocument();
    expect(heading()).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Full Pay Period/i })).toBeDisabled();

    await settle(() => server.pending[1].release()); // B lands
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('54:00'));
    await settle(() => server.pending[0].release()); // A lands late — ignored

    expect(periodCard('Total Paid')).toBe('54:00');
    expect(heading()).toHaveTextContent(/^Aug 2 – Aug 15, 2026/);
    expect(rowCells('Ada Clockwell')[1]).toBe('30:00');
    expect(select).toHaveValue('2026-08-02');

    // …and the export is the period on screen.
    server.hold = false;
    server.calls = [];
    fireEvent.click(screen.getByRole('button', { name: /Export Full Pay Period/i }));
    await vi.waitFor(() => expect(downloads).toHaveLength(1));
    expect(query(summaryCalls()[0]).get('from')).toBe('2026-08-02');
    expect(downloads[0].name).toBe('pay-period_2026-08-02_2026-08-15.csv');
  });

  it('Pay Periods: an earlier response that lands FIRST is not shown either', async () => {
    await mountPayPeriods();
    const select = await openCustom();
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));

    server.hold = true;
    pick(select, '2026-08-16');
    pick(select, '2026-08-02');
    await vi.waitFor(() => expect(server.pending).toHaveLength(2));

    await settle(() => server.pending[0].release()); // the superseded pick lands first
    expect(screen.queryByTestId('period-totals')).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await settle(() => server.pending[1].release());
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('54:00'));
  });

  it('Pay Periods: a late Previous response cannot replace Current after switching back', async () => {
    await mountPayPeriods();
    server.hold = true;
    fireEvent.click(screen.getByText('Previous Period')); // will answer last
    fireEvent.click(screen.getByText('Current Period'));
    await vi.waitFor(() => expect(server.pending).toHaveLength(2));

    await settle(() => server.pending[1].release());
    await settle(() => server.pending[0].release());

    expect(periodCard('Total Paid')).toBe('65:00');
    expect(heading()).toHaveTextContent(/^Sep 13 – Sep 26, 2026/);
  });

  it('Time Review: a slower earlier response never overwrites the latest pick', async () => {
    await mountTimeReview();
    const select = await openCustom();
    await vi.waitFor(() => expect(query(last(reviewCalls())).get('from')).toBe('2026-09-13'));
    await vi.waitFor(() => expect(reviewCard('Total Paid')).toBe('45:00'));

    server.hold = true;
    pick(select, '2026-08-16'); // will answer last
    pick(select, '2026-08-02'); // latest
    await vi.waitFor(() => expect(server.pending).toHaveLength(2));
    expect(reviewCard('Total Paid')).toBeUndefined(); // nothing stale while loading
    expect(heading()).not.toBeInTheDocument();

    await settle(() => server.pending[1].release());
    await vi.waitFor(() => expect(reviewCard('Total Paid')).toBe('34:00'));
    await settle(() => server.pending[0].release());

    expect(reviewCard('Total Paid')).toBe('34:00');
    expect(reviewCard('Regular')).toBe('30:00');
    expect(heading()).toHaveTextContent(/^Aug 2 – Aug 15, 2026/);
  });
});

// ── 14. Errors never substitute a different period ─────────────────────────

describe('errors never show another period in place of the selected one', () => {
  it('Pay Periods: a failed load shows the error — not the previous period’s totals — and Refresh recovers', async () => {
    await mountPayPeriods();
    const select = await openCustom();
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('65:00'));

    server.hold = true;
    pick(select, '2026-08-16');
    await vi.waitFor(() => expect(server.pending).toHaveLength(1));
    await settle(() => server.pending[0].fail());

    expect(screen.getByText('The server could not load this period.')).toBeInTheDocument();
    expect(screen.queryByTestId('period-totals')).not.toBeInTheDocument();
    expect(heading()).not.toBeInTheDocument();
    expect(screen.queryByText('Ada Clockwell')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Full Pay Period/i })).toBeDisabled();
    expect(select).toHaveValue('2026-08-16');

    server.hold = false;
    fireEvent.click(refreshButton());
    await vi.waitFor(() => expect(periodCard('Total Paid')).toBe('67:00'));
    expect(heading()).toHaveTextContent(/^Aug 16 – Aug 29, 2026/);
  });

  it('Time Review: a failed load shows the error — not the previous period’s cards', async () => {
    await mountTimeReview();
    server.hold = true;
    fireEvent.click(screen.getByText('Previous Period'));
    await vi.waitFor(() => expect(server.pending).toHaveLength(1));
    await settle(() => server.pending[0].fail());

    expect(screen.getByText('The server could not load this period.')).toBeInTheDocument();
    expect(reviewCard('Total Paid')).toBeUndefined();
    expect(heading()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
  });

  it('Custom without a period sends no request — the server can never fill in Current', async () => {
    server.periods = 'fail';
    await mountPayPeriods();
    server.calls = [];

    fireEvent.click(screen.getByText('Custom'));
    await screen.findByRole('alert');

    expect(summaryCalls()).toHaveLength(0);
    expect(screen.queryByTestId('period-totals')).not.toBeInTheDocument();
    expect(heading()).not.toBeInTheDocument();
    expect(screen.getByText('Select a pay period to view the summary.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Full Pay Period/i })).toBeDisabled();
  });
});

// ── 15 + 16. Tenant timezone stays server-owned; no browser-clock dates ────

describe('dates come from the backend payroll calendar', () => {
  it('ignores the browser clock: periods and Custom are the server’s, never a rolling window', async () => {
    // A browser "today" nowhere near the server's current period.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-03T12:00:00Z'));

    await mountPayPeriods();
    expect(await openCustom()).toHaveValue('2026-09-13');
    await vi.waitFor(() => expect(query(last(summaryCalls())).get('from')).toBe('2026-09-13'));
    cleanup();

    await mountTimeReview();
    expect(await openCustom()).toHaveValue('2026-09-13');

    // Neither tab ever sent a date derived from the browser clock.
    expect(server.calls.some((c) => c.includes('2031') || c.includes('2030'))).toBe(false);
  });

  it('the tenant timezone is the server’s, and no request carries a client zone or tenant', async () => {
    await mountPayPeriods();
    expect(heading()).toHaveTextContent('times in America/Chicago');
    cleanup();
    await mountTimeReview();

    for (const call of server.calls) {
      expect(call).not.toMatch(/timezone|tz=|tenant/i);
    }
  });
});
