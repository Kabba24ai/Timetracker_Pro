import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import type { ClockEventRow, CorrectionPayload, TimeReview, TimeReviewDay, DayPosition, PositionKey } from '../lib/admin';

// THE RENDERED-CELL TIMEZONE REGRESSION (Defect 1) + unified lunch-modal routing
// (Defect 3). This renders the REAL Time Review grid — not the stored value, not
// the API payload, not the modal serialization — and asserts the table cell and
// the correction modal show the SAME tenant-local wall time for the same canonical
// UTC instant. There is exactly ONE representation of a punch (`positions[k].at`,
// a UTC ISO instant) and both surfaces must format it in the tenant timezone.

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ timezone: 'America/Chicago' }),
}));

const applyCorrectionMock = vi.fn(async (_p: CorrectionPayload) => {});
let reviewResponse: TimeReview;

vi.mock('../lib/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/admin')>();
  return {
    ...actual,
    fetchEmployees: vi.fn(async () => [{ id: 7, full_name: 'Mike Hodges' }]),
    fetchTimeReview: vi.fn(async () => reviewResponse),
    applyCorrection: (p: CorrectionPayload) => applyCorrectionMock(p),
  };
});

const payroll = {
  paid_seconds: 0,
  paid_hours: 0,
  unpaid_seconds: 0,
  unpaid_hours: 0,
  gross_seconds: 0,
  gross_hours: 0,
  lunch_seconds: 0,
  other_break_seconds: 0,
  shift_count: 1,
  open_shift_count: 0,
  has_open_shift: false,
};

let nextEventId = 100;
const pos = (at: string): DayPosition => ({ event_id: nextEventId++, at, source: 'employee' });

function day(date: string, weekday: string, positions: Partial<Record<PositionKey, DayPosition>>): TimeReviewDay {
  const filled = Object.values(positions).filter(Boolean).length;
  return {
    ...payroll,
    date,
    day_of_week: 4,
    weekday_label: weekday,
    day_label: `${weekday}, Aug ${Number(date.slice(8))}`,
    day_type: 'Working Day',
    schedule: null,
    excused: null,
    positions: {
      clock_in: null,
      lunch_start: null,
      lunch_end: null,
      other_start: null,
      other_end: null,
      clock_out: null,
      ...positions,
    },
    event_count: filled,
    has_extra_events: false,
    pending: false,
    pending_reasons: [],
    clock_out_unverified: false,
    flags: [],
    events: [],
  };
}

// Canonical UTC instants (America/Chicago is UTC-5 on 2026-08-20):
//   2026-08-20T12:00:00+00:00 = 7:00 AM · 17:00Z = 12:00 PM · 17:30Z = 12:30 PM
//   23:00Z = 6:00 PM · 23:02Z = 6:02 PM (the live +5h-jump case)
function buildReview(days: TimeReviewDay[]): TimeReview {
  return {
    employee: { id: 7, full_name: 'Mike Hodges' },
    period: { from: '2026-08-16', to: '2026-08-29', timezone: 'America/Chicago', label: null },
    totals: payroll,
    days,
  };
}

const setup = async (days: TimeReviewDay[]) => {
  reviewResponse = buildReview(days);
  render(<TimeReviewV2 initialUserId={7} />);
  await screen.findByText('All times shown in America/Chicago (tenant timezone).');
};

beforeEach(() => {
  applyCorrectionMock.mockClear();
  nextEventId = 100;
});

