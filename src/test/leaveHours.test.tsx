import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CorrectionModal, { CorrectionDraft } from '../components/admin/CorrectionModal';
import LeaveHoursModal, { MAX_LEAVE_HOURS } from '../components/admin/LeaveHoursModal';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import { ApiError } from '../lib/api';
import type { CorrectionPayload, DayPosition, LeaveEntry, LeaveEntryPayload, PositionKey, TimeReview, TimeReviewDay } from '../lib/admin';

// Manual Holiday / Vacation hours from Time Review.
//   • "+ Holiday" / "+ Vacation" live ONLY in the Clock In context of the
//     CorrectionModal (add a missing Clock In, or adjust an existing one).
//   • One LeaveHoursModal serves both types: default 8.00, max 8.00, vacation
//     additionally shows and enforces the canonical available balance.
//   • The grid shows leave as a compact sub-row badge ("Vacation 4:00"), never
//     merged into punch cells; the badge opens the editor; edit/delete refetch.
// The REAL components are rendered; only the admin API layer is mocked.

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ timezone: 'America/Chicago' }),
}));

const applyCorrectionMock = vi.fn(async (_p: CorrectionPayload) => {});
const createLeaveMock = vi.fn(async (_p: LeaveEntryPayload) => {});
const updateLeaveMock = vi.fn(async (_id: number, _hours: number) => {});
const deleteLeaveMock = vi.fn(async (_id: number, _reason?: string) => {});
const balanceMock = vi.fn(async (_userId: number) => 32);
let reviewResponse: TimeReview;
let fetchCount = 0;

vi.mock('../lib/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/admin')>();
  return {
    ...actual,
    fetchEmployees: vi.fn(async () => [{ id: 7, full_name: 'Jesse Unger' }]),
    fetchTimeReview: vi.fn(async () => {
      fetchCount += 1;
      return reviewResponse;
    }),
    applyCorrection: (p: CorrectionPayload) => applyCorrectionMock(p),
    createLeaveEntry: (p: LeaveEntryPayload) => createLeaveMock(p),
    updateLeaveEntry: (id: number, hours: number) => updateLeaveMock(id, hours),
    deleteLeaveEntry: (id: number, reason?: string) => deleteLeaveMock(id, reason),
    fetchEmployeeVacationBalance: (userId: number) => balanceMock(userId),
  };
});

const payroll = {
  paid_seconds: 0, paid_hours: 0, unpaid_seconds: 0, unpaid_hours: 0, gross_seconds: 0, gross_hours: 0,
  lunch_seconds: 0, other_break_seconds: 0, shift_count: 0, open_shift_count: 0, has_open_shift: false,
  vacation_seconds: 0, vacation_hours: 0, holiday_seconds: 0, holiday_hours: 0,
  other_paid_leave_seconds: 0, other_paid_leave_hours: 0, total_paid_seconds: 0, total_paid_hours: 0,
};

let nextEventId = 100;
const pos = (at: string): DayPosition => ({ event_id: nextEventId++, at, source: 'employee' });

function day(date: string, positions: Partial<Record<PositionKey, DayPosition>>, extra: Partial<TimeReviewDay> = {}): TimeReviewDay {
  const filled = Object.values(positions).filter(Boolean).length;
  return {
    ...payroll,
    date,
    day_of_week: 1,
    weekday_label: 'Mon',
    day_label: `Mon, Sep ${Number(date.slice(8))}`,
    day_type: 'Working Day',
    schedule: null,
    excused: null,
    positions: { clock_in: null, lunch_start: null, lunch_end: null, other_start: null, other_end: null, clock_out: null, ...positions },
    event_count: filled,
    has_extra_events: false,
    pending: false,
    pending_reasons: [],
    pending_reason_codes: [],
    clock_out_unverified: false,
    lunch_missing: false,
    lunch_override: null,
    leave_entries: [],
    flags: [],
    events: [],
    ...extra,
  };
}

const leave = (id: number, type: 'vacation' | 'holiday', hours: number, extra: Partial<LeaveEntry> = {}): LeaveEntry => ({
  id,
  type,
  label: type === 'vacation' ? 'Vacation' : 'Holiday',
  hours,
  seconds: hours * 3600,
  scheduled_hours: 8,
  is_paid: true,
  manual: true,
  editable: true,
  source: 'admin',
  notes: null,
  ...extra,
});

