import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const server = vi.hoisted(() => ({ calls: [] as string[], token: 'tok' as string | null }));

const SUMMARY = {
  success: true,
  period: { from: '2026-09-01', to: '2026-09-14', timezone: 'America/Chicago', label: 'Sep 1 – Sep 14, 2026' },
  totals: { employees: 1, present: 8, late: 2, absent: 1, excused: 1, minutes_late: 35 },
  data: [
    {
      employee: { id: 1, full_name: 'Ada Clockwell' },
      present: 8, late: 2, absent: 1, excused: 1, day_off: 2, unscheduled: 0,
      minutes_late: 35, worked_seconds: 0, flags: ['absent', 'late'],
    },
  ],
};

const EMP_DAYS = {
  success: true,
  employee: { id: 1, full_name: 'Ada Clockwell' },
  timezone: 'America/Chicago',
  from: '2026-09-01',
  to: '2026-09-14',
  data: [
    {
      date: '2026-09-14', status: 'late', status_label: 'Late', scheduled: true, schedule_source: 'recurring',
      scheduled_start: '2026-09-14T14:00:00Z', scheduled_end: '2026-09-14T22:00:00Z',
      first_clock_in: '2026-09-14T14:20:00Z', last_clock_out: '2026-09-14T22:00:00Z',
      minutes_late: 20, minutes_early: 0, worked_seconds: 0, shift_count: 1, excused_type: null,
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
      if (path.startsWith('/admin/attendance/summary')) return SUMMARY;
      if (path.startsWith('/admin/employees/1/attendance')) return EMP_DAYS;
      return { success: true };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      if (path === '/admin/attendance/rebuild') return { success: true, employees: 1, days_derived: 14 };
      return { success: true };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { fetchAttendanceSummary } from '../lib/attendance';
import AttendanceV2 from '../components/admin/AttendanceV2';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
});

describe('attendance API params', () => {
  it('requests a period selector when no explicit dates', async () => {
    await fetchAttendanceSummary({ period: 'current' });
    expect(server.calls.some((c) => c.includes('/admin/attendance/summary?period=current'))).toBe(true);
  });
});

describe('AttendanceV2 screen', () => {
  it('loads the summary + totals', async () => {
    render(<AttendanceV2 />);
    expect(await screen.findByText('Ada Clockwell')).toBeInTheDocument();
    // Present (8) appears in both the totals card and the employee row.
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
    // "Present"/"Absent" appear as both a totals label and a column header.
    expect(screen.getAllByText('Present').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Absent').length).toBeGreaterThan(0);
    expect(screen.getByText('Sep 1 – Sep 14, 2026', { exact: false })).toBeInTheDocument();
  });

  it('rebuilds and reloads', async () => {
    render(<AttendanceV2 />);
    await screen.findByText('Ada Clockwell');
    server.calls = [];

    fireEvent.click(screen.getByRole('button', { name: /rebuild/i }));

    await vi.waitFor(() => expect(server.calls).toContain('POST /admin/attendance/rebuild'));
    // Reloaded the summary after rebuilding.
    await vi.waitFor(() =>
      expect(server.calls.some((c) => c.startsWith('GET /admin/attendance/summary'))).toBe(true),
    );
  });

  it('drills into an employee day-by-day', async () => {
    render(<AttendanceV2 />);
    fireEvent.click(await screen.findByText('Ada Clockwell'));

    // Modal fetches the employee range and shows the day + status.
    await vi.waitFor(() =>
      expect(server.calls.some((c) => c.startsWith('GET /admin/employees/1/attendance'))).toBe(true),
    );
    const dialog = await screen.findByText(/attendance$/i); // "Ada Clockwell — attendance"
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('2026-09-14')).toBeInTheDocument();
    expect(within(document.body).getAllByText('Late').length).toBeGreaterThan(0);
  });
});
