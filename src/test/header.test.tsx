import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mutable auth state so each test can pick admin vs standard employee. The real
// AuthContext is replaced; react-router stays real so useLocation reflects the
// MemoryRouter path.
const auth = vi.hoisted(() => ({
  isAdmin: true,
  employee: { first_name: 'Ada', last_name: 'Admin', role: 'master_admin' } as
    | { first_name: string; last_name: string; role: string }
    | null,
  signOut: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

import Header from '../components/Header';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.isAdmin = true;
  auth.employee = { first_name: 'Ada', last_name: 'Admin', role: 'master_admin' };
  auth.signOut = vi.fn();
});

describe('Header Admin ↔ Employee view toggle', () => {
  it('shows "Employee View" → / while an admin is on /admin', () => {
    renderAt('/admin');
    const link = screen.getByRole('link', { name: /Employee View/i });
    expect(link).toHaveAttribute('href', '/');
    expect(screen.queryByText('Admin View')).not.toBeInTheDocument();
  });

  it('shows "Admin View" → /admin while an admin is on the employee dashboard', () => {
    renderAt('/');
    const link = screen.getByRole('link', { name: /Admin View/i });
    expect(link).toHaveAttribute('href', '/admin');
    expect(screen.queryByText('Employee View')).not.toBeInTheDocument();
  });

  it('shows "Admin View" on other employee routes too (e.g. /history)', () => {
    renderAt('/history');
    expect(screen.getByRole('link', { name: /Admin View/i })).toHaveAttribute('href', '/admin');
  });

  it('a standard employee never sees an Admin/Employee View toggle', () => {
    auth.isAdmin = false;
    auth.employee = { first_name: 'Reg', last_name: 'Ular', role: 'employee' };
    renderAt('/');
    expect(screen.queryByText('Admin View')).not.toBeInTheDocument();
    expect(screen.queryByText('Employee View')).not.toBeInTheDocument();
    // No shield/admin nav link at all.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the employee name and Sign Out, and Sign Out still fires', () => {
    renderAt('/');
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    const signOut = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOut);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
