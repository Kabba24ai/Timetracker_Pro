import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const server = vi.hoisted(() => ({ calls: [] as string[], periods: null as unknown }));

// The canonical list the server resolver returns (newest first). Deliberately
// includes a December→January period so the label contract is exercised.
const PERIODS = [
  { from: '2026-09-13', to: '2026-09-26', label: 'Sep 13 – Sep 26, 2026', is_current: true, is_previous: false },
  { from: '2026-08-30', to: '2026-09-12', label: 'Aug 30 – Sep 12, 2026', is_current: false, is_previous: true },
  { from: '2026-08-16', to: '2026-08-29', label: 'Aug 16 – Aug 29, 2026', is_current: false, is_previous: false },
  { from: '2026-08-02', to: '2026-08-15', label: 'Aug 2 – Aug 15, 2026', is_current: false, is_previous: false },
  { from: '2025-12-28', to: '2026-01-10', label: 'Dec 28, 2025 – Jan 10, 2026', is_current: false, is_previous: false },
];

const review = (from: string, to: string) => ({
  success: true,
  employee: { id: 1, full_name: 'Ada Clockwell' },
  period: { from, to, timezone: 'America/Chicago', label: `${from} – ${to}` },
  totals: {
    paid_seconds: 3600, paid_hours: 1, unpaid_seconds: 0, unpaid_hours: 0,
    gross_seconds: 3600, gross_hours: 1, lunch_seconds: 0, other_break_seconds: 0,
    shift_count: 1, open_shift_count: 0, has_open_shift: false,
  },
  days: [
    {
      date: from, day_of_week: 0, weekday_label: 'Sun', day_label: from, day_type: 'Working Day',
      schedule: null, excused: null, positions: {}, events: [], leave: [],
      paid_seconds: 3600, paid_hours: 1, unpaid_seconds: 0, unpaid_hours: 0,
      gross_seconds: 3600, gross_hours: 1, lunch_seconds: 0, other_break_seconds: 0,
      shift_count: 1, open_shift_count: 0, has_open_shift: false,
    },
  ],
});

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
    firstError() {
      return this.message;
    }
  }
  const api = {
    getToken: () => 'tok',
    setToken: () => {},
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path.startsWith('/admin/pay-periods')) {
        if (server.periods === 'fail') throw new ApiError('nope', 500);
        return { success: true, timezone: 'America/Chicago', data: server.periods ?? PERIODS };
      }
      if (path.startsWith('/admin/employees') && path.includes('/time-review')) {
        const u = new URLSearchParams(path.split('?')[1] ?? '');
        return review(u.get('from') ?? '2026-09-13', u.get('to') ?? '2026-09-26');
      }
      if (path.startsWith('/auth/login-users')) {
        return {
          success: true,
          data: [
            { id: 1, full_name: 'Ada Clockwell' },
            { id: 2, full_name: 'Bo Vance' },
          ],
        };
      }
      return { success: true, data: [] };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      return { success: true };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ timezone: 'America/Chicago', isAdmin: true, employee: null, signOut: vi.fn() }),
}));

import { fetchPayPeriods } from '../lib/admin';
import TimeReviewV2 from '../components/admin/TimeReviewV2';

beforeEach(() => {
  server.calls = [];
  server.periods = null;
});

const reviewCalls = () => server.calls.filter((c) => c.includes('/time-review'));
const lastReview = () => reviewCalls()[reviewCalls().length - 1];

const refreshButton = () => screen.getByRole('button', { name: /Refresh/i });
/** Refresh is disabled while a load is in flight; wait for the response to land. */
const settled = () => vi.waitFor(() => expect(refreshButton()).not.toBeDisabled());

/** Mount with an employee already selected, then switch to Custom. */
const openCustom = async () => {
  render(<TimeReviewV2 initialUserId={1} />);
  await vi.waitFor(() => expect(server.calls.some((c) => c.startsWith('GET /admin/pay-periods'))).toBe(true));
  await screen.findByText('Custom');
  fireEvent.click(screen.getByText('Custom'));
  return screen.findByLabelText('Pay Period');
};

