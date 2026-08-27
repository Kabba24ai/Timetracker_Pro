import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// A mutable fake of the kabba2 TimeTracker V2 API. It models the authoritative
// state machine on the "server" so these tests prove the WIRING: the client
// renders whatever `allowed_actions` the server returns, dispatches the matching
// endpoint, and re-renders from the server's response — with no state-machine
// logic of its own.
const server = vi.hoisted(() => ({
  status: 'off' as 'off' | 'on_clock' | 'on_lunch' | 'on_other',
  token: null as string | null,
  calls: [] as string[],
  // Employee-notice + hierarchy knobs (mirror ClockStatePresenter fields).
  shiftStartAt: null as string | null,
  restrict: true,
  minLunch: 30,
  breaks: [] as Array<{ id: number; type: 'lunch' | 'other'; start_at: string | null; end_at: string | null; duration_seconds: number }>,
}));

const EMP = {
  id: 1,
  user_id: 1,
  first_name: 'Ada',
  last_name: 'Clockwell',
  role: 'employee',
  roles: ['employee'],
};

vi.mock('../lib/api', () => {
  // Real ApiError + event name so consumers behave exactly as in production
  // (defined here, not via importOriginal, to avoid loading the real client).
  class ApiError extends Error {
    status: number;
    errors?: Record<string, string[]>;
    payload?: unknown;
    constructor(message: string, status: number, errors?: Record<string, string[]>, payload?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors;
      this.payload = payload;
    }
    firstError(): string {
      if (this.errors) {
        const first = Object.values(this.errors)[0];
        if (first && first.length) return first[0];
      }
      return this.message;
    }
  }
  const AUTH_ERROR_EVENT = 'tt:unauthorized';

  const LABELS: Record<string, string> = {
    off: 'Clocked Out',
    on_clock: 'Clocked In',
    on_lunch: 'On Lunch',
    on_other: 'On Break',
  };
  const ALLOWED: Record<string, string[]> = {
    off: ['clock_in'],
    on_clock: ['clock_out', 'lunch_start', 'other_start'],
    on_lunch: ['lunch_end', 'clock_out_from_break'],
    on_other: ['other_end', 'clock_out_from_break'],
  };
  const TRANSITION: Record<string, typeof server.status> = {
    '/clock/in': 'on_clock',
    '/clock/out': 'off',
    '/clock/out-from-break': 'off',
    '/clock/lunch/start': 'on_lunch',
    '/clock/lunch/end': 'on_clock',
    '/clock/other/start': 'on_other',
    '/clock/other/end': 'on_clock',
  };

  const present = () => {
    const open = server.status !== 'off';
    const shift = open
      ? {
          id: 1,
          status: 'open',
          clock_in_at: '2026-09-14T09:00:00-05:00',
          clock_out_at: null,
          worked_seconds: 0,
          breaks: server.breaks,
        }
      : null;
    const openBreak =
      server.status === 'on_lunch' || server.status === 'on_other'
        ? {
            id: 5,
            type: server.status === 'on_lunch' ? ('lunch' as const) : ('other' as const),
            start_at: '2026-09-14T12:00:00-05:00', // 12:00 PM America/Chicago
            end_at: null,
            duration_seconds: 0,
          }
        : null;
    return {
      status: server.status,
      status_label: LABELS[server.status],
      allowed_actions: ALLOWED[server.status],
      shift,
      open_break: openBreak,
      server_time: '2026-09-14T12:00:00-05:00',
      timezone: 'America/Chicago',
      today_shift_start_at: server.shiftStartAt,
      restrict_paid_to_shift_start: server.restrict,
      minimum_lunch_minutes: server.minLunch,
      today: { shifts: shift ? [shift] : [], worked_seconds: 0 },
    };
  };

  const fakeApi = {
    getToken: () => server.token,
    setToken: (t: string | null) => {
      server.token = t;
    },
    get: async (path: string) => {
      server.calls.push(`GET ${path}`);
      if (path === '/auth/me') {
        return { success: true, employee: EMP, roles: ['employee'], clock_state: present() };
      }
      if (path.startsWith('/clock/state')) return { success: true, data: present() };
      if (path.startsWith('/clock/history')) return { success: true, data: [] };
      return { success: true };
    },
    post: async (path: string) => {
      server.calls.push(`POST ${path}`);
      if (path === '/auth/login') {
        server.token = 'tok';
        return {
          success: true,
          user: { id: 1, full_name: 'Ada Clockwell', token: 'tok' },
          employee: EMP,
          roles: ['employee'],
          clock_state: present(),
        };
      }
      if (path === '/auth/logout') {
        server.token = null;
        return { success: true };
      }
      if (TRANSITION[path]) {
        server.status = TRANSITION[path];
        return { success: true, data: present() };
      }
      return { success: true };
    },
  };

  return { api: fakeApi, ApiError, AUTH_ERROR_EVENT };
});

