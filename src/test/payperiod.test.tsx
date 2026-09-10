import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const server = vi.hoisted(() => ({ calls: [] as string[], token: 'tok' as string | null }));

const PERIOD = { from: '2026-09-01', to: '2026-09-14', timezone: 'America/Chicago', label: 'Sep 1 – Sep 14, 2026' };

// The accountant contract, in canonical server fields:
//   total_worked = regular + overtime            (PAID worked time)
//   total_paid   = total_worked + vacation + holiday + other paid leave
const ROWS = [
  {
    employee: { id: 1, full_name: 'Ada Clockwell' },
    // 45h worked: 40 regular + 5 overtime, no leave.
    regular_worked_seconds: 144000,
    regular_worked_hours: 40,
    overtime_worked_seconds: 18000,
    overtime_worked_hours: 5,
    vacation_seconds: 0,
    vacation_hours: 0,
    holiday_seconds: 0,
    holiday_hours: 0,
    other_paid_leave_seconds: 0,
    other_paid_leave_hours: 0,
    total_worked_seconds: 162000,
    total_worked_hours: 45,
    total_paid_seconds: 162000,
    total_paid_hours: 45,
    // Operational fields still travel on the row; they are NOT accountant columns.
    paid_seconds: 162000,
    paid_hours: 45,
    unpaid_seconds: 1800,
    unpaid_hours: 0.5,
    gross_seconds: 163800,
    gross_hours: 45.5,
    lunch_seconds: 1800,
    other_break_seconds: 0,
    shift_count: 5,
    open_shift_count: 0,
    has_open_shift: false,
    correction_count: 1,
    system_event_count: 2,
    auto_clock_out_count: 1,
    mandatory_lunch_count: 1,
    pending_shift_count: 1,
    has_pending_shift: true,
    flags: ['pending'],
  },
  {
    employee: { id: 2, full_name: 'Bo Vance' },
    // 38h worked + 8h vacation.
    regular_worked_seconds: 136800,
    regular_worked_hours: 38,
    overtime_worked_seconds: 0,
    overtime_worked_hours: 0,
    vacation_seconds: 28800,
    vacation_hours: 8,
    holiday_seconds: 0,
    holiday_hours: 0,
    other_paid_leave_seconds: 0,
    other_paid_leave_hours: 0,
    total_worked_seconds: 136800,
    total_worked_hours: 38,
    total_paid_seconds: 165600,
    total_paid_hours: 46,
    paid_seconds: 136800,
    paid_hours: 38,
    unpaid_seconds: 0,
    unpaid_hours: 0,
    gross_seconds: 136800,
    gross_hours: 38,
    lunch_seconds: 0,
    other_break_seconds: 0,
    shift_count: 4,
    open_shift_count: 0,
    has_open_shift: false,
    correction_count: 0,
    system_event_count: 0,
    auto_clock_out_count: 0,
    mandatory_lunch_count: 0,
    flags: [],
  },
  {
    employee: { id: 3, full_name: 'Cy Open' },
    // 32h worked + 8h holiday + 4h other paid leave.
    regular_worked_seconds: 115200,
    regular_worked_hours: 32,
    overtime_worked_seconds: 0,
    overtime_worked_hours: 0,
    vacation_seconds: 0,
    vacation_hours: 0,
    holiday_seconds: 28800,
    holiday_hours: 8,
    other_paid_leave_seconds: 14400,
    other_paid_leave_hours: 4,
    total_worked_seconds: 115200,
    total_worked_hours: 32,
    total_paid_seconds: 158400,
    total_paid_hours: 44,
    paid_seconds: 115200,
    paid_hours: 32,
    unpaid_seconds: 0,
    unpaid_hours: 0,
    gross_seconds: 115200,
    gross_hours: 32,
    lunch_seconds: 0,
    other_break_seconds: 0,
    shift_count: 4,
    open_shift_count: 1,
    has_open_shift: true,
    correction_count: 0,
    system_event_count: 0,
    auto_clock_out_count: 0,
    mandatory_lunch_count: 0,
    flags: [],
  },
];

