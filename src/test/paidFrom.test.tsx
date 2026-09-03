import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import EmployeeWorkHistory from '../components/history/EmployeeWorkHistory';
import { paidFromAt } from '../lib/admin';
import type { DayPosition, PositionKey, TimeReview, TimeReviewDay } from '../lib/admin';
import type { HistoryReview } from '../lib/history';

// Restrict Paid Time to Shift Start — "Clock In 6:45 AM / Paid from 7:00 AM".
// The REAL grids are rendered; only the fetch functions are mocked. The server's
// canonical paid_start_at is displayed, never computed here.

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ timezone: 'America/Chicago' }),
}));

let reviewResponse: TimeReview;
let historyResponse: HistoryReview;

vi.mock('../lib/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/admin')>();
  return {
    ...actual,
    fetchEmployees: vi.fn(async () => [{ id: 7, full_name: 'Jesse Unger' }]),
    fetchTimeReview: vi.fn(async () => reviewResponse),
  };
});

vi.mock('../lib/history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/history')>();
  return {
    ...actual,
    fetchMyHistory: vi.fn(async () => historyResponse),
  };
});

const payroll = {
  paid_seconds: 34200, paid_hours: 9.5, unpaid_seconds: 1800, unpaid_hours: 0.5, gross_seconds: 36000, gross_hours: 10,
  lunch_seconds: 1800, other_break_seconds: 0, shift_count: 1, open_shift_count: 0, has_open_shift: false,
};

let nextEventId = 100;
const pos = (at: string): DayPosition => ({ event_id: nextEventId++, at, source: 'employee' });

// Monday 2026-09-14, America/Chicago (CDT): punch 6:45 AM = 11:45Z, scheduled 7:00 AM = 12:00Z.
const IN = '2026-09-14T11:45:00+00:00';
const SCHEDULED = '2026-09-14T12:00:00+00:00';
const LUNCH_OUT = '2026-09-14T17:00:00+00:00';
const LUNCH_IN = '2026-09-14T17:30:00+00:00';
const OUT = '2026-09-14T22:00:00+00:00';

function day(positions: Partial<Record<PositionKey, DayPosition>>, paidStartAt: string | null): TimeReviewDay {
  return {
    ...payroll,
    date: '2026-09-14',
    day_of_week: 1,
    weekday_label: 'Mon',
    day_label: 'Mon, Sep 14',
    day_type: 'Working Day',
    schedule: { is_working_day: true, start_at: SCHEDULED, end_at: OUT, source: 'recurring', store_id: null },
    excused: null,
    positions: { clock_in: null, lunch_start: null, lunch_end: null, other_start: null, other_end: null, clock_out: null, ...positions },
    paid_start_at: paidStartAt,
    event_count: Object.values(positions).filter(Boolean).length,
    has_extra_events: false,
    pending: false,
    pending_reasons: [],
    pending_reason_codes: [],
    clock_out_unverified: false,
    lunch_missing: false,
    lunch_override: null,
    flags: [],
    events: [],
  };
}

const fullDay = (paidStartAt: string | null) =>
  day({ clock_in: pos(IN), lunch_start: pos(LUNCH_OUT), lunch_end: pos(LUNCH_IN), clock_out: pos(OUT) }, paidStartAt);

function review(days: TimeReviewDay[]): TimeReview {
  return {
    employee: { id: 7, full_name: 'Jesse Unger' },
    period: { from: '2026-09-13', to: '2026-09-26', timezone: 'America/Chicago', label: null },
    totals: { ...payroll },
    days,
  };
}

beforeEach(() => {
  nextEventId = 100;
});

describe('paidFromAt — pure display helper over the server decision', () => {
  it('returns the paid start only when it is later than the actual Clock In', () => {
    expect(paidFromAt(fullDay(SCHEDULED))).toBe(SCHEDULED);
    expect(paidFromAt(fullDay(null))).toBeNull();
    expect(paidFromAt(fullDay(IN))).toBeNull(); // equal to the punch — nothing to explain
    expect(paidFromAt(day({}, SCHEDULED))).toBeNull(); // no Clock In position at all
  });
});

describe('Time Review — early clock-in shows the real punch and "Paid from" the scheduled start', () => {
  it('renders Clock In 6:45 AM with a "Paid from 7:00 AM" note; Paid stays the canonical 9:30', async () => {
    reviewResponse = review([fullDay(SCHEDULED)]);
    render(<TimeReviewV2 initialUserId={7} />);
    await screen.findByText('All times shown in America/Chicago (tenant timezone).');

    // The punch is untouched and still the editable Clock In.
    expect(await screen.findByRole('button', { name: '6:45 AM' })).toBeInTheDocument();
    expect(screen.getByText('Paid from 7:00 AM')).toBeInTheDocument();
    // Paid is the server figure (7:00 → 5:00 PM minus 30-min lunch).
    expect(screen.getAllByText('9:30').length).toBeGreaterThan(0);
  });

  it('shows no "Paid from" note when paid time began at the actual punch', async () => {
    reviewResponse = review([fullDay(null)]);
    render(<TimeReviewV2 initialUserId={7} />);
    await screen.findByText('All times shown in America/Chicago (tenant timezone).');

    expect(await screen.findByRole('button', { name: '6:45 AM' })).toBeInTheDocument();
    expect(screen.queryByText(/Paid from/)).not.toBeInTheDocument();
  });
});

describe('Employee Work History — the same truthful Clock In + "Paid from" note, read-only', () => {
  const asHistory = (d: TimeReviewDay): HistoryReview => {
    const { events: _events, ...rest } = d;
    void _events;
    return { ...review([]), days: [rest] };
  };

  it('renders Clock In 6:45 AM and "Paid from 7:00 AM" for an early restricted day', async () => {
    historyResponse = asHistory(fullDay(SCHEDULED));
    render(
      <MemoryRouter>
        <EmployeeWorkHistory />
      </MemoryRouter>,
    );

    expect(await screen.findByText('6:45 AM')).toBeInTheDocument();
    expect(screen.getByText('Paid from 7:00 AM')).toBeInTheDocument();
  });

  it('shows no "Paid from" note when unrestricted', async () => {
    historyResponse = asHistory(fullDay(null));
    render(
      <MemoryRouter>
        <EmployeeWorkHistory />
      </MemoryRouter>,
    );

    expect(await screen.findByText('6:45 AM')).toBeInTheDocument();
    expect(screen.queryByText(/Paid from/)).not.toBeInTheDocument();
  });
});
