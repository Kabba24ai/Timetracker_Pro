import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const server = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body?: unknown }[],
  token: 'tok' as string | null,
}));

const SCHEDULE = {
  success: true,
  employee: { id: 1, full_name: 'Ada Clockwell', store_id: 5 },
  timezone: 'America/Chicago',
  rules: [
    { day_of_week: 1, is_working_day: true, start_time: '09:00', end_time: '17:00', crosses_midnight: false, store_id: null },
    { day_of_week: 2, is_working_day: true, start_time: '22:00', end_time: '06:00', crosses_midnight: true, store_id: null },
  ],
  overrides: [
    { id: 7, date: '2026-09-14', is_working_day: false, start_time: null, end_time: null, crosses_midnight: false, store_id: null, reason: 'Holiday' },
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
      server.calls.push({ method: 'GET', path });
      if (path === '/auth/login-users') return { success: true, data: [{ id: 1, full_name: 'Ada Clockwell' }] };
      if (path.startsWith('/admin/employees/1/schedule')) return SCHEDULE;
      return { success: true };
    },
    put: async (path: string, body: unknown) => {
      server.calls.push({ method: 'PUT', path, body });
      return { success: true };
    },
    post: async (path: string, body: unknown) => {
      server.calls.push({ method: 'POST', path, body });
      return { success: true, override_id: 99 };
    },
    del: async (path: string) => {
      server.calls.push({ method: 'DELETE', path });
      return { success: true };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { fetchEmployeeSchedule, isOvernight, saveEmployeeSchedule } from '../lib/schedule';
import WorkScheduleV2 from '../components/admin/WorkScheduleV2';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
});

describe('schedule lib', () => {
  it('detects overnight windows (end at/before start)', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true);
    expect(isOvernight('09:00', '17:00')).toBe(false);
    expect(isOvernight(null, '17:00')).toBe(false);
  });

  it('fetches an employee schedule', async () => {
    const s = await fetchEmployeeSchedule(1);
    expect(s.timezone).toBe('America/Chicago');
    expect(s.rules).toHaveLength(2);
    expect(server.calls.some((c) => c.method === 'GET' && c.path.startsWith('/admin/employees/1/schedule'))).toBe(true);
  });

  it('PUTs the recurring rules', async () => {
    await saveEmployeeSchedule(1, SCHEDULE.rules);
    const put = server.calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe('/admin/employees/1/schedule');
    expect((put.body as { rules: unknown[] }).rules).toHaveLength(2);
  });
});

describe('WorkScheduleV2 screen', () => {
  it('loads the weekly grid + overrides on employee selection', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });

    // All 7 weekday rows render.
    expect(await screen.findByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
    // Overnight badge for Tuesday's 22:00–06:00 rule.
    expect(screen.getByText(/Overnight/)).toBeInTheDocument();
    // The override is listed.
    expect(screen.getByText('Holiday')).toBeInTheDocument();
    expect(screen.getByText('America/Chicago', { exact: false })).toBeInTheDocument();
  });

  it('saves the weekly schedule (PUT with all 7 days)', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('Sunday');

    fireEvent.click(screen.getByRole('button', { name: /save weekly schedule/i }));

    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = server.calls.find((c) => c.method === 'PUT')!;
    expect((put.body as { rules: unknown[] }).rules).toHaveLength(7); // full week sent
  });

  it('adds a date override', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('Sunday');

    fireEvent.change(screen.getByLabelText(/override date/i), { target: { value: '2026-12-25' } });
    fireEvent.click(screen.getByRole('button', { name: /add override/i }));

    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'POST')).toBe(true));
    const post = server.calls.find((c) => c.method === 'POST')!;
    expect(post.path).toBe('/admin/employees/1/schedule/overrides');
    expect((post.body as { date: string }).date).toBe('2026-12-25');
  });

  it('deletes an override', async () => {
    render(<WorkScheduleV2 />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('Holiday');

    fireEvent.click(screen.getByLabelText(/delete override 2026-09-14/i));

    await vi.waitFor(() => expect(server.calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(server.calls.find((c) => c.method === 'DELETE')!.path).toBe('/admin/employees/1/schedule/overrides/7');
  });
});
