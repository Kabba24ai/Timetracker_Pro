import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// AuthContext reports the server's real grants and answers can(): a Master
// Admin always may; anyone else only with the named permission. Nothing in a
// malformed payload can grant anything.

const server = vi.hoisted(() => ({ token: null as string | null, me: null as Record<string, unknown> | null, login: null as Record<string, unknown> | null }));

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(m: string, s: number) {
      super(m);
      this.status = s;
    }
    firstError() {
      return this.message;
    }
  }
  const api = {
    getToken: () => server.token,
    setToken: (t: string | null) => { server.token = t; },
    get: async (path: string) => {
      if (path === '/auth/me') return server.me ?? { success: true };
      return { success: true };
    },
    post: async (path: string) => {
      if (path === '/auth/login') return server.login ?? { success: false, message: 'no' };
      return { success: true };
    },
  };
  return { api, ApiError, AUTH_ERROR_EVENT: 'tt:unauthorized' };
});

import { AuthProvider, useAuth } from '../contexts/AuthContext';

const Probe: React.FC = () => {
  const { can, permissions, isAdmin, signIn } = useAuth();
  return (
    <div>
      <span data-testid="can">{String(can('payroll_cost.view'))}</span>
      <span data-testid="perms">{permissions.join(',')}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <button onClick={() => void signIn(1, '123456')}>login</button>
    </div>
  );
};

beforeEach(() => {
  server.token = null;
  server.me = null;
  server.login = null;
  localStorage.clear();
});

describe('AuthContext permissions', () => {
  it('a Master Admin may regardless of the permission list', () => {
    localStorage.setItem('tt_roles', JSON.stringify(['master_admin']));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('can')).toHaveTextContent('true');
    expect(screen.getByTestId('admin')).toHaveTextContent('true');
  });

  it('a non-admin may only with the stored grant', () => {
    localStorage.setItem('tt_roles', JSON.stringify(['clerk']));
    localStorage.setItem('tt_permissions', JSON.stringify(['payroll_cost.view']));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('can')).toHaveTextContent('true');
    expect(screen.getByTestId('perms')).toHaveTextContent('payroll_cost.view');
    expect(screen.getByTestId('admin')).toHaveTextContent('false');
  });

  it('nobody may without a role or a grant, and a malformed list grants nothing', () => {
    localStorage.setItem('tt_roles', JSON.stringify(['clerk']));
    localStorage.setItem('tt_permissions', JSON.stringify([{ name: 'payroll_cost.view' }, 42]));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('can')).toHaveTextContent('false');
    expect(screen.getByTestId('perms')).toHaveTextContent('');
  });

  it('session restore refreshes the grants from the server', async () => {
    server.token = 'tok';
    localStorage.setItem('tt_roles', JSON.stringify(['clerk']));
    server.me = { success: true, employee: { id: 1, first_name: 'Gary' }, roles: ['clerk'], permissions: ['payroll_cost.view'] };
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('true', { selector: '[data-testid="can"]' })).toBeInTheDocument();
    expect(localStorage.getItem('tt_permissions')).toBe(JSON.stringify(['payroll_cost.view']));
  });

  it('an older server that sends no list leaves non-admins without the control', async () => {
    server.token = 'tok';
    server.me = { success: true, employee: { id: 1, first_name: 'Gary' }, roles: ['clerk'] };
    render(<AuthProvider><Probe /></AuthProvider>);
    await vi.waitFor(() => expect(localStorage.getItem('tt_permissions')).toBe('[]'));
    expect(screen.getByTestId('can')).toHaveTextContent('false');
  });

  it('login stores the grants it is given', async () => {
    server.login = { success: true, user: { id: 1, full_name: 'Gary', token: 't2' }, employee: { id: 1, first_name: 'Gary' }, roles: [], permissions: ['payroll_cost.view'] };
    render(<AuthProvider><Probe /></AuthProvider>);
    screen.getByText('login').click();
    await vi.waitFor(() => expect(screen.getByTestId('can')).toHaveTextContent('true'));
    expect(localStorage.getItem('tt_permissions')).toBe(JSON.stringify(['payroll_cost.view']));
  });
});