const TOTALS = {
  employees: 3,
  employees_with_activity: 3,
  regular_worked_seconds: 396000,
  regular_worked_hours: 110,
  overtime_worked_seconds: 18000,
  overtime_worked_hours: 5,
  vacation_seconds: 28800,
  vacation_hours: 8,
  holiday_seconds: 28800,
  holiday_hours: 8,
  other_paid_leave_seconds: 14400,
  other_paid_leave_hours: 4,
  total_worked_seconds: 414000,
  total_worked_hours: 115,
  total_paid_seconds: 486000,
  total_paid_hours: 135,
  paid_seconds: 414000,
  paid_hours: 115,
  unpaid_seconds: 1800,
  unpaid_hours: 0.5,
  gross_seconds: 415800,
  gross_hours: 115.5,
  shift_count: 13,
  lunch_seconds: 1800,
  other_break_seconds: 0,
  open_shift_count: 1,
  pending_shift_count: 1,
  correction_count: 1,
  system_event_count: 2,
};

// Exceptions Only genuinely narrows the SERVER response to Pending rows — the
// condition the accountant export must never inherit.
const PENDING_ONLY = [ROWS[0]];

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
    getToken: () => server.token,
    setToken: (t: string | null) => {
      server.token = t;
    },
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path.startsWith('/admin/pay-periods/summary')) {
        const filtered = path.includes('flagged=1');
        return { success: true, period: PERIOD, totals: TOTALS, data: filtered ? PENDING_ONLY : ROWS };
      }
      if (path.includes('/time-review')) {
        return {
          success: true,
          employee: { id: 1, full_name: 'Ada Clockwell' },
          period: PERIOD,
          totals: {
            paid_seconds: 162000,
            paid_hours: 45,
            unpaid_seconds: 0,
            unpaid_hours: 0,
            gross_seconds: 162000,
            gross_hours: 45,
            lunch_seconds: 0,
            other_break_seconds: 0,
            shift_count: 5,
            open_shift_count: 0,
            has_open_shift: false,
            regular_worked_seconds: 144000,
            regular_worked_hours: 40,
            overtime_worked_seconds: 18000,
            overtime_worked_hours: 5,
            total_worked_seconds: 162000,
            total_worked_hours: 45,
            vacation_seconds: 0,
            vacation_hours: 0,
            holiday_seconds: 0,
            holiday_hours: 0,
            other_paid_leave_seconds: 0,
            other_paid_leave_hours: 0,
            total_paid_seconds: 162000,
            total_paid_hours: 45,
          },
          days: [],
        };
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

import { fetchPayPeriodSummary, payPeriodToCsv, type PayPeriodSummary } from '../lib/admin';
import PayPeriodSummaryGrid, { type PayPeriodView } from '../components/admin/PayPeriodSummary';
import AdminDashboard from '../pages/AdminDashboard';

const SUMMARY: PayPeriodSummary = { period: PERIOD, totals: TOTALS, data: ROWS } as PayPeriodSummary;

// Captured downloads: the serialized CSV + the anchor's download filename.
const downloads: { name: string; text: string }[] = [];

// jsdom's Blob does not expose text() here, so keep the parts on the instance.
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
  server.token = 'tok';
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

const csvOf = (index = 0) => downloads[index].text.split('\n');

const summaryCalls = () => server.calls.filter((c) => c.startsWith('GET /admin/pay-periods/summary'));

// ── API params ─────────────────────────────────────────────────────────────

describe('pay-period API params', () => {
  it('requests a canonical period selector when no explicit dates', async () => {
    await fetchPayPeriodSummary({ period: 'current' });
    expect(server.calls.some((c) => c.includes('/admin/pay-periods/summary?period=current'))).toBe(true);
  });

  it('sends explicit from/to (not period) for a custom range', async () => {
    await fetchPayPeriodSummary({ from: '2026-09-01', to: '2026-09-14', period: 'current' });
    const call = summaryCalls()[0];
    expect(call).toContain('from=2026-09-01');
    expect(call).toContain('to=2026-09-14');
    expect(call).not.toContain('period=');
  });

  it('sends sort=paid_desc when sorting by pay', async () => {
    await fetchPayPeriodSummary({ period: 'current', sort: 'paid_desc' });
    expect(server.calls.some((c) => c.includes('sort=paid_desc'))).toBe(true);
  });
});

// ── CSV — the V1 accountant format ─────────────────────────────────────────

describe('payPeriodToCsv() — accountant V1', () => {
  it('uses the exact accountant column names, in order', () => {
    const header = payPeriodToCsv(SUMMARY).split('\n')[0].split(',');
    expect(header).toEqual([
      'Employee',
      'Pay Period Start',
      'Pay Period End',
      'Regular Hours',
      'Overtime Hours',
      'Vacation Hours',
      'Holiday Hours',
      'Other Paid Leave Hours',
      'Total Worked Hours',
      'Total Paid Hours',
      'Pending',
    ]);
  });

  it('emits one row per employee with decimal hours to two places', async () => {
    const lines = payPeriodToCsv(SUMMARY).split('\n');
    expect(lines).toHaveLength(4); // header + 3 employees

    expect(lines[1].split(',')).toEqual([
      'Ada Clockwell', '2026-09-01', '2026-09-14',
      '40.00', '5.00', '0.00', '0.00', '0.00', '45.00', '45.00', 'Yes',
    ]);
    expect(lines[2].split(',')).toEqual([
      'Bo Vance', '2026-09-01', '2026-09-14',
      '38.00', '0.00', '8.00', '0.00', '0.00', '38.00', '46.00', 'No',
    ]);
    expect(lines[3].split(',')).toEqual([
      'Cy Open', '2026-09-01', '2026-09-14',
      '32.00', '0.00', '0.00', '8.00', '4.00', '32.00', '44.00', 'No',
    ]);
  });

  it('carries the SAME pay-period dates on every employee row', () => {
    const rows = payPeriodToCsv(SUMMARY).split('\n').slice(1);
    rows.forEach((line) => {
      const cells = line.split(',');
      expect(cells[1]).toBe(PERIOD.from);
      expect(cells[2]).toBe(PERIOD.to);
    });
  });

  it('takes Regular/Overtime/leave/totals straight from the summary fields', () => {
    // Change ONLY the server-owned classification: the CSV must follow it, which
    // it cannot do if the client re-derives payroll from worked/lunch time.
    const reclassified: PayPeriodSummary = {
      ...SUMMARY,
      data: [{ ...ROWS[0], regular_worked_hours: 30, overtime_worked_hours: 15 }],
    } as PayPeriodSummary;
    const cells = payPeriodToCsv(reclassified).split('\n')[1].split(',');
    expect(cells[3]).toBe('30.00');
    expect(cells[4]).toBe('15.00');
  });

  it('is HOURS ONLY — no pay rates, wages, breaks or audit columns', () => {
    const csv = payPeriodToCsv(SUMMARY);
    // Nothing monetary or operational anywhere in the file…
    ['Rate', 'Wage', 'Gross Pay', 'Tax', 'Deduction', 'Lunch', 'Break', 'Unpaid', 'Correction'].forEach((banned) =>
      expect(csv).not.toContain(banned),
    );
    // …and none of the retired operational columns survive as a header cell.
    const header = csv.split('\n')[0].split(',');
    ['Paid Hours', 'Unpaid Hours', 'Worked (h)', 'Lunch (h)', 'Other (h)', 'Shifts', 'Flags', 'Open shifts',
      'Corrections', 'System events'].forEach((old) => expect(header).not.toContain(old));
  });
});

// ── Summary grid — the accountant columns ──────────────────────────────────

describe('PayPeriodSummaryGrid — accountant columns', () => {
  const renderGrid = (props: Partial<React.ComponentProps<typeof PayPeriodSummaryGrid>> = {}) =>
    render(<PayPeriodSummaryGrid onDrillDown={() => {}} {...props} />);

  it('renders the accountant header row', async () => {
    renderGrid();
    const header = (await screen.findAllByRole('rowgroup'))[0];
    ['Employee', 'Regular', 'Overtime', 'Vacation', 'Holiday', 'Other Paid Leave', 'Total Worked', 'Total Paid'].forEach(
      (label) => expect(within(header).getByText(label)).toBeInTheDocument(),
    );
  });

  // Column order: Employee, Regular, Overtime, Vacation, Holiday, Other Paid
  // Leave, Total Worked, Total Paid, Status, (chevron).
  const cells = (name: string) =>
    Array.from(screen.getByText(name).closest('tr')!.querySelectorAll('td')).map((td) => td.textContent?.trim());

  it('renders each accountant value for an employee row', async () => {
    renderGrid();
    await screen.findByText('Bo Vance');
    // 38h regular + 8h vacation → 38:00 worked, 46:00 paid.
    expect(cells('Bo Vance').slice(0, 8)).toEqual([
      'Bo Vance', '38:00', '—', '8:00', '—', '—', '38:00', '46:00',
    ]);
  });

  it('renders Overtime, Holiday and Other Paid Leave from their own fields', async () => {
    renderGrid();
    await screen.findByText('Ada Clockwell');
    // 40h regular + 5h overtime, no leave → Total Worked == Total Paid == 45:00.
    expect(cells('Ada Clockwell').slice(0, 8)).toEqual([
      'Ada Clockwell', '40:00', '5:00', '—', '—', '—', '45:00', '45:00',
    ]);
    // 32h regular + 8h holiday + 4h other paid leave → 32:00 worked, 44:00 paid.
    // (Cy has an open shift, so Total Worked carries the "not final" marker.)
    expect(cells('Cy Open').slice(0, 8)).toEqual([
      'Cy Open', '32:00', '—', '—', '8:00', '4:00', '32:00*', '44:00',
    ]);
  });

  it('drops the old operational accountant columns', async () => {
    renderGrid();
    await screen.findByText('Ada Clockwell');
    const header = screen.getAllByRole('rowgroup')[0];
    ['Paid Hours', 'Unpaid Hours', 'Lunch', 'Other', 'Shifts', 'Worked'].forEach((old) =>
      expect(within(header).queryByText(old)).not.toBeInTheDocument(),
    );
    // …and the old "Paid = Worked − (Lunch + Other)" operational formula is gone.
    expect(screen.queryByText(/= Worked Hours −/)).not.toBeInTheDocument();
  });

  it('keeps the canonical Pending badge and no retired legacy flags', async () => {
    renderGrid();
    expect(await screen.findByText('Pending')).toBeInTheDocument();
    expect(screen.getAllByText('Pending')).toHaveLength(1);
    ['Open shift', 'Auto clock-out', 'Auto lunch', 'No activity', 'Corrected'].forEach((legacy) =>
      expect(screen.queryByText(legacy)).not.toBeInTheDocument(),
    );
  });

  it('shows accountant total cards for the period', async () => {
    renderGrid();
    await screen.findByText('Ada Clockwell');
    const cards = screen.getByTestId('period-totals');
    ['Total Paid', 'Regular', 'Overtime', 'Vacation', 'Holiday', 'Other Paid Leave'].forEach((label) =>
      expect(within(cards).getByText(label)).toBeInTheDocument(),
    );
    expect(within(cards).getByText('135:00')).toBeInTheDocument(); // Total Paid
    expect(within(cards).getByText('110:00')).toBeInTheDocument(); // Regular
    // Operational counts are not accountant headline cards.
    ['Corrections', 'System Events', 'Shifts'].forEach((op) =>
      expect(within(cards).queryByText(op)).not.toBeInTheDocument(),
    );
  });

  it('reports how many employees still have Pending items', async () => {
    renderGrid();
    expect(await screen.findByText(/1 employee has Pending items/i)).toBeInTheDocument();
  });
});

// ── Drill-down — the EXACT resolved period ─────────────────────────────────

describe('PayPeriodSummaryGrid — drill-down', () => {
  it('passes the employee id and the EXACT resolved period on row click', async () => {
    const onDrillDown = vi.fn();
    render(<PayPeriodSummaryGrid onDrillDown={onDrillDown} />);
    fireEvent.click(await screen.findByText('Ada Clockwell'));
    expect(onDrillDown).toHaveBeenCalledWith(1, '2026-09-01', '2026-09-14');
  });

  it('uses the resolved dates for a PREVIOUS period, never a recomputed one', async () => {
    const onDrillDown = vi.fn();
    render(
      <PayPeriodSummaryGrid
        onDrillDown={onDrillDown}
        view={{ mode: 'previous', from: '1999-01-01', to: '1999-01-14', sort: 'name', flagged: false }}
      />,
    );
    await screen.findByText('Ada Clockwell');
    expect(summaryCalls()[0]).toContain('period=previous');
    fireEvent.click(screen.getByText('Ada Clockwell'));
    // The server's resolved period wins over the component's local date inputs.
    expect(onDrillDown).toHaveBeenCalledWith(1, '2026-09-01', '2026-09-14');
  });

  it('uses the resolved dates for a CUSTOM period', async () => {
    const onDrillDown = vi.fn();
    render(
      <PayPeriodSummaryGrid
        onDrillDown={onDrillDown}
        view={{ mode: 'custom', from: '2026-09-01', to: '2026-09-14', sort: 'name', flagged: false }}
      />,
    );
    await screen.findByText('Ada Clockwell');
    expect(summaryCalls()[0]).toContain('from=2026-09-01');
    fireEvent.click(screen.getByText('Ada Clockwell'));
    expect(onDrillDown).toHaveBeenCalledWith(1, '2026-09-01', '2026-09-14');
  });
});

// ── Return-to-summary state ────────────────────────────────────────────────

describe('PayPeriodSummaryGrid — controlled view state', () => {
  it('drives the request from the supplied view', async () => {
    render(
      <PayPeriodSummaryGrid
        onDrillDown={() => {}}
        view={{ mode: 'custom', from: '2026-08-23', to: '2026-09-05', sort: 'paid_desc', flagged: true }}
      />,
    );
    await screen.findByText('Ada Clockwell');
    const call = summaryCalls()[0];
    expect(call).toContain('from=2026-08-23');
    expect(call).toContain('to=2026-09-05');
    expect(call).toContain('sort=paid_desc');
    expect(call).toContain('flagged=1');
  });

  it('publishes every view change so the parent can restore it', async () => {
    const onViewChange = vi.fn();
    const view: PayPeriodView = { mode: 'current', from: '2026-09-01', to: '2026-09-14', sort: 'name', flagged: false };
    render(<PayPeriodSummaryGrid onDrillDown={() => {}} view={view} onViewChange={onViewChange} />);
    await screen.findByText('Ada Clockwell');

    fireEvent.click(screen.getByLabelText('Exceptions only'));
    expect(onViewChange).toHaveBeenCalledWith(expect.objectContaining({ flagged: true }));

    fireEvent.click(screen.getByText('Previous Period'));
    expect(onViewChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'previous' }));
  });
});