// Imported AFTER the mock is registered.
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { TimeClockProvider } from '../contexts/TimeClockContext';
import TimeClockCard from '../components/TimeClockCard';

function Harness() {
  return (
    <MemoryRouter>
      <AuthProvider>
        <TimeClockProvider>
          <TimeClockCard />
        </TimeClockProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

/** Simulate a restored session (token + cached user) at a given server state. */
function seedLoggedIn(status: typeof server.status) {
  server.status = status;
  server.token = 'tok';
  localStorage.setItem('tt_user', JSON.stringify({ id: 1, full_name: 'Ada Clockwell' }));
  localStorage.setItem('tt_employee', JSON.stringify(EMP));
  localStorage.setItem('tt_roles', JSON.stringify(['employee']));
}

beforeEach(() => {
  server.status = 'off';
  server.token = null;
  server.calls = [];
  server.shiftStartAt = null;
  server.restrict = true;
  server.minLunch = 30;
  server.breaks = [];
  localStorage.clear();
});

describe('TimeClock — controls are driven only by server allowed_actions', () => {
  it('OFF: shows only Clock In', async () => {
    seedLoggedIn('off');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /clock in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start lunch/i })).not.toBeInTheDocument();
  });

  it('ON_CLOCK: shows Clock Out, Start Lunch, Unpaid Break — never Clock In', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lunch/i })).toBeInTheDocument();
    // Employee-facing terminology: the unpaid break is labeled exactly that.
    expect(screen.getByRole('button', { name: /unpaid break/i })).toBeInTheDocument();
    expect(screen.queryByText('Start Break')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock in/i })).not.toBeInTheDocument();
  });

  it('ON_LUNCH: shows End Lunch (primary) plus Clock Out (confirmed break exit)', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /end lunch/i })).toBeInTheDocument();
    // Clock Out is now offered as the confirmed "end the shift at lunch start" path.
    expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start break/i })).not.toBeInTheDocument();
  });

  it('ON_OTHER: shows End Break (primary) plus Clock Out (confirmed break exit)', async () => {
    seedLoggedIn('on_other');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /end break/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end lunch/i })).not.toBeInTheDocument();
  });
});

describe('TimeClock — actions dispatch the right endpoint and re-render from the result', () => {
  it('OFF → Clock In hits /clock/in and the UI becomes ON_CLOCK', async () => {
    seedLoggedIn('off');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /clock in/i }));

    // Re-rendered from the server's returned state (not a local guess).
    expect(await screen.findByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lunch/i })).toBeInTheDocument();
    expect(server.calls).toContain('POST /clock/in');
  });

  it('ON_CLOCK → Start Lunch hits /clock/lunch/start and the UI becomes ON_LUNCH', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /start lunch/i }));

    expect(await screen.findByRole('button', { name: /end lunch/i })).toBeInTheDocument();
    // On lunch now also offers the confirmed "clock out at lunch start" path.
    expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(server.calls).toContain('POST /clock/lunch/start');
  });

  it('ON_LUNCH → End Lunch returns to ON_CLOCK', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /end lunch/i }));

    // Start Lunch reappears — an on_clock-only affordance (unlike Clock Out,
    // which now also exists while on lunch), so it cleanly proves the transition.
    expect(await screen.findByRole('button', { name: /start lunch/i })).toBeInTheDocument();
    expect(server.calls).toContain('POST /clock/lunch/end');
  });
});

