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

/** Mount with an employee already selected, let Current land, then switch to Custom. */
const openCustom = async () => {
  render(<TimeReviewV2 initialUserId={1} />);
  await vi.waitFor(() => expect(server.calls.some((c) => c.startsWith('GET /admin/pay-periods'))).toBe(true));
  await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
  await settled();
  fireEvent.click(screen.getByText('Custom'));
  return screen.findByLabelText('Pay Period');
};

const dateInputs = () => document.querySelectorAll('input[type="date"]');

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
    await screen.findByText('Previous Period');
    fireEvent.click(screen.getByText('Previous Period'));
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
  it('lists every canonical period, newest first, with Current/Previous marked — and nothing else', async () => {
    const select = await openCustom();
    const options = within(select as HTMLElement).getAllByRole('option');

    expect(options.map((o) => o.textContent)).toEqual([
      'Sep 13 – Sep 26, 2026 — Current',
      'Aug 30 – Sep 12, 2026 — Previous',
      'Aug 16 – Aug 29, 2026',
      'Aug 2 – Aug 15, 2026',
      'Dec 28, 2025 – Jan 10, 2026',
    ]);
  });

  it('labels a December→January period with both years', async () => {
    const select = await openCustom();
    expect(within(select as HTMLElement).getByText(/Dec 28, 2025 – Jan 10, 2026/)).toBeInTheDocument();
  });

  it('opens on the period that was just showing', async () => {
    const select = await openCustom();
    // Current period was loaded first, so Custom opens on that same period.
    expect(select).toHaveValue('2026-09-13');
  });
});

// ── No manual dates, anywhere ──────────────────────────────────────────────

describe('there is no manual date entry', () => {
  it('has no Custom Date Range option and no date inputs in any mode', async () => {
    const select = await openCustom();
    expect(within(select as HTMLElement).queryByText(/Custom Date Range/)).not.toBeInTheDocument();
    expect(dateInputs()).toHaveLength(0);
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Previous Period'));
    expect(dateInputs()).toHaveLength(0);
    fireEvent.click(screen.getByText('Current Period'));
    expect(dateInputs()).toHaveLength(0);
  });

  it('ignores a value that is not an established period', async () => {
    const select = await openCustom();
    await vi.waitFor(() => expect(lastReview()).toContain('from=2026-09-13'));
    await settled();
    server.calls = [];

    fireEvent.change(select as HTMLElement, { target: { value: '2026-07-07' } });

    expect(reviewCalls()).toHaveLength(0);
    expect(select).toHaveValue('2026-09-13');
  });
});

// ── Selecting a period drives the EXISTING request path ────────────────────

describe('selecting a historical period', () => {
  it('sends that period’s exact boundaries to the existing Time Review query', async () => {
    const select = await openCustom();
    await settled();
    server.calls = [];

    fireEvent.change(select as HTMLElement, { target: { value: '2026-08-02' } });

    await vi.waitFor(() => expect(reviewCalls().length).toBe(1));
    expect(lastReview()).toContain('from=2026-08-02');
    expect(lastReview()).toContain('to=2026-08-15');
    expect(lastReview()).not.toContain('period=');
  });

  it('works for a period crossing a year boundary', async () => {
    const select = await openCustom();
    await settled();
    server.calls = [];

    fireEvent.change(select as HTMLElement, { target: { value: '2025-12-28' } });

    await vi.waitFor(() => expect(reviewCalls().length).toBe(1));
    expect(lastReview()).toContain('from=2025-12-28');
    expect(lastReview()).toContain('to=2026-01-10');
    expect(await screen.findByTestId('period-heading')).toHaveTextContent(/^Dec 28, 2025 – Jan 10, 2026/);
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
    expect(select).toHaveValue('2026-08-16');
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

// ── Degradation: an error with Retry, never a manual fallback ──────────────

describe('when the period list is unavailable', () => {
  const openCustomWithoutList = async () => {
    server.periods = 'fail';
    render(<TimeReviewV2 initialUserId={1} />);
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    await settled();
    server.calls = [];
    fireEvent.click(screen.getByText('Custom'));
  };

  it('shows an error with Retry — no date inputs, and no Time Review failure', async () => {
    await openCustomWithoutList();

    expect(await screen.findByRole('alert')).toHaveTextContent('Pay periods could not be loaded.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Pay Period')).not.toBeInTheDocument();
    expect(dateInputs()).toHaveLength(0);
    expect(screen.queryByText(/Could not load the time review/i)).not.toBeInTheDocument();
  });

  it('never substitutes another period: nothing is queried and nothing is shown until one is picked', async () => {
    await openCustomWithoutList();
    await screen.findByRole('alert');

    expect(reviewCalls()).toHaveLength(0);
    expect(screen.queryByTestId('period-heading')).not.toBeInTheDocument();
    expect(screen.getByText(/Select a pay period to review/i)).toBeInTheDocument();
  });

  it('Retry loads the established periods and a pick loads that period', async () => {
    await openCustomWithoutList();
    await screen.findByRole('alert');

    server.periods = null;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    const select = (await screen.findByLabelText('Pay Period')) as HTMLSelectElement;
    expect(select).toHaveValue('');
    expect(select.options[select.selectedIndex].textContent).toBe('Select a pay period…');

    fireEvent.change(select, { target: { value: '2026-08-16' } });
    await vi.waitFor(() => expect(lastReview()).toContain('from=2026-08-16'));
  });
});

// ── Controlled by the dashboard's shared selection ─────────────────────────

describe('a controlled selection (the dashboard shares one with Pay Periods)', () => {
  it('loads exactly the supplied established period and names it in the picker', async () => {
    render(<TimeReviewV2 initialUserId={1} selection={{ mode: 'custom', from: '2026-08-16', to: '2026-08-29' }} />);

    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));
    expect(reviewCalls()[0]).toContain('from=2026-08-16');
    expect(reviewCalls()[0]).toContain('to=2026-08-29');
    expect(await screen.findByLabelText('Pay Period')).toHaveValue('2026-08-16');
  });

  it('reports every change instead of keeping it to itself', async () => {
    const onSelectionChange = vi.fn();
    render(
      <TimeReviewV2
        initialUserId={1}
        selection={{ mode: 'current', from: '', to: '' }}
        onSelectionChange={onSelectionChange}
      />,
    );
    await vi.waitFor(() => expect(reviewCalls().length).toBeGreaterThan(0));

    fireEvent.click(screen.getByText('Previous Period'));
    expect(onSelectionChange).toHaveBeenCalledWith({ mode: 'previous', from: '', to: '' });
  });
});
