import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const server = vi.hoisted(() => ({ calls: [] as string[], token: 'tok' as string | null }));

const TYPES = {
  success: true,
  data: [
    { code: 'vacation', label: 'Vacation', is_paid: true, is_balance_tracked: true, balance_bucket: 'vacation' },
    { code: 'unpaid', label: 'Unpaid', is_paid: false, is_balance_tracked: false, balance_bucket: null },
  ],
};

const BALANCE = {
  success: true,
  data: [{ bucket: 'vacation', type_code: 'vacation', type_label: 'Vacation', available: 32, reserved: 8, used: 0, credited: 40 }],
};

const MY_REQUESTS = {
  success: true,
  data: [
    {
      id: 1, employee_id: 1, employee_name: 'Ada', type: { code: 'vacation', label: 'Vacation' }, status: 'pending',
      start_date: '2099-09-14', end_date: '2099-09-14', requested_hours: 8, approved_hours: null,
      is_paid: true, is_balance_tracked: true, balance_bucket: 'vacation', notes: null, source: 'employee',
      decided_at: null, decision_reason: null, cancelled_at: null, cancellation_reason: null,
      days: [{ date: '2099-09-14', scheduled_hours: 8, requested_hours: 8, approved_hours: null }], created_at: null,
    },
  ],
};

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
    getToken: () => server.token,
    setToken: (t: string | null) => {
      server.token = t;
    },
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path === '/time-off/types') return TYPES;
      if (path === '/time-off/balance') return BALANCE;
      if (path === '/time-off/requests') return MY_REQUESTS;
      if (path.startsWith('/admin/time-off/requests')) return MY_REQUESTS;
      if (path.startsWith('/admin/time-off/balances')) return { success: true, data: [] };
      if (path.startsWith('/admin/time-off/overlap-exceptions')) return { success: true, data: [] };
      return { success: true, data: [] };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      return { success: true, data: {} };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { adminApprove, fetchMyBalance, submitTimeOffRequest } from '../lib/timeOff';
import VacationSummary from '../components/VacationSummary';
import VacationManagement from '../components/admin/VacationManagement';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
});

describe('time-off API layer', () => {
  it('reads balances from the real endpoint', async () => {
    const b = await fetchMyBalance();
    expect(b[0].available).toBe(32);
    expect(server.calls).toContain('GET /time-off/balance');
  });

  it('submits a partial-day request with a days map', async () => {
    await submitTimeOffRequest({ type_code: 'vacation', start_date: '2099-09-14', end_date: '2099-09-14', days: { '2099-09-14': 4 } });
    expect(server.calls).toContain('POST /time-off/requests');
  });

  it('approves via the admin endpoint', async () => {
    await adminApprove(5);
    expect(server.calls).toContain('POST /admin/time-off/requests/5/approve');
  });
});

describe('employee VacationSummary', () => {
  it('shows the balance and my requests', async () => {
    render(<VacationSummary />);
    expect(await screen.findByText('32h')).toBeInTheDocument();
    expect(screen.getByText(/8h reserved/)).toBeInTheDocument();
    // pending request row + status chip.
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0);
  });
});

describe('admin VacationManagement', () => {
  it('lists pending requests with approve/deny', async () => {
    render(<VacationManagement />);
    expect(await screen.findByRole('button', { name: /approve/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await vi.waitFor(() => expect(server.calls.some((c) => c.includes('/approve'))).toBe(true));
  });
});
