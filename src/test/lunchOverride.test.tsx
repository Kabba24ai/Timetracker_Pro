import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import { OVERRIDE_CONFIRM_BODY, OVERRIDE_CONFIRM_TITLE } from '../components/admin/LunchOverrideModal';
import type { CorrectionPayload, DayPosition, LunchOverrideInfo, LunchOverridePayload, PositionKey, TimeReview, TimeReviewDay } from '../lib/admin';

// Missing Lunch / Pending detail + case-by-case Lunch Override in Time Review.
// The REAL grid is rendered; the admin API layer is mocked at the function level.

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ timezone: 'America/Chicago' }),
}));

const applyCorrectionMock = vi.fn(async (_p: CorrectionPayload) => {});
const applyLunchOverrideMock = vi.fn(async (_p: LunchOverridePayload) => {});
const removeLunchOverrideMock = vi.fn(async (_id: number, _r?: unknown) => {});
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
    applyLunchOverride: (p: LunchOverridePayload) => applyLunchOverrideMock(p),
    removeLunchOverride: (id: number, r?: unknown) => removeLunchOverrideMock(id, r),
  };
});

const payroll = {
  paid_seconds: 0, paid_hours: 0, unpaid_seconds: 0, unpaid_hours: 0, gross_seconds: 0, gross_hours: 0,
  lunch_seconds: 0, other_break_seconds: 0, shift_count: 1, open_shift_count: 0, has_open_shift: false,
};

let nextEventId = 100;
const pos = (at: string): DayPosition => ({ event_id: nextEventId++, at, source: 'employee' });

function day(date: string, weekday: string, positions: Partial<Record<PositionKey, DayPosition>>, extra: Partial<TimeReviewDay> = {}): TimeReviewDay {
  const filled = Object.values(positions).filter(Boolean).length;
  return {
    ...payroll,
    date,
    day_of_week: 1,
    weekday_label: weekday,
    day_label: `${weekday}, Aug ${Number(date.slice(8))}`,
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
    flags: [],
    events: [],
    ...extra,
  };
}

// Jesse: Clock In 6:55 AM, Clock Out 12:05 PM Chicago (11:55Z / 17:05Z), NO lunch, lunch required.
const IN = '2026-08-31T11:55:00+00:00';
const OUT = '2026-08-31T17:05:00+00:00';

const missingLunchDay = () =>
  day('2026-08-31', 'Mon', { clock_in: pos(IN), clock_out: pos(OUT) }, {
    pending: true,
    pending_reasons: ['Missing Lunch'],
    pending_reason_codes: ['missing_lunch'],
    lunch_missing: true,
    flags: ['pending'],
  });

const OVERRIDE: LunchOverrideInfo = {
  id: 55, user_id: 7, clock_in_event_id: 100, work_date: '2026-08-31', shift_id: 10,
  applied_at: '2026-09-02T15:00:00+00:00', applied_by: { id: 1, full_name: 'Gary Jezorski' },
  reason_code: null, reason: null, active: true, removed_at: null, removed_by: null, removal_reason_code: null, removal_reason: null,
};

const overriddenDay = () =>
  day('2026-08-31', 'Mon', { clock_in: pos(IN), clock_out: pos(OUT) }, {
    lunch_override: OVERRIDE,
    flags: ['lunch_override'],
    paid_seconds: 18600, gross_seconds: 18600, lunch_seconds: 0,
  });

function buildReview(days: TimeReviewDay[]): TimeReview {
  const lunch = days.reduce((s, d) => s + d.lunch_seconds, 0);
  return {
    employee: { id: 7, full_name: 'Jesse Unger' },
    period: { from: '2026-08-30', to: '2026-09-12', timezone: 'America/Chicago', label: null },
    totals: { ...payroll, lunch_seconds: lunch, paid_seconds: days.reduce((s, d) => s + d.paid_seconds, 0) },
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
  applyLunchOverrideMock.mockClear();
  removeLunchOverrideMock.mockClear();
  nextEventId = 100;
  fetchCount = 0;
});