// Monday 2026-09-14 America/Chicago: 7:00 AM in, lunch 12:00–12:30, out 1:00 PM → 5.5h worked.
const IN = '2026-09-14T12:00:00+00:00';
const LUNCH_OUT = '2026-09-14T17:00:00+00:00';
const LUNCH_IN = '2026-09-14T17:30:00+00:00';
const OUT = '2026-09-14T18:00:00+00:00';

const workedDay = (extra: Partial<TimeReviewDay> = {}) =>
  day('2026-09-14', { clock_in: pos(IN), lunch_start: pos(LUNCH_OUT), lunch_end: pos(LUNCH_IN), clock_out: pos(OUT) }, {
    paid_seconds: 19800, gross_seconds: 21600, unpaid_seconds: 1800, lunch_seconds: 1800, shift_count: 1,
    total_paid_seconds: 19800,
    ...extra,
  });

function review(days: TimeReviewDay[], totals: Partial<typeof payroll> = {}): TimeReview {
  return {
    employee: { id: 7, full_name: 'Jesse Unger' },
    period: { from: '2026-09-13', to: '2026-09-26', timezone: 'America/Chicago', label: null },
    totals: { ...payroll, ...totals },
    days,
  };
}

const setup = async (days: TimeReviewDay[], totals: Partial<typeof payroll> = {}) => {
  reviewResponse = review(days, totals);
  render(<TimeReviewV2 initialUserId={7} />);
  await screen.findByText('All times shown in America/Chicago (tenant timezone).');
};

beforeEach(() => {
  applyCorrectionMock.mockClear();
  createLeaveMock.mockClear();
  updateLeaveMock.mockClear();
  deleteLeaveMock.mockClear();
  balanceMock.mockClear();
  balanceMock.mockResolvedValue(32);
  nextEventId = 100;
  fetchCount = 0;
});

// ── CorrectionModal: where the shortcuts appear ─────────────────────────────