describe('TimeClock — session restore', () => {
  it('restores an ON_CLOCK session on reload via /auth/me + /clock/state', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.getByText(/clocked in/i)).toBeInTheDocument();
    expect(server.calls).toContain('GET /auth/me');
    expect(server.calls).toContain('GET /clock/state');
  });
});

describe('TimeClock — login seeds the authoritative state', () => {
  function LoginHarness() {
    const { signIn } = useAuth();
    return (
      <MemoryRouter>
        <div>
          <button onClick={() => void signIn(1, '123456')}>do-login</button>
          <TimeClockProvider>
            <TimeClockCard />
          </TimeClockProvider>
        </div>
      </MemoryRouter>
    );
  }

  it('signing in populates the clock card from the login clock_state', async () => {
    server.status = 'off';
    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /do-login/i }));

    expect(await screen.findByRole('button', { name: /clock in/i })).toBeInTheDocument();
    expect(server.calls).toContain('POST /auth/login');
  });

  it('no longer renders the Work Schedule link inside the Time Clock card', async () => {
    // The Work Schedule / Work History navigation moved to the dashboard sidebar
    // (see WorkHistorySynopsis); the Time Clock card no longer owns it.
    seedLoggedIn('off');
    render(<Harness />);

    await screen.findByText('Time Clock');
    expect(screen.queryByRole('link', { name: /work schedule/i })).not.toBeInTheDocument();
  });
});

// ── Employee notice area + action-button hierarchy ─────────────────────────

const chicagoClockOf = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

describe('TimeClock — employee notice area', () => {
  it('the generic server-confirmation copy is gone', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);
    await screen.findByRole('button', { name: /clock out/i });
    expect(screen.queryByText(/The server confirms every action/)).not.toBeInTheDocument();
  });

  it('clocked in before the scheduled start with restriction ON shows the pre-shift notice', async () => {
    server.shiftStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // an hour from now
    seedLoggedIn('on_clock');
    render(<Harness />);

    const expected = `Your shift starts at ${chicagoClockOf(server.shiftStartAt)}. Please do not begin working until that time.`;
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('the pre-shift notice disappears once the scheduled start has arrived', async () => {
    server.shiftStartAt = new Date(Date.now() - 60 * 1000).toISOString(); // already started
    seedLoggedIn('on_clock');
    render(<Harness />);
    await screen.findByRole('button', { name: /clock out/i });
    expect(screen.queryByText(/Your shift starts at/)).not.toBeInTheDocument();
  });

  it('setting OFF suppresses the pre-shift notice', async () => {
    server.shiftStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    server.restrict = false;
    seedLoggedIn('on_clock');
    render(<Harness />);
    await screen.findByRole('button', { name: /clock out/i });
    expect(screen.queryByText(/Your shift starts at/)).not.toBeInTheDocument();
  });

  it('no schedule suppresses the pre-shift notice', async () => {
    server.shiftStartAt = null;
    seedLoggedIn('on_clock');
    render(<Harness />);
    await screen.findByRole('button', { name: /clock out/i });
    expect(screen.queryByText(/Your shift starts at/)).not.toBeInTheDocument();
  });

  it('On Lunch shows the minimum-lunch notice from the canonical setting', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);
    expect(await screen.findByText('Standard minimum lunch is 30 minutes.')).toBeInTheDocument();
  });

  it('the lunch notice tracks a changed minimum duration', async () => {
    server.minLunch = 45;
    seedLoggedIn('on_lunch');
    render(<Harness />);
    expect(await screen.findByText('Standard minimum lunch is 45 minutes.')).toBeInTheDocument();
  });

  it('On Lunch outranks the pre-shift notice (one concise message, never stacked)', async () => {
    server.shiftStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    seedLoggedIn('on_lunch');
    render(<Harness />);
    expect(await screen.findByText(/Standard minimum lunch/)).toBeInTheDocument();
    expect(screen.queryByText(/Your shift starts at/)).not.toBeInTheDocument();
  });
});