describe('Time Review — Missing Lunch / Pending is shown on the exact row', () => {
  it('renders Missing Lunch / Pending in the Lunch area, with the real Clock In/Out intact', async () => {
    await setup([missingLunchDay()]);

    const badge = await screen.findByRole('button', { name: 'Missing Lunch / Pending' });
    expect(badge).toBeInTheDocument();
    // The punches are truthful and untouched.
    expect(screen.getByRole('button', { name: '6:55 AM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12:05 PM' })).toBeInTheDocument();
    // Not the generic Clock Out variant.
    expect(screen.queryByRole('button', { name: 'Missing / Pending' })).toBeNull();
  });

  it('is clickable and opens Resolve Missing Lunch with both legitimate options', async () => {
    const user = userEvent.setup();
    await setup([missingLunchDay()]);

    await user.click(await screen.findByRole('button', { name: 'Missing Lunch / Pending' }));

    const dialog = screen.getByRole('dialog', { name: /Resolve Missing Lunch/ });
    expect(within(dialog).getByText('Add Lunch')).toBeInTheDocument();
    expect(within(dialog).getByText('Override Lunch Requirement')).toBeInTheDocument();
  });

  it('Add Lunch routes into the EXISTING unified lunch editor (Lunch Out / Lunch In)', async () => {
    const user = userEvent.setup();
    await setup([missingLunchDay()]);
    await user.click(await screen.findByRole('button', { name: 'Missing Lunch / Pending' }));

    await user.click(screen.getByText('Add Lunch'));

    expect(screen.queryByRole('dialog', { name: /Resolve Missing Lunch/ })).toBeNull();
    expect(screen.getByText('Add lunch · Mon, Aug 31')).toBeInTheDocument();
    // The existing editor's TimeFields (aria-labels are prefixed by the field name).
    expect(screen.getByLabelText('Lunch Out Hour')).toBeInTheDocument();
    expect(screen.getByLabelText('Lunch In Hour')).toBeInTheDocument();
    expect(applyLunchOverrideMock).not.toHaveBeenCalled();
  });

  it('Override shows the exact confirmation copy; Cancel changes nothing', async () => {
    const user = userEvent.setup();
    await setup([missingLunchDay()]);
    await user.click(await screen.findByRole('button', { name: 'Missing Lunch / Pending' }));
    await user.click(screen.getByText('Override Lunch Requirement'));

    expect(screen.getByRole('heading', { name: OVERRIDE_CONFIRM_TITLE })).toBeInTheDocument();
    expect(screen.getByText(OVERRIDE_CONFIRM_BODY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Override Lunch' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(applyLunchOverrideMock).not.toHaveBeenCalled();
    expect(applyCorrectionMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: OVERRIDE_CONFIRM_TITLE })).toBeNull();
    expect(screen.getByRole('button', { name: 'Missing Lunch / Pending' })).toBeInTheDocument();
    expect(fetchCount).toBe(1);
  });

  it('Override Lunch posts the override for THIS employee/date, refetches, and the row shows Lunch Override with 0:00 lunch', async () => {
    const user = userEvent.setup();
    await setup([missingLunchDay()]);
    await user.click(await screen.findByRole('button', { name: 'Missing Lunch / Pending' }));
    await user.click(screen.getByText('Override Lunch Requirement'));

    // The refetch after the override returns the authoritative overridden day.
    applyLunchOverrideMock.mockImplementationOnce(async () => {
      reviewResponse = buildReview([overriddenDay()]);
    });
    await user.click(screen.getByRole('button', { name: 'Override Lunch' }));

    expect(applyLunchOverrideMock).toHaveBeenCalledTimes(1);
    // Anchored to the row's Clock In event (id 100 = the first position built), never the date.
    expect(applyLunchOverrideMock.mock.calls[0][0]).toEqual({ user_id: 7, clock_in_event_id: 100 });
    expect(applyCorrectionMock).not.toHaveBeenCalled();

    const badge = await screen.findByRole('button', { name: 'Lunch Override' });
    expect(badge).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Missing Lunch / Pending' })).toBeNull();
    expect(fetchCount).toBe(2);

    // No pretend lunch: punches unchanged, no lunch wall times, Lunch total 0:00.
    expect(screen.getByRole('button', { name: '6:55 AM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12:05 PM' })).toBeInTheDocument();
    expect(screen.queryByText('12:00 PM')).toBeNull();
    expect(screen.queryByText('12:30 PM')).toBeNull();
    const lunchCard = screen.getByText('Lunch').closest('div')!;
    expect(within(lunchCard).getByText('0:00')).toBeInTheDocument();
  });

  it('keeps the Missing Clock Out indicator when both Pending reasons apply', async () => {
    await setup([
      day('2026-08-31', 'Mon', { clock_in: pos(IN) }, {
        pending: true,
        pending_reasons: ['Missing Clock Out', 'Missing Lunch'],
        pending_reason_codes: ['missing_clock_out', 'missing_lunch'],
        lunch_missing: true,
        clock_out_unverified: true,
        events: [{ id: 900, kind: 'pending_close', kind_label: 'Pending (No Clock Out)', raw_at: OUT, effective_at: OUT, source: 'system', actor_id: null, correction_type: null, corrects_event_id: null, reason: null, shift_id: 10, break_id: null, metadata: null, created_at: null, superseded: false }],
        flags: ['pending'],
      }),
    ]);

    expect(await screen.findByRole('button', { name: 'Missing Lunch / Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Missing / Pending' })).toBeInTheDocument();
  });

  it('after only the lunch is overridden, Missing Clock Out still shows', async () => {
    await setup([
      day('2026-08-31', 'Mon', { clock_in: pos(IN) }, {
        pending: true,
        pending_reasons: ['Missing Clock Out'],
        pending_reason_codes: ['missing_clock_out'],
        clock_out_unverified: true,
        lunch_override: OVERRIDE,
        flags: ['pending', 'lunch_override'],
      }),
    ]);

    expect(await screen.findByRole('button', { name: 'Lunch Override' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Missing / Pending' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Missing Lunch / Pending' })).toBeNull();
  });
});