describe('CorrectionModal — Holiday / Vacation shortcuts appear only in the Clock In context', () => {
  const renderDraft = (draft: CorrectionDraft, onLeave = vi.fn()) => {
    render(<CorrectionModal draft={draft} tz="America/Chicago" onClose={() => {}} onSubmit={async () => {}} onLeave={onLeave} />);
    return onLeave;
  };
  const holidayBtn = () => screen.queryByRole('button', { name: /\+ Holiday/ });
  const vacationBtn = () => screen.queryByRole('button', { name: /\+ Vacation/ });

  it('shown when ADDING a missing Clock In', () => {
    const onLeave = renderDraft({ mode: 'insert', userId: 7, kind: 'clock_in', kindLabel: 'Clock In', date: '2026-09-14', time24: '09:00' });
    expect(holidayBtn()).toBeInTheDocument();
    expect(vacationBtn()).toBeInTheDocument();
    fireEvent.click(holidayBtn()!);
    expect(onLeave).toHaveBeenCalledWith('holiday');
    fireEvent.click(vacationBtn()!);
    expect(onLeave).toHaveBeenCalledWith('vacation');
  });

  it('shown when ADJUSTING an existing Clock In (a partly-worked day may need Vacation added)', () => {
    renderDraft({ mode: 'adjust', eventId: 42, kind: 'clock_in', kindLabel: 'Clock In', date: '2026-09-14', time24: '07:00' });
    expect(holidayBtn()).toBeInTheDocument();
    expect(vacationBtn()).toBeInTheDocument();
  });

  it('NOT shown for Clock Out (add or adjust)', () => {
    renderDraft({ mode: 'insert', userId: 7, kind: 'clock_out', kindLabel: 'Clock Out', date: '2026-09-14', time24: '17:00' });
    expect(holidayBtn()).toBeNull();
    expect(vacationBtn()).toBeNull();
  });

  it('NOT shown for Lunch or Break intervals', () => {
    renderDraft({ mode: 'insert_break', userId: 7, breakType: 'lunch', date: '2026-09-14', startTime24: '12:00', endTime24: '12:30' });
    expect(holidayBtn()).toBeNull();
    expect(vacationBtn()).toBeNull();
  });

  it('NOT shown when editing an existing Break interval', () => {
    renderDraft({ mode: 'edit_break', breakType: 'other', startEventId: 1, endEventId: 2, date: '2026-09-14', startTime24: '15:00', endTime24: '15:15', title: 'Edit Break' });
    expect(holidayBtn()).toBeNull();
  });

  it('NOT shown when resolving a Missing Clock Out', () => {
    renderDraft({ mode: 'resolve_pending', eventId: 9, date: '2026-09-14', time24: '17:00', title: 'Resolve Missing Clock Out' });
    expect(holidayBtn()).toBeNull();
    expect(vacationBtn()).toBeNull();
  });

  it('hidden during the delete confirmation of a Clock In', () => {
    renderDraft({ mode: 'adjust', eventId: 42, kind: 'clock_in', kindLabel: 'Clock In', date: '2026-09-14', time24: '07:00' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Clock In' }));
    expect(holidayBtn()).toBeNull();
    expect(vacationBtn()).toBeNull();
  });

  it('absent entirely when the host does not offer the shortcut (no onLeave)', () => {
    render(
      <CorrectionModal
        draft={{ mode: 'insert', userId: 7, kind: 'clock_in', kindLabel: 'Clock In', date: '2026-09-14', time24: '09:00' }}
        tz="America/Chicago"
        onClose={() => {}}
        onSubmit={async () => {}}
      />,
    );
    expect(holidayBtn()).toBeNull();
  });
});

// ── LeaveHoursModal: one editor for both types ──────────────────────────────

describe('LeaveHoursModal — defaults, limits, balance, server errors', () => {
  const hoursInput = () => screen.getByLabelText('Hours') as HTMLInputElement;
  const apply = () => screen.getByRole('button', { name: /^Apply$/ });

  it('Holiday defaults to 8.00 and shows employee + date, no balance line', () => {
    render(<LeaveHoursModal type="holiday" employeeName="Jesse Unger" date="2026-09-14" onClose={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByText('Holiday Hours')).toBeInTheDocument();
    expect(screen.getByText('Jesse Unger')).toBeInTheDocument();
    expect(hoursInput().value).toBe('8.00');
    expect(screen.queryByText(/Available Vacation/)).toBeNull();
    expect(MAX_LEAVE_HOURS).toBe(8);
  });

  it('Vacation defaults to 8.00 and shows the authoritative available balance', () => {
    render(<LeaveHoursModal type="vacation" employeeName="Jesse Unger" date="2026-09-14" availableBalance={32} onClose={() => {}} onSubmit={async () => {}} />);
    expect(screen.getByText('Vacation Hours')).toBeInTheDocument();
    expect(hoursInput().value).toBe('8.00');
    expect(screen.getByText('Available Vacation: 32.00 hours')).toBeInTheDocument();
  });

  it('Holiday UI prevents more than 8.00 and zero', () => {
    render(<LeaveHoursModal type="holiday" employeeName="J" date="2026-09-14" onClose={() => {}} onSubmit={async () => {}} />);
    fireEvent.change(hoursInput(), { target: { value: '8.5' } });
    expect(apply()).toBeDisabled();
    expect(screen.getByText(/cannot exceed 8\.00/)).toBeInTheDocument();
    fireEvent.change(hoursInput(), { target: { value: '0' } });
    expect(apply()).toBeDisabled();
    fireEvent.change(hoursInput(), { target: { value: '6' } });
    expect(apply()).toBeEnabled();
  });

  it('Vacation UI prevents more than 8.00 AND more than the available balance', () => {
    render(<LeaveHoursModal type="vacation" employeeName="J" date="2026-09-14" availableBalance={3.5} onClose={() => {}} onSubmit={async () => {}} />);
    // Default 8.00 exceeds the 3.5 available → blocked until lowered.
    expect(apply()).toBeDisabled();
    expect(screen.getByText(/exceeds the available vacation balance/)).toBeInTheDocument();
    fireEvent.change(hoursInput(), { target: { value: '3.5' } });
    expect(apply()).toBeEnabled();
    fireEvent.change(hoursInput(), { target: { value: '9' } });
    expect(apply()).toBeDisabled();
  });

  it('submits the entered hours and surfaces a backend validation error verbatim', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError('Insufficient vacation balance: 6 requested, 2 available.', 422);
    });
    render(<LeaveHoursModal type="vacation" employeeName="J" date="2026-09-14" availableBalance={32} onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(hoursInput(), { target: { value: '6' } });
    fireEvent.click(apply());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(6));
    expect(await screen.findByText('Insufficient vacation balance: 6 requested, 2 available.')).toBeInTheDocument();
  });

  it('editing an existing entry preloads its hours and offers Delete', async () => {
    const onDelete = vi.fn(async () => {});
    render(
      <LeaveHoursModal type="vacation" employeeName="J" date="2026-09-14" availableBalance={32} existing={{ id: 55, hours: 4 }} onClose={() => {}} onSubmit={async () => {}} onDelete={onDelete} />,
    );
    expect(hoursInput().value).toBe('4.00');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Vacation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });
});

