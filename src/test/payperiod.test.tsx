import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const server = vi.hoisted(() => ({ calls: [] as string[], token: 'tok' as string | null }));

const PERIOD = { from: '2026-09-01', to: '2026-09-14', timezone: 'America/Chicago', label: 'Sep 1 – Sep 14, 2026' };
const TOTALS = {
  employees: 2,
  employees_with_activity: 1,
  worked_seconds: 27000,
  worked_hours: 7.5,
  shift_count: 1,
  lunch_seconds: 1800,
  other_break_seconds: 0,
  open_shift_count: 0,
  correction_count: 1,
  system_event_count: 2,
};
const ROWS = [
  {
    employee: { id: 1, full_name: 'Ada Clockwell' },
    worked_seconds: 27000,
    worked_hours: 7.5,
    shift_count: 1,
    open_shift_count: 0,
    has_open_shift: false,
    lunch_seconds: 1800,
    other_break_seconds: 0,
    correction_count: 1,
    system_event_count: 2,
    auto_clock_out_count: 1,
    mandatory_lunch_count: 1,
    flags: ['has_corrections', 'auto_clock_out'],
  },
  {
    employee: { id: 2, full_name: 'Bo Vance' },
    worked_seconds: 0,
    worked_hours: 0,
    shift_count: 0,
    open_shift_count: 0,
    has_open_shift: false,
    lunch_seconds: 0,
    other_break_seconds: 0,
    correction_count: 0,
    system_event_count: 0,
    auto_clock_out_count: 0,
    mandatory_lunch_count: 0,
    flags: ['no_activity'],
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
});

describe('payPeriodToCsv()', () => {
  it('emits a header + one row per employee with readable flags', () => {
    const summary: PayPeriodSummary = { period: PERIOD, totals: TOTALS, data: ROWS };
    const lines = payPeriodToCsv(summary).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Worked (h)');
    expect(lines[1]).toContain('Ada Clockwell');
    expect(lines[1]).toContain('7.50');
    expect(lines[1]).toContain('Corrected; Auto clock-out');
    expect(lines[2]).toContain('No activity');
  });
});

describe('PayPeriodSummaryGrid', () => {
  it('loads the summary and renders totals + rows', async () => {
    render(<PayPeriodSummaryGrid onDrillDown={() => {}} />);

    expect(await screen.findByText('Ada Clockwell')).toBeInTheDocument();
    expect(screen.getByText('Bo Vance')).toBeInTheDocument();
    // Worked duration appears in totals and Ada's row.
    expect((await screen.findAllByText('7:30')).length).toBeGreaterThan(0);
    // Flags rendered with friendly labels.
    expect(screen.getByText('Auto clock-out')).toBeInTheDocument();
    expect(screen.getByText('No activity')).toBeInTheDocument();
  });

  it('drills down into an employee for the same period on row click', async () => {
    const onDrillDown = vi.fn();
    render(<PayPeriodSummaryGrid onDrillDown={onDrillDown} />);

    fireEvent.click(await screen.findByText('Ada Clockwell'));

    expect(onDrillDown).toHaveBeenCalledWith(1, '2026-09-01', '2026-09-14');
  });
});