// ── The API client ─────────────────────────────────────────────────────────

describe('fetchPayPeriods()', () => {
  it('asks the canonical endpoint for roughly a year of history', async () => {
    const list = await fetchPayPeriods();
    expect(server.calls[0]).toBe('GET /admin/pay-periods?count=26');
    expect(list).toEqual(PERIODS);
  });

  it('passes an explicit count through', async () => {
    await fetchPayPeriods(5);
    expect(server.calls[0]).toContain('count=5');
  });
});

// ── Current / Previous are untouched ───────────────────────────────────────

describe('Current and Previous period behaviour is unchanged', () => {
  it('loads Current with the canonical selector, not dates', async () => {
    render(<TimeReviewV2 initialUserId={1} />);
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    expect(lastReview()).toContain('period=current');
    expect(lastReview()).not.toContain('from=');
  });

  it('loads Previous with the canonical selector, not dates', async () => {
    render(<TimeReviewV2 initialUserId={1} />);
    await screen.findByText('previous period');
    fireEvent.click(screen.getByText('previous period'));
    await vi.waitFor(() => expect(lastReview()).toContain('period=previous'));
    expect(lastReview()).not.toContain('from=');
  });

  it('shows no Pay Period picker outside Custom', async () => {
    render(<TimeReviewV2 initialUserId={1} />);
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    expect(screen.queryByLabelText('Pay Period')).not.toBeInTheDocument();
  });
});

// ── Custom exposes the canonical history ───────────────────────────────────

describe('Custom exposes historical pay periods', () => {
  it('lists every canonical period, newest first, with Current/Previous marked', async () => {
    const select = await openCustom();
    const options = within(select as HTMLElement).getAllByRole('option');

    expect(options[0]).toHaveTextContent('Sep 13 – Sep 26, 2026 — Current');
    expect(options[1]).toHaveTextContent('Aug 30 – Sep 12, 2026 — Previous');
    expect(options[2]).toHaveTextContent('Aug 16 – Aug 29, 2026');
    // The manual escape hatch is last.
    expect(options[options.length - 1]).toHaveTextContent('Custom Date Range…');
    expect(options).toHaveLength(PERIODS.length + 1);
  });

  it('labels a December→January period with both years', async () => {
    const select = await openCustom();
    expect(within(select as HTMLElement).getByText(/Dec 28, 2025 – Jan 10, 2026/)).toBeInTheDocument();
  });

  it('opens on the period the current dates belong to, not a blank range', async () => {
    const select = await openCustom();
    // Current period was loaded first, so Custom opens on that same period.
    expect(select).toHaveValue('2026-09-13');
    // …and the manual date inputs stay hidden until explicitly requested.
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });

  it('hides the date inputs while an established period is selected', async () => {
    const select = await openCustom();
    fireEvent.change(select as HTMLElement, { target: { value: '2026-08-02' } });
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
  });
});

// ── Selecting a period drives the EXISTING request path ────────────────────