// ── Time Review: badges, sub-row, click-to-edit, refresh ───────────────────

describe('Time Review — leave badges and sub-row', () => {
  it('a mixed worked + vacation day shows the normal punch row AND a "Vacation 4:00" sub-row', async () => {
    await setup([workedDay({ leave_entries: [leave(55, 'vacation', 4)], vacation_seconds: 14400, total_paid_seconds: 19800 + 14400, flags: ['leave'] })]);

    // Real punches intact in the punch cells.
    expect(screen.getByRole('button', { name: '7:00 AM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1:00 PM' })).toBeInTheDocument();
    // Paid / Total Worked keep their timekeeping meaning.
    expect(screen.getAllByText('5:30').length).toBeGreaterThan(0);
    // The leave badge sits in its own sub-row, not in a punch cell.
    const badge = screen.getByRole('button', { name: 'Vacation 4:00' });
    expect(badge.closest('tr')).not.toBe(screen.getByRole('button', { name: '7:00 AM' }).closest('tr'));
  });

  it('a leave-only date shows the "Holiday 8:00" badge with no fabricated punches', async () => {
    await setup([day('2026-09-14', {}, { leave_entries: [leave(56, 'holiday', 8)], holiday_seconds: 28800, total_paid_seconds: 28800, flags: ['leave'] })]);

    expect(screen.getByRole('button', { name: 'Holiday 8:00' })).toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}:\d{2} (AM|PM)/)).toBeNull();
  });

  it('Vacation and Holiday on the same date render as two independent badges', async () => {
    await setup([day('2026-09-14', {}, { leave_entries: [leave(55, 'vacation', 4), leave(56, 'holiday', 8)], vacation_seconds: 14400, holiday_seconds: 28800, total_paid_seconds: 43200 })]);
    expect(screen.getByRole('button', { name: 'Vacation 4:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Holiday 8:00' })).toBeInTheDocument();
  });

  it('totals cards show Vacation, Holiday, Other Paid Leave and Total Paid separately from Paid worked', async () => {
    // Total Paid = Paid worked + Vacation + Holiday + Other Paid Leave (5:30 + 4:00 + 8:00 + 1:00).
    await setup([workedDay()], {
      paid_seconds: 19800, gross_seconds: 21600, vacation_seconds: 14400, holiday_seconds: 28800,
      other_paid_leave_seconds: 3600, total_paid_seconds: 19800 + 14400 + 28800 + 3600,
    });
    const card = (label: string) => screen.getByText(label).parentElement as HTMLElement;
    expect(within(card('Vacation')).getByText('4:00')).toBeInTheDocument();
    expect(within(card('Holiday')).getByText('8:00')).toBeInTheDocument();
    expect(within(card('Other Paid Leave')).getByText('1:00')).toBeInTheDocument();
    expect(within(card('Total Paid')).getByText('18:30')).toBeInTheDocument();
    expect(screen.getByText('Paid worked + Vacation + Holiday + Other paid leave')).toBeInTheDocument();
    // Paid (worked) stays 5:30 in its own card — leave never inflates it.
    expect(screen.getAllByText('5:30').length).toBeGreaterThan(0);
  });

  it('clicking the badge opens the editor for that entry; Apply updates and refetches', async () => {
    const user = userEvent.setup();
    await setup([workedDay({ leave_entries: [leave(55, 'vacation', 4)], vacation_seconds: 14400 })]);
    const before = fetchCount;

    await user.click(screen.getByRole('button', { name: 'Vacation 4:00' }));
    const dialog = await screen.findByRole('dialog', { name: 'Vacation Hours' });
    expect((within(dialog).getByLabelText('Hours') as HTMLInputElement).value).toBe('4.00');
    expect(within(dialog).getByText('Available Vacation: 32.00 hours')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Hours'), { target: { value: '6' } });
    await user.click(within(dialog).getByRole('button', { name: /^Apply$/ }));

    await waitFor(() => expect(updateLeaveMock).toHaveBeenCalledWith(55, 6));
    await waitFor(() => expect(fetchCount).toBeGreaterThan(before));
  });

  it('deleting from the editor calls the delete endpoint and refetches', async () => {
    const user = userEvent.setup();
    await setup([day('2026-09-14', {}, { leave_entries: [leave(56, 'holiday', 8)], holiday_seconds: 28800 })]);
    const before = fetchCount;

    await user.click(screen.getByRole('button', { name: 'Holiday 8:00' }));
    const dialog = await screen.findByRole('dialog', { name: 'Holiday Hours' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete Holiday' }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => expect(deleteLeaveMock).toHaveBeenCalled());
    expect(deleteLeaveMock.mock.calls[0][0]).toBe(56);
    await waitFor(() => expect(fetchCount).toBeGreaterThan(before));
  });

  it('Add time → + Holiday → 8.00 → Apply creates a holiday entry for that employee/date and refetches', async () => {
    const user = userEvent.setup();
    await setup([day('2026-09-14', {})]);
    const before = fetchCount;

    await user.click(screen.getByRole('button', { name: /Add time/ }));
    await user.click(await screen.findByRole('button', { name: /\+ Holiday/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Holiday Hours' });
    expect((within(dialog).getByLabelText('Hours') as HTMLInputElement).value).toBe('8.00');
    await user.click(within(dialog).getByRole('button', { name: /^Apply$/ }));

    await waitFor(() => expect(createLeaveMock).toHaveBeenCalledWith({ user_id: 7, type: 'holiday', date: '2026-09-14', hours: 8 }));
    await waitFor(() => expect(fetchCount).toBeGreaterThan(before));
    expect(applyCorrectionMock).not.toHaveBeenCalled(); // never a punch
  });

  it('Adjust Clock In → + Vacation → balance loaded from the API → Apply creates vacation', async () => {
    const user = userEvent.setup();
    await setup([workedDay()]);

    await user.click(screen.getByRole('button', { name: '7:00 AM' })); // adjust Clock In
    await user.click(await screen.findByRole('button', { name: /\+ Vacation/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Vacation Hours' });
    expect(await within(dialog).findByText('Available Vacation: 32.00 hours')).toBeInTheDocument();
    expect(balanceMock).toHaveBeenCalledWith(7);

    fireEvent.change(within(dialog).getByLabelText('Hours'), { target: { value: '4' } });
    await user.click(within(dialog).getByRole('button', { name: /^Apply$/ }));
    await waitFor(() => expect(createLeaveMock).toHaveBeenCalledWith({ user_id: 7, type: 'vacation', date: '2026-09-14', hours: 4 }));
  });

  it('a backend rejection is shown in the editor and nothing is refetched', async () => {
    const user = userEvent.setup();
    createLeaveMock.mockRejectedValueOnce(new ApiError('Hours cannot exceed 8.00 per day.', 422));
    await setup([day('2026-09-14', {})]);
    const before = fetchCount;

    await user.click(screen.getByRole('button', { name: /Add time/ }));
    await user.click(await screen.findByRole('button', { name: /\+ Holiday/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Holiday Hours' });
    await user.click(within(dialog).getByRole('button', { name: /^Apply$/ }));

    expect(await within(dialog).findByText('Hours cannot exceed 8.00 per day.')).toBeInTheDocument();
    expect(fetchCount).toBe(before);
  });
});