describe('Time Review — Lunch Override indicator', () => {
  it('shows who applied it and offers reversal; Remove posts the removal and refetches', async () => {
    const user = userEvent.setup();
    await setup([overriddenDay()]);

    await user.click(await screen.findByRole('button', { name: 'Lunch Override' }));
    const dialog = screen.getByRole('dialog', { name: /Lunch Override/ });
    expect(within(dialog).getByText('Gary Jezorski')).toBeInTheDocument();
    expect(within(dialog).getByText(/No lunch time was added or deducted/)).toBeInTheDocument();

    removeLunchOverrideMock.mockImplementationOnce(async () => {
      reviewResponse = buildReview([missingLunchDay()]);
    });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Lunch Override' }));

    expect(removeLunchOverrideMock).toHaveBeenCalledTimes(1);
    expect(removeLunchOverrideMock.mock.calls[0][0]).toBe(55);
    // Requirement re-applies → Missing Lunch / Pending returns.
    expect(await screen.findByRole('button', { name: 'Missing Lunch / Pending' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lunch Override' })).toBeNull();
  });

  it('a recorded lunch always renders its real times — never an indicator', async () => {
    await setup([
      day('2026-08-31', 'Mon', {
        clock_in: pos(IN),
        lunch_start: pos('2026-08-31T17:00:00+00:00'),
        lunch_end: pos('2026-08-31T17:30:00+00:00'),
        clock_out: pos('2026-08-31T21:00:00+00:00'),
      }, { lunch_seconds: 1800 }),
    ]);

    expect(await screen.findByRole('button', { name: '12:00 PM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12:30 PM' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Missing Lunch / Pending' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lunch Override' })).toBeNull();
  });
});
