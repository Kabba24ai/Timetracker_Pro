import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Fake V2 admin API. Records calls and serves shifts/events/corrections so the
// tests prove the wiring end-to-end (employee pick → fetch → render → correct).
const server = vi.hoisted(() => ({
  calls: [] as string[],
  token: 'tok' as string | null,
}));

const SHIFT = {
  id: 10,
  status: 'closed',
  clock_in_at: '2026-09-14T14:00:00+00:00',
  clock_out_at: '2026-09-14T22:00:00+00:00',
  worked_seconds: 27000, // 7.5h (8h − 30m lunch)
  breaks: [
    { id: 1, type: 'lunch', start_at: '2026-09-14T17:00:00+00:00', end_at: '2026-09-14T17:30:00+00:00', duration_seconds: 1800 },
  ],
};

const EVENTS = [
  { id: 100, kind: 'clock_in', kind_label: 'Clock In', raw_at: '2026-09-14T14:00:00+00:00', effective_at: '2026-09-14T14:00:00+00:00', source: 'employee', actor_id: 1, correction_type: null, corrects_event_id: null, reason: null, shift_id: 10, break_id: null, metadata: null, created_at: null },
  { id: 101, kind: 'clock_out', kind_label: 'Clock Out', raw_at: '2026-09-14T22:00:00+00:00', effective_at: '2026-09-14T22:00:00+00:00', source: 'employee', actor_id: 1, correction_type: null, corrects_event_id: null, reason: null, shift_id: 10, break_id: null, metadata: null, created_at: null },
];

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    errors?: Record<string, string[]>;
    constructor(message: string, status: number, errors?: Record<string, string[]>) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors;
    }
    firstError(): string {
      if (this.errors) {
        const first = Object.values(this.errors)[0];
        if (first?.length) return first[0];
      }
      return this.message;
    }
  }
  const AUTH_ERROR_EVENT = 'tt:unauthorized';

  const api = {
    getToken: () => server.token,
    setToken: (t: string | null) => { server.token = t; },
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path === '/auth/login-users') {
        return { success: true, data: [{ id: 1, full_name: 'Ada Clockwell' }, { id: 2, full_name: 'Bo Vance' }] };
      }
      if (path.startsWith('/admin/employees/1/shifts')) return { success: true, data: [SHIFT] };
      if (path.startsWith('/admin/employees/1/events')) return { success: true, data: EVENTS };
      return { success: true, data: [] };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      if (path === '/admin/corrections') {
        return { success: true, correction_event_id: 200, shifts: [SHIFT] };
      }
      return { success: true };
    },
  };

  return { api, ApiError, AUTH_ERROR_EVENT };
});

import { shiftsToCsv, summarize } from '../lib/admin';
import type { ClockShift } from '../lib/timeclock';
import TimeReviewV2 from '../components/admin/TimeReviewV2';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
});

describe('admin summarize()', () => {
  it('totals worked, lunch, other, and open shifts', () => {
    const shifts = [
      SHIFT as unknown as ClockShift,
      {
        id: 11, status: 'open', clock_in_at: '2026-09-15T14:00:00+00:00', clock_out_at: null, worked_seconds: 0,
        breaks: [{ id: 2, type: 'other', start_at: '', end_at: '', duration_seconds: 900 }],
      } as unknown as ClockShift,
    ];
    const s = summarize(shifts);
    expect(s.shiftCount).toBe(2);
    expect(s.workedSeconds).toBe(27000);
    expect(s.lunchSeconds).toBe(1800);
    expect(s.otherSeconds).toBe(900);
    expect(s.openShifts).toBe(1);
  });
});

describe('admin shiftsToCsv()', () => {
  it('emits a header + one row per shift and escapes commas', () => {
    const csv = shiftsToCsv('Ada, Jr', [SHIFT as unknown as ClockShift], 'America/Chicago');
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Employee');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Ada, Jr"'); // comma-containing cell is quoted
    expect(lines[1]).toContain('7.50'); // worked hours
    expect(lines[1]).toContain('30'); // lunch minutes
  });
});

describe('TimeReviewV2 screen', () => {
  it('loads employees and, on selection, fetches + renders the shift summary', async () => {
    render(<TimeReviewV2 />);

    // Employee roster loaded.
    expect(await screen.findByRole('option', { name: 'Ada Clockwell' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });

    // Summary + shift row render from the fetched data.
    // Worked duration appears in both the summary card and the shift row.
    expect((await screen.findAllByText('7:30')).length).toBeGreaterThan(0);
    expect(server.calls.some((c) => c.startsWith('GET /admin/employees/1/shifts'))).toBe(true);
    expect(server.calls.some((c) => c.startsWith('GET /admin/employees/1/events'))).toBe(true);
  });

  it('applies a correction and re-fetches', async () => {
    render(<TimeReviewV2 />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
    await screen.findAllByText('7:30');

    // Open the ledger, adjust the clock-in.
    fireEvent.click(screen.getByText(/show event ledger/i));
    const row = (await screen.findByText('Clock In')).closest('tr')!;
    fireEvent.click(within(row).getByText('Adjust'));

    // Apply the correction.
    fireEvent.click(await screen.findByRole('button', { name: /^Apply$/ }));

    // Posted a correction and re-loaded the data (reload is async after the POST).
    await vi.waitFor(() => expect(server.calls).toContain('POST /admin/corrections'));
    await vi.waitFor(() => {
      const afterPost = server.calls.slice(server.calls.indexOf('POST /admin/corrections') + 1);
      expect(afterPost.some((c) => c.startsWith('GET /admin/employees/1/shifts'))).toBe(true);
    });
  });
});