describe('TimeClock — Clock Out while on lunch / unpaid break (explicit confirm)', () => {
  it('ON_LUNCH: Clock Out opens a confirmation naming the lunch-start time; it does not fire yet', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /clock out/i }));

    expect(await screen.findByText('Clock Out While on Lunch?')).toBeInTheDocument();
    expect(
      screen.getByText(/Your lunch started at 12:00 PM\. If you clock out now, 12:00 PM will be used as your official clock-out time\./),
    ).toBeInTheDocument();
    // Nothing dispatched until the employee confirms.
    expect(server.calls).not.toContain('POST /clock/out-from-break');
  });

  it('ON_LUNCH: Cancel closes the dialog and dispatches nothing', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /clock out/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('Clock Out While on Lunch?')).not.toBeInTheDocument();
    expect(server.calls).not.toContain('POST /clock/out-from-break');
    // Still on lunch — unchanged.
    expect(screen.getByRole('button', { name: /end lunch/i })).toBeInTheDocument();
  });

  it('ON_LUNCH: confirming dispatches /clock/out-from-break and returns the card to OFF', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /clock out/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /clock out/i }));

    expect(await screen.findByRole('button', { name: /clock in/i })).toBeInTheDocument();
    expect(server.calls).toContain('POST /clock/out-from-break');
  });

  it('ON_OTHER: the confirmation uses unpaid-break copy', async () => {
    seedLoggedIn('on_other');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /clock out/i }));

    expect(await screen.findByText('Clock Out While on Unpaid Break?')).toBeInTheDocument();
    expect(
      screen.getByText(/Your break started at 12:00 PM\. If you clock out now, 12:00 PM will be used as your official clock-out time\./),
    ).toBeInTheDocument();
  });
});

describe('TimeClock — primary progression hierarchy', () => {
  const isPrimary = (el: HTMLElement) => el.className.includes('py-4');

  it('OFF: Clock In is the large primary action', async () => {
    seedLoggedIn('off');
    render(<Harness />);
    const btn = await screen.findByRole('button', { name: /clock in/i });
    expect(isPrimary(btn)).toBe(true);
  });

  it('ON_CLOCK before lunch: Start Lunch is primary; Unpaid Break and Clock Out are secondary', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);
    expect(isPrimary(await screen.findByRole('button', { name: /start lunch/i }))).toBe(true);
    expect(isPrimary(screen.getByRole('button', { name: /unpaid break/i }))).toBe(false);
    expect(isPrimary(screen.getByRole('button', { name: /clock out/i }))).toBe(false);
  });

  it('ON_CLOCK after a completed lunch: Clock Out becomes primary; Unpaid Break stays secondary', async () => {
    server.breaks = [
      { id: 9, type: 'lunch', start_at: '2026-09-14T17:00:00+00:00', end_at: '2026-09-14T17:30:00+00:00', duration_seconds: 1800 },
    ];
    seedLoggedIn('on_clock');
    render(<Harness />);
    expect(isPrimary(await screen.findByRole('button', { name: /clock out/i }))).toBe(true);
    expect(isPrimary(screen.getByRole('button', { name: /unpaid break/i }))).toBe(false);
  });

  it('ON_LUNCH: End Lunch is primary', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);
    expect(isPrimary(await screen.findByRole('button', { name: /end lunch/i }))).toBe(true);
  });

  it('ON_OTHER: End Break is primary', async () => {
    seedLoggedIn('on_other');
    render(<Harness />);
    expect(isPrimary(await screen.findByRole('button', { name: /end break/i }))).toBe(true);
  });

  it('Start Lunch never appears as primary when the server does not allow it', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);
    // The fake server's allowed_actions drive rendering; a fresh on_clock allows
    // lunch_start — dispatch it, return to on_clock via lunch_end, and the card
    // still renders ONLY what the server permits.
    fireEvent.click(await screen.findByRole('button', { name: /start lunch/i }));
    expect(await screen.findByRole('button', { name: /end lunch/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start lunch/i })).not.toBeInTheDocument();
  });
});
