import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const server = vi.hoisted(() => ({
  calls: [] as string[],
  token: 'tok' as string | null,
  emptyRequests: false,
}));

const VACATION_STATUS = {
  success: true,
  data: {
    available: 24.5,
    accrual_enabled: true,
    annual_entitlement_hours: 80,
    using_override: false,
    effective_rate: 0.038462,
    eligibility_date: '2026-04-01',
    is_eligible: true,
    accrual_year: 2027,
    accrued_this_year: 24.5,
    annual_remaining_capacity: 55.5,
  },
};

const MY_REQUESTS = {
  success: true,
  data: [
    {
      id: 1, employee_id: 1, employee_name: 'Ada', type: { code: 'vacation', label: 'Vacation' }, status: 'pending',
      start_date: '2099-09-14', end_date: '2099-09-18', requested_hours: 8, approved_hours: null,
      is_paid: true, is_balance_tracked: true, balance_bucket: 'vacation', notes: null, source: 'employee',
      decided_at: null, decision_reason: null, cancelled_at: null, cancellation_reason: null,
      days: [], created_at: null,
    },
  ],
};

const ACCRUAL = {
  success: true,
  company_default_hours: 80,
  accrual_enabled: true,
  data: [
    { employee: { id: 1, name: 'Ada Clockwell' }, available: 24.5, annual_entitlement_hours: 80, using_override: false, override_hours: null, effective_rate: 0.038462, eligibility_date: '2026-04-01', is_eligible: true, accrued_this_year: 24.5, annual_remaining_capacity: 55.5 },
    { employee: { id: 2, name: 'Bo Vance' }, available: 4.61, annual_entitlement_hours: 120, using_override: true, override_hours: 120, effective_rate: 0.057692, eligibility_date: '2026-05-01', is_eligible: true, accrued_this_year: 4.61, annual_remaining_capacity: 115.39 },
  ],
  recent_accruals: [],
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
    setToken: (t: string | null) => { server.token = t; },
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path === '/time-off/vacation-status') return VACATION_STATUS;
      if (path === '/time-off/requests') return server.emptyRequests ? { success: true, data: [] } : MY_REQUESTS;
      if (path.startsWith('/admin/vacation/accrual')) return ACCRUAL;
      if (path.startsWith('/admin/time-off/requests')) return MY_REQUESTS;
      if (path.startsWith('/admin/time-off/balances')) return { success: true, data: [] };
      if (path.startsWith('/admin/time-off/overlap-exceptions')) return { success: true, data: [] };
      return { success: true, data: [] };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      return { success: true, data: {}, records_written: 1 };
    },
    put: async (path: string) => {
      server.calls.push(`PUT ${path}`);
      return { success: true, data: {} };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { adminApprove, fetchMyVacationStatus, submitTimeOffRequest } from '../lib/timeOff';
import VacationSummary from '../components/VacationSummary';
import VacationManagement from '../components/admin/VacationManagement';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
  server.emptyRequests = false;
});

describe('time-off API layer', () => {
  it('reads the vacation status from the canonical endpoint', async () => {
    const s = await fetchMyVacationStatus();
    expect(s.available).toBe(24.5);
    expect(server.calls).toContain('GET /time-off/vacation-status');
  });

  it('submits a request', async () => {
    await submitTimeOffRequest({ type_code: 'unpaid', start_date: '2099-09-14', end_date: '2099-09-14' });
    expect(server.calls).toContain('POST /time-off/requests');
  });

  it('approves via the admin endpoint', async () => {
    await adminApprove(5);
    expect(server.calls).toContain('POST /admin/time-off/requests/5/approve');
  });
});

describe('employee Vacation screen', () => {
  it('shows the accrued balance from the API, not empty-state noise', async () => {
    render(<VacationSummary />);
    expect(await screen.findByText('24.50')).toBeInTheDocument();
    expect(screen.getByText('Vacation')).toBeInTheDocument();
    // The old empty-state copy is gone.
    expect(screen.queryByText(/No balance-tracked time off/i)).toBeNull();
    expect(screen.queryByText('My Requests')).toBeNull();
    expect(screen.queryByText('No requests yet.')).toBeNull();
  });

  it('offers exactly Vacation and Unpaid Time Off, using a calendar Date Picker', async () => {
    render(<VacationSummary />);
    fireEvent.click(await screen.findByRole('button', { name: /Request Time Off/ }));

    const type = await screen.findByLabelText('Type');
    const options = Array.from((type as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(['Vacation', 'Unpaid Time Off']);

    // Date pickers (not native date inputs) with a calendar popup.
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    fireEvent.click(screen.getByLabelText('Start Date calendar'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('submits an Unpaid Time Off request', async () => {
    render(<VacationSummary />);
    fireEvent.click(await screen.findByRole('button', { name: /Request Time Off/ }));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'unpaid' } });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2099-09-14' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Request/ }));
    await vi.waitFor(() => expect(server.calls).toContain('POST /time-off/requests'));
  });

  it('renders a concise request history when requests exist', async () => {
    render(<VacationSummary />);
    const items = await screen.findAllByRole('listitem');
    // "Vacation · Sep 14…" concise row + status chip.
    expect(items[0].textContent).toMatch(/Vacation/);
    expect(items[0].textContent).toMatch(/Sep 14/);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('hides request history entirely when there are none', async () => {
    server.emptyRequests = true;
    render(<VacationSummary />);
    await screen.findByText('24.50');
    expect(screen.queryByText('pending')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

describe('admin VacationManagement — accrual', () => {
  it('shows entitlement, override badge, and eligibility on the Accrual tab', async () => {
    render(<VacationManagement />);
    fireEvent.click(await screen.findByRole('button', { name: 'accrual' }));

    expect(await screen.findByText('Ada Clockwell')).toBeInTheDocument();
    expect(screen.getByText('Bo Vance')).toBeInTheDocument();
    expect(screen.getAllByText('Company default').length).toBeGreaterThan(0);
    expect(screen.getByText('Override')).toBeInTheDocument();
  });

  it('runs accrual for the previous period', async () => {
    render(<VacationManagement />);
    fireEvent.click(await screen.findByRole('button', { name: 'accrual' }));
    fireEvent.click(await screen.findByRole('button', { name: /Run Accrual/ }));
    await vi.waitFor(() => expect(server.calls).toContain('POST /admin/vacation/accrual/run'));
  });

  it('sets an employee entitlement override', async () => {
    render(<VacationManagement />);
    fireEvent.click(await screen.findByRole('button', { name: 'accrual' }));
    fireEvent.change(await screen.findByLabelText('Override hours for Ada Clockwell'), { target: { value: '160' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Set$/ })[0]);
    await vi.waitFor(() => expect(server.calls.some((c) => c.startsWith('PUT /admin/employees/1/vacation-entitlement'))).toBe(true));
  });
});
