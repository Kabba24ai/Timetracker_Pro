import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Fake V2 admin API. Records calls and serves the per-day time review + roster +
// corrections so the tests prove the wiring end-to-end.
const server = vi.hoisted(() => ({
  calls: [] as string[],
  token: 'tok' as string | null,
  lastBody: null as unknown,
}));

const EV = (id: number, kind: string, label: string, at: string) => ({
  id, kind, kind_label: label, raw_at: at, effective_at: at, source: 'employee',
  actor_id: 1, correction_type: null, corrects_event_id: null, reason: null,
  shift_id: 10, break_id: null, metadata: null, created_at: null, superseded: false,
});

const ZERO = {
  paid_seconds: 0, paid_hours: 0, unpaid_seconds: 0, unpaid_hours: 0, gross_seconds: 0, gross_hours: 0,
  lunch_seconds: 0, other_break_seconds: 0, shift_count: 0, open_shift_count: 0, has_open_shift: false,
};

const REVIEW = {
  employee: { id: 1, full_name: 'Ada Clockwell' },
  period: { from: '2026-09-13', to: '2026-09-14', timezone: 'UTC', label: 'Sep 13 – Sep 14, 2026' },
  totals: {
    paid_seconds: 27000, paid_hours: 7.5, unpaid_seconds: 1800, unpaid_hours: 0.5, gross_seconds: 28800, gross_hours: 8,
    lunch_seconds: 1800, other_break_seconds: 0, shift_count: 1, open_shift_count: 0, has_open_shift: false,
  },
  days: [
    {
      date: '2026-09-13', day_of_week: 0, weekday_label: 'Sun', day_label: 'Sun, Sep 13', day_type: 'Day Off',
      schedule: { is_working_day: false, start_at: null, end_at: null, source: 'recurring', store_id: null },
      excused: null,
      positions: { clock_in: null, lunch_start: null, lunch_end: null, other_start: null, other_end: null, clock_out: null },
      event_count: 0, has_extra_events: false, flags: [], events: [], ...ZERO,
    },
    {
      date: '2026-09-14', day_of_week: 1, weekday_label: 'Mon', day_label: 'Mon, Sep 14', day_type: 'Working Day',
      schedule: { is_working_day: true, start_at: '2026-09-14T14:00:00+00:00', end_at: '2026-09-14T22:00:00+00:00', source: 'recurring', store_id: null },
      excused: null,
      positions: {
        clock_in: { event_id: 100, at: '2026-09-14T14:00:00+00:00', source: 'employee' },
        lunch_start: { event_id: 102, at: '2026-09-14T17:00:00+00:00', source: 'employee' },
        lunch_end: { event_id: 103, at: '2026-09-14T17:30:00+00:00', source: 'employee' },
        other_start: null, other_end: null,
        clock_out: { event_id: 101, at: '2026-09-14T22:00:00+00:00', source: 'employee' },
      },
      event_count: 4, has_extra_events: false, flags: [],
      events: [EV(100, 'clock_in', 'Clock In', '2026-09-14T14:00:00+00:00'), EV(101, 'clock_out', 'Clock Out', '2026-09-14T22:00:00+00:00')],
      paid_seconds: 27000, paid_hours: 7.5, unpaid_seconds: 1800, unpaid_hours: 0.5, gross_seconds: 28800, gross_hours: 8,
      lunch_seconds: 1800, other_break_seconds: 0, shift_count: 1, open_shift_count: 0, has_open_shift: false,
    },
  ],
};

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
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
      if (path === '/auth/login-users') {
        return { success: true, data: [{ id: 1, full_name: 'Ada Clockwell' }, { id: 2, full_name: 'Bo Vance' }] };
      }
      if (path.startsWith('/admin/employees/1/time-review')) return { success: true, ...REVIEW };
      return { success: true, data: [] };
    },
    post: async (path: string, body: unknown) => {
      server.calls.push(`POST ${path}`);
      server.lastBody = body;
      return { success: true, correction_event_id: 200 };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { timeReviewToCsv, type TimeReview, type CorrectableKind } from '../lib/admin';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import CorrectionModal, { type CorrectionDraft } from '../components/admin/CorrectionModal';

beforeEach(() => {
  server.calls = [];
  server.token = 'tok';
  server.lastBody = null;
});

async function openAdjustClockIn() {
  render(<TimeReviewV2 />);
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
  // Mon clock-in = 14:00 UTC = "2:00 PM".
  fireEvent.click(await screen.findByText('2:00 PM'));
  await screen.findByText('Adjust Clock In');
}

describe('timeReviewToCsv()', () => {
  it('orders columns Date…punches…Paid, Unpaid, Total Worked', () => {
    const header = timeReviewToCsv(REVIEW as unknown as TimeReview, 'UTC').split('\n')[0].split(',');
    expect(header.slice(0, 3)).toEqual(['Date', 'Day', 'Day Type']);
    expect(header.slice(3, 9)).toEqual(['Clock In', 'Lunch Out', 'Lunch In', 'Break Out', 'Break In', 'Clock Out']);
    expect(header.slice(9)).toEqual(['Paid', 'Unpaid', 'Total Worked']);
    expect(header.indexOf('Paid')).toBeLessThan(header.indexOf('Unpaid'));
    expect(header.indexOf('Unpaid')).toBeLessThan(header.indexOf('Total Worked'));
  });

  it('emits authoritative Paid/Unpaid/Worked per day', () => {
    const mon = timeReviewToCsv(REVIEW as unknown as TimeReview, 'UTC').split('\n')[2].split(',');
    expect(mon[0]).toBe('2026-09-14');
    expect(mon.slice(9)).toEqual(['7.50', '0.50', '8.00']);
  });
});

describe('TimeReviewV2 screen', () => {
  it('renders every day (recorded + empty) with Paid/Unpaid/Total Worked and Add time', async () => {
    render(<TimeReviewV2 />);
    expect(await screen.findByRole('option', { name: 'Ada Clockwell' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });

    // Both days present — the empty Sunday still gets a row.
    expect(await screen.findByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    // Empty day offers Add time.
    expect(screen.getByRole('button', { name: /Add time/ })).toBeInTheDocument();
    // Payroll columns (Paid 7:30 in row + totals, Unpaid 0:30, Total Worked 8:00).
    expect(screen.getAllByText('7:30').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0:30').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8:00').length).toBeGreaterThan(0);
    // Bottom totals row.
    expect(screen.getByText('Pay Period Total')).toBeInTheDocument();
    expect(server.calls.some((c) => c.startsWith('GET /admin/employees/1/time-review'))).toBe(true);
  });

  it('clicking Add time on an empty day opens the insert modal', async () => {
    render(<TimeReviewV2 />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
    fireEvent.click(await screen.findByRole('button', { name: /Add time/ }));
    expect(await screen.findByText(/Add time · Sun, Sep 13/)).toBeInTheDocument();
  });
});

describe('CorrectionModal — time + standardized reason', () => {
  it('shows the date read-only (no date input) and loads the existing time', async () => {
    await openAdjustClockIn();
    // Read-only calendar date for the clicked row (Sep 14, 2026 is a Monday).
    expect(screen.getByText('Monday, September 14, 2026')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
    // Existing punch (14:00 UTC) loads as 2 : 00 PM.
    expect((screen.getByLabelText('Hour') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Minute') as HTMLInputElement).value).toBe('00');
    expect((screen.getByLabelText('AM/PM') as HTMLSelectElement).value).toBe('PM');
  });

  it('offers all ten standardized reasons and keeps reason optional (Apply enabled)', async () => {
    await openAdjustClockIn();
    const reason = screen.getByRole('combobox', { name: 'Reason' });
    expect(within(reason).getAllByRole('option').filter((o) => (o as HTMLOptionElement).value !== '')).toHaveLength(10);
    // Reason is optional — Apply is enabled with no reason selected.
    expect(screen.getByRole('button', { name: /^Apply$/ })).toBeEnabled();
  });

  it('submits with no reason (reason is optional)', async () => {
    await openAdjustClockIn();
    fireEvent.click(screen.getByRole('button', { name: /^Apply$/ }));
    await vi.waitFor(() => expect(server.calls).toContain('POST /admin/corrections'));
    const body = server.lastBody as Record<string, unknown>;
    expect(body.type).toBe('adjust');
    expect(body.reason_code).toBeUndefined();
    expect(body.reason).toBeUndefined();
  });

  it('Other requires an explanation; a standard reason does not', async () => {
    await openAdjustClockIn();
    const reason = screen.getByRole('combobox', { name: 'Reason' });

    fireEvent.change(reason, { target: { value: 'other' } });
    // Explanation field appears and Apply stays disabled until it's filled.
    const note = await screen.findByPlaceholderText(/Explain the correction/);
    expect(screen.getByRole('button', { name: /^Apply$/ })).toBeDisabled();
    fireEvent.change(note, { target: { value: 'Payroll audit' } });
    expect(screen.getByRole('button', { name: /^Apply$/ })).toBeEnabled();

    // A standard reason needs no free text.
    fireEvent.change(reason, { target: { value: 'incorrect_time' } });
    expect(screen.queryByPlaceholderText(/Explain the correction/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Apply$/ })).toBeEnabled();
  });

  it('Apply posts the V2 correction with the reason code + tenant-tz time, then re-fetches', async () => {
    await openAdjustClockIn();
    // Change the time to 3:45 PM (tz is UTC in tests → 15:45Z).
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Minute'), { target: { value: '45' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }), { target: { value: 'incorrect_time' } });
    fireEvent.click(screen.getByRole('button', { name: /^Apply$/ }));

    await vi.waitFor(() => expect(server.calls).toContain('POST /admin/corrections'));
    const body = server.lastBody as { type: string; reason_code: string; reason: string; effective_at: string };
    expect(body.type).toBe('adjust');
    expect(body.reason_code).toBe('incorrect_time');
    expect(body.reason).toBe('Incorrect Time Entered');
    expect(body.effective_at).toContain('15:45');
    // Re-fetches the authoritative day grid (refreshes Paid/Unpaid/Worked totals).
    await vi.waitFor(() => {
      const afterPost = server.calls.slice(server.calls.indexOf('POST /admin/corrections') + 1);
      expect(afterPost.some((c) => c.startsWith('GET /admin/employees/1/time-review'))).toBe(true);
    });
  });
});

// ── Cascading Delete Time ──────────────────────────────────────────────────

// Open the adjust modal for a filled punch by clicking its time on the grid.
async function openAdjust(timeText: string) {
  render(<TimeReviewV2 />);
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '1' } });
  fireEvent.click(await screen.findByText(timeText));
}

// Render the modal directly with a crafted adjust draft (for punch kinds the
// shared fixture doesn't fill, e.g. breaks) + a spying onSubmit.
function renderDeleteModal(kind: CorrectableKind, kindLabel: string) {
  const onSubmit = vi.fn(async () => {});
  const draft: CorrectionDraft = { mode: 'adjust', eventId: 500, kind, kindLabel, date: '2026-09-14', time24: '12:00' };
  render(<CorrectionModal draft={draft} tz="UTC" onClose={() => {}} onSubmit={onSubmit} />);
  return onSubmit;
}

describe('CorrectionModal — cascading Delete', () => {
  it('clicking an existing Clock In opens the edit modal with a Delete Clock In action', async () => {
    await openAdjust('2:00 PM');
    expect(await screen.findByText('Adjust Clock In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Clock In/ })).toBeInTheDocument();
    // Edit-time (Apply) still works alongside delete.
    expect(screen.getByRole('button', { name: /^Apply$/ })).toBeInTheDocument();
  });

  // Lunch endpoints route to the UNIFIED Edit Lunch interval modal (both
  // endpoints editable in one place); Delete Lunch still removes the whole pair.
  it('clicking Lunch Out opens Edit Lunch and exposes Delete Lunch', async () => {
    await openAdjust('5:00 PM'); // lunch_start 17:00 UTC
    expect(await screen.findByText(/^Edit Lunch/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Lunch/ })).toBeInTheDocument();
  });

  it('clicking Lunch In opens the SAME Edit Lunch modal with Delete Lunch', async () => {
    await openAdjust('5:30 PM'); // lunch_end 17:30 UTC
    expect(await screen.findByText(/^Edit Lunch/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Lunch/ })).toBeInTheDocument();
  });

  it('clicking Clock Out exposes Delete Clock Out', async () => {
    await openAdjust('10:00 PM'); // clock_out 22:00 UTC
    expect(await screen.findByText('Adjust Clock Out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Clock Out/ })).toBeInTheDocument();
  });

  it('Break Out / Break In expose Delete Break', () => {
    renderDeleteModal('other_start', 'Break Out');
    expect(screen.getByRole('button', { name: /Delete Break/ })).toBeInTheDocument();
  });

  it('Lunch confirmation explains BOTH Lunch Out and Lunch In are removed', () => {
    renderDeleteModal('lunch_start', 'Lunch Out');
    fireEvent.click(screen.getByRole('button', { name: /Delete Lunch/ }));
    expect(screen.getByText(/Lunch Out and Lunch In will both be removed/)).toBeInTheDocument();
  });

  it('Break confirmation explains BOTH Break Out and Break In are removed', () => {
    renderDeleteModal('other_end', 'Break In');
    fireEvent.click(screen.getByRole('button', { name: /Delete Break/ }));
    expect(screen.getByText(/Break Out and Break In will both be removed/)).toBeInTheDocument();
  });

  it('Clock-In confirmation explains the entire shift cascade', () => {
    renderDeleteModal('clock_in', 'Clock In');
    fireEvent.click(screen.getByRole('button', { name: /Delete Clock In/ }));
    expect(screen.getByText(/entire shift, including all Lunch, Break, and Clock Out/)).toBeInTheDocument();
  });

  it('Clock-Out confirmation explains the shift becomes incomplete', () => {
    renderDeleteModal('clock_out', 'Clock Out');
    fireEvent.click(screen.getByRole('button', { name: /Delete Clock Out/ }));
    expect(screen.getByText(/remain without a Clock Out until corrected/)).toBeInTheDocument();
  });

  it('Cancelling the confirmation (Keep) performs no action', async () => {
    const onSubmit = renderDeleteModal('lunch_start', 'Lunch Out');
    fireEvent.click(screen.getByRole('button', { name: /Delete Lunch/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Keep$/ }));
    // Back to the edit view; nothing submitted.
    expect(screen.queryByText(/both be removed/)).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('confirming Delete posts a delete correction and reason stays optional', () => {
    const onSubmit = renderDeleteModal('lunch_start', 'Lunch Out');
    fireEvent.click(screen.getByRole('button', { name: /Delete Lunch/ })); // reveal confirm
    fireEvent.click(screen.getByRole('button', { name: /Delete Lunch/ })); // confirm (no reason)
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.type).toBe('delete');
    expect(payload.event_id).toBe(500);
    expect(payload.reason_code).toBeUndefined();
    expect(payload.reason).toBeUndefined();
  });

  it('a successful delete posts type=delete and refreshes the Time Review', async () => {
    await openAdjust('5:00 PM'); // Lunch Out
    fireEvent.click(await screen.findByRole('button', { name: /Delete Lunch/ })); // reveal confirm
    fireEvent.click(screen.getByRole('button', { name: /Delete Lunch/ })); // confirm

    await vi.waitFor(() => expect(server.calls).toContain('POST /admin/corrections'));
    const body = server.lastBody as Record<string, unknown>;
    expect(body.type).toBe('delete');
    expect(body.event_id).toBe(102); // the lunch_start event id from the fixture
    // Authoritative refresh so removed times disappear from the effective row.
    await vi.waitFor(() => {
      const afterPost = server.calls.slice(server.calls.indexOf('POST /admin/corrections') + 1);
      expect(afterPost.some((c) => c.startsWith('GET /admin/employees/1/time-review'))).toBe(true);
    });
  });
});