describe('selecting a historical period', () => {
  it('sends that period’s exact boundaries to the existing Time Review query', async () => {
    const select = await openCustom();
    server.calls = [];

    fireEvent.change(select as HTMLElement, { target: { value: '2026-08-02' } });

    await vi.waitFor(() => expect(reviewCalls().length).toBe(1));
    expect(lastReview()).toContain('from=2026-08-02');
    expect(lastReview()).toContain('to=2026-08-15');
    expect(lastReview()).not.toContain('period=');
  });

  it('works for a period crossing a year boundary', async () => {
    const select = await openCustom();
    server.calls = [];

    fireEvent.change(select as HTMLElement, { target: { value: '2025-12-28' } });

    await vi.waitFor(() => expect(reviewCalls().length).toBe(1));
    expect(lastReview()).toContain('from=2025-12-28');
    expect(lastReview()).toContain('to=2026-01-10');
  });

  it('Refresh reloads the selected historical period, not the current one', async () => {
    const select = await openCustom();
    fireEvent.change(select as HTMLElement, { target: { value: '2026-08-16' } });
    await vi.waitFor(() => expect(lastReview()).toContain('from=2026-08-16'));
    await settled();

    server.calls = [];
    fireEvent.click(refreshButton());

    await vi.waitFor(() => expect(reviewCalls().length).toBe(1));
    expect(lastReview()).toContain('from=2026-08-16');
    expect(lastReview()).toContain('to=2026-08-29');
    expect(lastReview()).not.toContain('period=current');
  });

  it('keeps the selected period when the employee changes', async () => {
    const select = await openCustom();
    fireEvent.change(select as HTMLElement, { target: { value: '2026-08-16' } });
    await vi.waitFor(() => expect(lastReview()).toContain('from=2026-08-16'));
    await settled();

    server.calls = [];
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: '2' } });

    // Still the same period — switching employee does not reset it to Current.
    expect(select).toHaveValue('2026-08-16');
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    expect(lastReview()).toContain('/admin/employees/2/time-review');
    expect(lastReview()).toContain('from=2026-08-16');
    expect(lastReview()).toContain('to=2026-08-29');
    expect(lastReview()).not.toContain('period=');
  });

  it('exports CSV named for the selected historical period', async () => {
    const blobs: Blob[] = [];
    const names: string[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:x';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });

    const select = await openCustom();
    fireEvent.change(select as HTMLElement, { target: { value: '2026-08-02' } });
    await vi.waitFor(() => expect(lastReview()).toContain('from=2026-08-02'));
    await settled();

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    await vi.waitFor(() => expect(names).toHaveLength(1));
    expect(names[0]).toBe('time-review_Ada Clockwell_2026-08-02_2026-08-15.csv');
  });
});

// ── The manual range is preserved ──────────────────────────────────────────

describe('Custom Date Range… preserves the manual behaviour', () => {
  it('reveals the From/To inputs without changing the loaded period', async () => {
    const select = await openCustom();
    server.calls = [];

    fireEvent.change(select as HTMLElement, { target: { value: 'manual' } });

    expect(await screen.findByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    // Choosing the manual option is not itself a query.
    expect(reviewCalls()).toHaveLength(0);
  });

  it('loads an arbitrary hand-entered range on Refresh', async () => {
    const select = await openCustom();
    fireEvent.change(select as HTMLElement, { target: { value: 'manual' } });

    fireEvent.change(await screen.findByLabelText('From'), { target: { value: '2026-07-07' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-09' } });

    server.calls = [];
    fireEvent.click(refreshButton());

    await vi.waitFor(() => expect(reviewCalls().length).toBe(1));
    expect(lastReview()).toContain('from=2026-07-07');
    expect(lastReview()).toContain('to=2026-07-09');
  });
});

// ── Degradation + drill-down ───────────────────────────────────────────────

describe('robustness', () => {
  it('falls back to the manual range when the period list is unavailable', async () => {
    server.periods = 'fail';
    render(<TimeReviewV2 initialUserId={1} />);
    await screen.findByText('Custom');
    fireEvent.click(screen.getByText('Custom'));

    expect(await screen.findByLabelText('From')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pay Period')).not.toBeInTheDocument();
    // A missing convenience list is never reported as a Time Review failure.
    expect(screen.queryByText(/Could not load/i)).not.toBeInTheDocument();
  });

  it('a Pay Period Summary drill-down keeps its exact dates and names the period', async () => {
    render(<TimeReviewV2 initialUserId={1} initialFrom="2026-08-16" initialTo="2026-08-29" />);

    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    // The drill-down range is used verbatim…
    expect(reviewCalls()[0]).toContain('from=2026-08-16');
    expect(reviewCalls()[0]).toContain('to=2026-08-29');
    // …and once the list arrives the picker names that established period.
    expect(await screen.findByLabelText('Pay Period')).toHaveValue('2026-08-16');
  });

  it('a drill-down on a non-period range shows the manual inputs', async () => {
    render(<TimeReviewV2 initialUserId={1} initialFrom="2026-08-20" initialTo="2026-08-22" />);
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));

    expect(await screen.findByLabelText('From')).toHaveValue('2026-08-20');
    expect(screen.getByLabelText('To')).toHaveValue('2026-08-22');
  });
});
