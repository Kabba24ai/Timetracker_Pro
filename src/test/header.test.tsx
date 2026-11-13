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

// Phones: jsdom has no layout, so these guard the responsive structure; the
// rendered fit (no horizontal page scroll, Sign Out on screen) is measured in a
// real browser at 320–430px.
describe('Header on narrow phones', () => {
  const signOutButton = () => screen.getByRole('button', { name: /Sign Out/i });

  it('keeps Sign Out on the first row beside the brand, never shrinking', () => {
    renderAt('/');
    const cls = signOutButton().className.split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(['shrink-0', 'order-2', 'md:order-none']));
    // The toggle + identity wrap to their own full-width row on phones only.
    const row = screen.getByText('Ada Admin').closest('div.order-3') as HTMLElement;
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['w-full', 'md:w-auto', 'md:order-none']));
    expect(row).toContainElement(screen.getByRole('link', { name: /Admin View/i }));
  });

  it('truncates a long name and the title instead of widening the page', () => {
    auth.employee = { first_name: 'Benjamin', last_name: 'Ortiz-Hernandez-Whitaker', role: 'master_admin' };
    renderAt('/admin');
    const name = screen.getByText('Benjamin Ortiz-Hernandez-Whitaker');
    expect(name.className).toContain('truncate');
    expect(name.parentElement?.className).toContain('md:max-w-[12rem]');
    expect(screen.getByRole('heading', { name: 'TimeTracker Pro' }).className).toContain('truncate');
    expect(screen.getByRole('link', { name: /Employee View/i }).className).toContain('shrink-0');
  });

  it('keeps the desktop reading order: brand, view toggle, identity, Sign Out', () => {
    renderAt('/');
    const order = [
      screen.getByRole('heading', { name: 'TimeTracker Pro' }),
      screen.getByRole('link', { name: /Admin View/i }),
      screen.getByText('Ada Admin'),
      signOutButton(),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('a standard employee still sees who is signed in and Sign Out', () => {
    auth.isAdmin = false;
    auth.employee = { first_name: 'Reg', last_name: 'Ular', role: 'employee' };
    renderAt('/');
    expect(screen.getByText('Reg Ular')).toBeInTheDocument();
    fireEvent.click(signOutButton());
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
