import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// A mutable fake of the kabba2 TimeTracker V2 API. It models the authoritative
// state machine on the "server" so these tests prove the WIRING: the client
// renders whatever `allowed_actions` the server returns, dispatches the matching
// endpoint, and re-renders from the server's response — with no state-machine
// logic of its own.
const server = vi.hoisted(() => ({
  status: 'off' as 'off' | 'on_clock' | 'on_lunch' | 'on_other',
  token: null as string | null,
  calls: [] as string[],
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
    on_lunch: ['lunch_end'],
    on_other: ['other_end'],
  };
  const TRANSITION: Record<string, typeof server.status> = {
    '/clock/in': 'on_clock',
    '/clock/out': 'off',
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
          breaks: [],
        }
      : null;
    return {
      status: server.status,
      status_label: LABELS[server.status],
      allowed_actions: ALLOWED[server.status],
      shift,
      open_break: null,
      server_time: '2026-09-14T12:00:00-05:00',
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

  it('ON_CLOCK: shows Clock Out, Start Lunch, Start Break — never Clock In', async () => {
    seedLoggedIn('on_clock');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start lunch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start break/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock in/i })).not.toBeInTheDocument();
  });

  it('ON_LUNCH: shows only End Lunch', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /end lunch/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start break/i })).not.toBeInTheDocument();
  });

  it('ON_OTHER: shows only End Break', async () => {
    seedLoggedIn('on_other');
    render(<Harness />);

    expect(await screen.findByRole('button', { name: /end break/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock out/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /clock out/i })).not.toBeInTheDocument();
    expect(server.calls).toContain('POST /clock/lunch/start');
  });

  it('ON_LUNCH → End Lunch returns to ON_CLOCK', async () => {
    seedLoggedIn('on_lunch');
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /end lunch/i }));

    expect(await screen.findByRole('button', { name: /clock out/i })).toBeInTheDocument();
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

  it('offers every employee a Work Schedule link to the read-only schedule page', async () => {
    seedLoggedIn('off');
    render(<Harness />);

    const link = await screen.findByRole('link', { name: /work schedule/i });
    expect(link).toHaveAttribute('href', '/schedule');
  });
});
