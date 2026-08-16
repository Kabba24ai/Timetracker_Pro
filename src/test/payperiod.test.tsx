import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const server = vi.hoisted(() => ({ calls: [] as string[], token: 'tok' as string | null }));

const PERIOD = { from: '2026-09-01', to: '2026-09-14', timezone: 'America/Chicago', label: 'Sep 1 – Sep 14, 2026' };
const TOTALS = {
  employees: 3,
  employees_with_activity: 2,
  paid_seconds: 27000,
  paid_hours: 7.5,
  unpaid_seconds: 1800,
  unpaid_hours: 0.5,
  gross_seconds: 28800,
  gross_hours: 8.0,
  shift_count: 2,
  lunch_seconds: 1800,
  other_break_seconds: 0,
  open_shift_count: 1,
  correction_count: 1,
  system_event_count: 2,
};
const ROWS = [
  {
    employee: { id: 1, full_name: 'Ada Clockwell' },
    paid_seconds: 27000,
    paid_hours: 7.5,
    unpaid_seconds: 1800,
    unpaid_hours: 0.5,
    gross_seconds: 28800,
    gross_hours: 8.0,
    lunch_seconds: 1800,
    other_break_seconds: 0,
    shift_count: 1,
    open_shift_count: 0,
    has_open_shift: false,
    correction_count: 1,
    system_event_count: 2,
    auto_clock_out_count: 1,
    mandatory_lunch_count: 1,
    flags: ['has_corrections', 'auto_clock_out'],
  },
  {
    employee: { id: 2, full_name: 'Bo Vance' },
    paid_seconds: 0,
    paid_hours: 0,
    unpaid_seconds: 0,
    unpaid_hours: 0,
    gross_seconds: 0,
    gross_hours: 0,
    lunch_seconds: 0,
    other_break_seconds: 0,
    shift_count: 0,
    open_shift_count: 0,
    has_open_shift: false,
    correction_count: 0,
    system_event_count: 0,
    auto_clock_out_count: 0,
    mandatory_lunch_count: 0,
    flags: ['no_activity'],
  },
  {
    employee: { id: 3, full_name: 'Cy Open' },
    paid_seconds: 0,
    paid_hours: 0,
    unpaid_seconds: 0,
    unpaid_hours: 0,
    gross_seconds: 0,
    gross_hours: 0,
    lunch_seconds: 0,
    other_break_seconds: 0,
    shift_count: 1,
    open_shift_count: 1,
    has_open_shift: true,
    correction_count: 0,
    system_event_count: 0,
    auto_clock_out_count: 0,
    mandatory_lunch_count: 0,
    flags: ['open_shift'],
  },
];

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
        return { success: true, period: PERIOD, totals: TOTALS, data: ROWS };
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

import { fetchPayPeriodSummary, payPeriodToCsv, type PayPeriodSummary } from '../lib/admin';
import PayPeriodSummaryGrid from '../components/admin/PayPeriodSummary';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
});

describe('pay-period API params', () => {
  it('requests a canonical period selector when no explicit dates', async () => {
    await fetchPayPeriodSummary({ period: 'current' });
    expect(server.calls.some((c) => c.includes('/admin/pay-periods/summary?period=current'))).toBe(true);
  });

  it('sends explicit from/to (not period) for a custom range', async () => {
    await fetchPayPeriodSummary({ from: '2026-09-01', to: '2026-09-14', period: 'current' });
    const call = server.calls.find((c) => c.startsWith('GET /admin/pay-periods/summary'))!;
    expect(call).toContain('from=2026-09-01');
    expect(call).toContain('to=2026-09-14');
    expect(call).not.toContain('period=');
  });

  it('sends sort=paid_desc when sorting by pay', async () => {
    await fetchPayPeriodSummary({ period: 'current', sort: 'paid_desc' });
    expect(server.calls.some((c) => c.includes('sort=paid_desc'))).toBe(true);
  });
});

describe('payPeriodToCsv()', () => {
  it('orders columns payroll-first: Paid, Unpaid, Worked', () => {
    const summary: PayPeriodSummary = { period: PERIOD, totals: TOTALS, data: ROWS };
    const lines = payPeriodToCsv(summary).split('\n');
    const header = lines[0].split(',');

    expect(lines).toHaveLength(4); // header + 3 rows
    // Deliberate payroll ordering.
    expect(header.slice(0, 8)).toEqual([
      'Employee',
      'Paid Hours',
      'Unpaid Hours',
      'Worked (h)',
      'Lunch (h)',
      'Other (h)',
      'Shifts',
      'Flags',
    ]);
    expect(header.indexOf('Paid Hours')).toBeLessThan(header.indexOf('Unpaid Hours'));
    expect(header.indexOf('Unpaid Hours')).toBeLessThan(header.indexOf('Worked (h)'));
  });

  it('emits authoritative Paid/Unpaid/Worked values per row', () => {
    const summary: PayPeriodSummary = { period: PERIOD, totals: TOTALS, data: ROWS };
    const rows = payPeriodToCsv(summary).split('\n');
    const ada = rows[1].split(',');
    expect(ada[0]).toBe('Ada Clockwell');
    expect(ada[1]).toBe('7.50'); // Paid
    expect(ada[2]).toBe('0.50'); // Unpaid
    expect(ada[3]).toBe('8.00'); // Worked (gross)
    expect(rows[1]).toContain('Corrected; Auto clock-out');
    expect(rows[3]).toContain('Open shift');
  });
});

describe('PayPeriodSummaryGrid', () => {
  it('loads the summary and renders Paid/Unpaid/Worked + rows', async () => {
    render(<PayPeriodSummaryGrid onDrillDown={() => {}} />);

    expect(await screen.findByText('Ada Clockwell')).toBeInTheDocument();
    expect(screen.getByText('Bo Vance')).toBeInTheDocument();
    // Payroll columns are present (label appears in card + header + formula).
    expect(screen.getAllByText('Paid Hours').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unpaid Hours').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Worked').length).toBeGreaterThan(0);
    // Paid duration (7:30) appears in totals + Ada's row.
    expect((await screen.findAllByText('7:30')).length).toBeGreaterThan(0);
    // Unpaid duration (0:30) appears.
    expect(screen.getAllByText('0:30').length).toBeGreaterThan(0);
    // Formula is shown.
    expect(screen.getByText(/= Worked Hours −/)).toBeInTheDocument();
    // Open-shift row carries the "not final" marker.
    expect(screen.getByTitle(/open shift/i)).toBeInTheDocument();
  });

  it('drills down into an employee for the same period on row click', async () => {
    const onDrillDown = vi.fn();
    render(<PayPeriodSummaryGrid onDrillDown={onDrillDown} />);

    fireEvent.click(await screen.findByText('Ada Clockwell'));

    expect(onDrillDown).toHaveBeenCalledWith(1, '2026-09-01', '2026-09-14');
  });
});