describe('AdminDashboard — drill-down and return', () => {
  const renderDashboard = () =>
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

  it('preserves the selected period and filters when returning from Time Review', async () => {
    renderDashboard();
    await screen.findByText('Ada Clockwell');

    // Select Previous Period + Exceptions only, then drill into an employee.
    fireEvent.click(screen.getByText('Previous Period'));
    fireEvent.click(await screen.findByLabelText('Exceptions only'));
    await vi.waitFor(() => expect(summaryCalls().some((c) => c.includes('flagged=1'))).toBe(true));

    fireEvent.click(await screen.findByText('Ada Clockwell'));
    await screen.findByText(/Back to Pay Period Summary/i);

    server.calls = [];
    fireEvent.click(screen.getByText(/Back to Pay Period Summary/i));

    // Back on the summary: same mode + same filter, and refetched so corrections
    // made inside Time Review are reflected immediately.
    await vi.waitFor(() => expect(summaryCalls()).toHaveLength(1));
    expect(summaryCalls()[0]).toContain('period=previous');
    expect(summaryCalls()[0]).toContain('flagged=1');
    expect((await screen.findByLabelText('Exceptions only')) as HTMLInputElement).toBeChecked();
  });
});

// ── Exceptions-only export safety ──────────────────────────────────────────

describe('Exceptions-only never narrows the accountant export', () => {
  it('shows only Pending employees on screen but exports the FULL pay period', async () => {
    render(<PayPeriodSummaryGrid onDrillDown={() => {}} />);
    await screen.findByText('Ada Clockwell');

    fireEvent.click(screen.getByLabelText('Exceptions only'));
    await vi.waitFor(() => expect(screen.queryByText('Bo Vance')).not.toBeInTheDocument());
    expect(screen.getByText('Ada Clockwell')).toBeInTheDocument();

    server.calls = [];
    fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    await vi.waitFor(() => expect(downloads).toHaveLength(1));

    // The export re-read the authoritative UNFILTERED period…
    expect(summaryCalls()).toHaveLength(1);
    expect(summaryCalls()[0]).not.toContain('flagged=1');
    // …so every employee is in the accountant file.
    const lines = csvOf();
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('Bo Vance');
    expect(lines[3]).toContain('Cy Open');
  });

  it('names the file pay-period_<from>_<to>.csv', async () => {
    render(<PayPeriodSummaryGrid onDrillDown={() => {}} />);
    await screen.findByText('Ada Clockwell');
    fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    await vi.waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('pay-period_2026-09-01_2026-09-14.csv');
  });
});