describe('Time Review — rendered row shows the tenant-local time (Defect 1)', () => {
  it('a 2026-08-20T23:02:00Z clock-out renders 6:02 PM in the row AND 6:02 PM in the modal', async () => {
    const user = userEvent.setup();
    await setup([
      day('2026-08-20', 'Thu', {
        clock_in: pos('2026-08-20T12:00:00+00:00'),
        clock_out: pos('2026-08-20T23:02:00+00:00'),
      }),
    ]);

    // The rendered table cell — NEVER 11:02 PM (the UTC wall time).
    const cell = await screen.findByRole('button', { name: '6:02 PM' });
    expect(screen.queryByText('11:02 PM')).toBeNull();

    // Click the same cell: the correction modal shows the SAME wall time.
    await user.click(cell);
    expect(screen.getByText('Adjust Clock Out')).toBeTruthy();
    expect((screen.getByLabelText('Hour') as HTMLInputElement).value).toBe('6');
    expect((screen.getByLabelText('Minute') as HTMLInputElement).value).toBe('02');
    expect((screen.getByLabelText('AM/PM') as HTMLSelectElement).value).toBe('PM');
    // The tenant zone is named in the page header AND in the modal's time label.
    expect(screen.getAllByText(/America\/Chicago/).length).toBeGreaterThanOrEqual(2);
  });

  it('lunch out/in cells render tenant-local (12:00 PM / 12:30 PM) and agree with the Edit Lunch modal', async () => {
    const user = userEvent.setup();
    await setup([
      day('2026-08-20', 'Thu', {
        clock_in: pos('2026-08-20T12:00:00+00:00'),
        lunch_start: pos('2026-08-20T17:00:00+00:00'),
        lunch_end: pos('2026-08-20T17:30:00+00:00'),
        clock_out: pos('2026-08-20T22:00:00+00:00'),
      }),
    ]);

    await user.click(await screen.findByRole('button', { name: '12:00 PM' }));
    expect(screen.getByText(/^Edit Lunch/)).toBeTruthy();
    expect((screen.getByLabelText('Lunch Out Hour') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Lunch Out Minute') as HTMLInputElement).value).toBe('00');
    expect((screen.getByLabelText('Lunch In Hour') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Lunch In Minute') as HTMLInputElement).value).toBe('30');
  });

  it('save Clock Out 6:02 PM → correct UTC instant on the wire → refreshed row displays 6:02 PM', async () => {
    const user = userEvent.setup();
    const before = day('2026-08-20', 'Thu', {
      clock_in: pos('2026-08-20T12:00:00+00:00'),
      clock_out: pos('2026-08-20T22:00:00+00:00'), // 5:00 PM
    });
    await setup([before]);

    await user.click(await screen.findByRole('button', { name: '5:00 PM' }));
    // Type the new time exactly like the admin: 6:02 PM.
    await user.click(screen.getByLabelText('Hour'));
    await user.keyboard('6');
    await user.keyboard('02'); // auto-advanced to Minute
    await user.selectOptions(screen.getByLabelText('AM/PM'), 'PM');

    // The refresh after saving returns the corrected canonical instant.
    reviewResponse = buildReview([
      day('2026-08-20', 'Thu', {
        clock_in: pos('2026-08-20T12:00:00+00:00'),
        clock_out: pos('2026-08-20T23:02:00+00:00'),
      }),
    ]);
    await user.click(screen.getByRole('button', { name: /^Apply$/ }));

    // The wire carried the true UTC instant — no ±5h, no naive string.
    await vi.waitFor(() => expect(applyCorrectionMock).toHaveBeenCalled());
    const payload = applyCorrectionMock.mock.calls[0][0];
    expect(payload.type).toBe('adjust');
    expect(payload.effective_at).toBe('2026-08-20T23:02:00.000Z');

    // And the refreshed rendered row agrees with what was entered.
    expect(await screen.findByRole('button', { name: '6:02 PM' })).toBeTruthy();
    expect(screen.queryByText('11:02 PM')).toBeNull();
  });
});

describe('Time Review — resolving a Missing Clock Out Pending shift', () => {
  const eventRow = (id: number, kind: ClockEventRow['kind'], at: string, source: ClockEventRow['source']): ClockEventRow => ({
    id,
    kind,
    kind_label: kind === 'pending_close' ? 'Pending (No Clock Out)' : 'Clock In',
    raw_at: at,
    effective_at: at,
    source,
    actor_id: null,
    correction_type: null,
    corrects_event_id: null,
    reason: null,
    shift_id: 1,
    break_id: null,
    metadata: null,
    created_at: at,
    superseded: false,
  });

  // The exact production shape: 3:00 PM Clock In, 6:00 PM PendingClose marker.
  const pendingDay = (): TimeReviewDay => ({
    ...day('2026-08-20', 'Thu', { clock_in: pos('2026-08-20T20:00:00+00:00') }),
    pending: true,
    pending_reasons: ['Missing Clock Out'],
    clock_out_unverified: true,
    events: [
      eventRow(801, 'clock_in', '2026-08-20T20:00:00+00:00', 'employee'),
      eventRow(802, 'pending_close', '2026-08-20T23:00:00+00:00', 'system'),
    ],
  });

  it('clicking Missing/Pending opens Resolve Missing Clock Out — not Add Clock Out', async () => {
    const user = userEvent.setup();
    await setup([pendingDay()]);

    await user.click(await screen.findByRole('button', { name: /Missing \/ Pending/ }));
    expect(screen.getByText(/^Resolve Missing Clock Out/)).toBeTruthy();
    expect(screen.queryByText(/^Add Clock Out/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Resolve$/ })).toBeTruthy();
  });

  it('resolving posts resolve_pending_clock_out against the PendingClose marker with the verified instant', async () => {
    const user = userEvent.setup();
    await setup([pendingDay()]);

    await user.click(await screen.findByRole('button', { name: /Missing \/ Pending/ }));
    // Enter the verified 4:30 PM — EARLIER than the 6:00 PM marker (valid).
    await user.click(screen.getByLabelText('Hour'));
    await user.keyboard('4'); // >1 auto-advances to Minute
    await user.keyboard('30');
    await user.selectOptions(screen.getByLabelText('AM/PM'), 'PM');
    await user.click(screen.getByRole('button', { name: /^Resolve$/ }));

    await vi.waitFor(() => expect(applyCorrectionMock).toHaveBeenCalled());
    const p = applyCorrectionMock.mock.calls[0][0];
    expect(p.type).toBe('resolve_pending_clock_out');
    expect(p.event_id).toBe(802); // the PendingClose marker, not the clock-in
    expect(p.effective_at).toBe('2026-08-20T21:30:00.000Z'); // 4:30 PM America/Chicago
  });
});

describe('Time Review — unified lunch interval modal (Defect 3)', () => {
  const completePair = () =>
    day('2026-08-20', 'Thu', {
      clock_in: pos('2026-08-20T12:00:00+00:00'),
      lunch_start: pos('2026-08-20T18:20:00+00:00'), // 1:20 PM
      lunch_end: pos('2026-08-20T19:45:00+00:00'), // 2:45 PM
      clock_out: pos('2026-08-20T22:00:00+00:00'),
    });

  it('clicking Lunch Out of a complete pair opens Edit Lunch with both endpoints', async () => {
    const user = userEvent.setup();
    await setup([completePair()]);
    await user.click(await screen.findByRole('button', { name: '1:20 PM' }));
    expect(screen.getByText(/^Edit Lunch/)).toBeTruthy();
    expect((screen.getByLabelText('Lunch Out Hour') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Lunch Out Minute') as HTMLInputElement).value).toBe('20');
    expect((screen.getByLabelText('Lunch In Hour') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Lunch In Minute') as HTMLInputElement).value).toBe('45');
    expect(screen.getByRole('button', { name: /Delete Lunch/ })).toBeTruthy();
  });

  it('clicking Lunch In of the same pair opens the SAME Edit Lunch modal', async () => {
    const user = userEvent.setup();
    await setup([completePair()]);
    await user.click(await screen.findByRole('button', { name: '2:45 PM' }));
    expect(screen.getByText(/^Edit Lunch/)).toBeTruthy();
    expect((screen.getByLabelText('Lunch Out Hour') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Lunch Out Minute') as HTMLInputElement).value).toBe('20');
    expect((screen.getByLabelText('Lunch In Hour') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Lunch In Minute') as HTMLInputElement).value).toBe('45');
  });

  it('editing the pair submits ONE atomic edit_break with both event ids', async () => {
    const user = userEvent.setup();
    const d = completePair();
    await setup([d]);
    await user.click(await screen.findByRole('button', { name: '1:20 PM' }));

    // Change Lunch Out to 12:00 PM, leave Lunch In prefilled (2:45 PM).
    await user.click(screen.getByLabelText('Lunch Out Hour'));
    await user.keyboard('12');
    await user.keyboard('00'); // auto-advanced to Lunch Out Minute
    await user.click(screen.getByRole('button', { name: /^Apply$/ }));

    await vi.waitFor(() => expect(applyCorrectionMock).toHaveBeenCalled());
    const p = applyCorrectionMock.mock.calls[0][0];
    expect(p.type).toBe('edit_break');
    expect(p.break_type).toBe('lunch');
    expect(p.start_event_id).toBe(d.positions.lunch_start!.event_id);
    expect(p.end_event_id).toBe(d.positions.lunch_end!.event_id);
    expect(p.start_at).toBe('2026-08-20T17:00:00.000Z'); // 12:00 PM Chicago
    expect(p.end_at).toBe('2026-08-20T19:45:00.000Z'); // untouched 2:45 PM — server preserves the original event
  });

  it('a lone Lunch Out opens Complete Lunch with the existing time preserved, never Add defaults', async () => {
    const user = userEvent.setup();
    const d = day('2026-08-20', 'Thu', {
      clock_in: pos('2026-08-20T12:00:00+00:00'),
      lunch_start: pos('2026-08-20T23:00:00+00:00'), // the live case: lone 6:00 PM Lunch Out
      clock_out: pos('2026-08-21T04:02:00+00:00'),
    });
    await setup([d]);

    await user.click(await screen.findByRole('button', { name: '6:00 PM' }));
    expect(screen.getByText(/^Complete Lunch/)).toBeTruthy();
    // Existing Lunch Out prefilled with ITS OWN time; missing Lunch In derived from it.
    expect((screen.getByLabelText('Lunch Out Hour') as HTMLInputElement).value).toBe('6');
    expect((screen.getByLabelText('Lunch Out Minute') as HTMLInputElement).value).toBe('00');
    expect((screen.getByLabelText('Lunch In Hour') as HTMLInputElement).value).toBe('6');
    expect((screen.getByLabelText('Lunch In Minute') as HTMLInputElement).value).toBe('30');

    await user.click(screen.getByRole('button', { name: /^Apply$/ }));
    await vi.waitFor(() => expect(applyCorrectionMock).toHaveBeenCalled());
    const p = applyCorrectionMock.mock.calls[0][0];
    expect(p.type).toBe('edit_break');
    expect(p.start_event_id).toBe(d.positions.lunch_start!.event_id);
    expect(p.end_event_id).toBeUndefined();
    expect(p.start_at).toBe('2026-08-20T23:00:00.000Z'); // existing Lunch Out preserved by default
    expect(p.end_at).toBe('2026-08-20T23:30:00.000Z');
  });

  it('the empty Lunch In cell of that lone pair routes to the SAME Complete Lunch modal', async () => {
    const user = userEvent.setup();
    const d = day('2026-08-20', 'Thu', {
      clock_in: pos('2026-08-20T12:00:00+00:00'),
      lunch_start: pos('2026-08-20T23:00:00+00:00'),
    });
    await setup([d]);

    // Lunch In is the first empty (--:--) punch cell on this row.
    const row = screen.getByText('6:00 PM').closest('tr')!;
    await user.click(within(row).getAllByRole('button', { name: '--:--' })[0]);
    expect(screen.getByText(/^Complete Lunch/)).toBeTruthy();
    expect((screen.getByLabelText('Lunch Out Hour') as HTMLInputElement).value).toBe('6');
  });

  it('a day with NO lunch still opens Add lunch with the standard defaults', async () => {
    const user = userEvent.setup();
    const d = day('2026-08-20', 'Thu', {
      clock_in: pos('2026-08-20T12:05:00+00:00'), // 7:05 AM
      clock_out: pos('2026-08-20T22:00:00+00:00'),
    });
    await setup([d]);

    const row = screen.getByText('7:05 AM').closest('tr')!;
    await user.click(within(row).getAllByRole('button', { name: '--:--' })[0]); // Lunch Out cell
    expect(screen.getByText(/^Add lunch/)).toBeTruthy();
    expect((screen.getByLabelText('Lunch Out Hour') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('Lunch Out Minute') as HTMLInputElement).value).toBe('00');
    expect((screen.getByLabelText('Lunch In Minute') as HTMLInputElement).value).toBe('30');
  });
});
