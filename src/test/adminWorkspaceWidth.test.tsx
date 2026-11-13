import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Admin Dashboard workspace width: only the Work Schedule tab takes the full
// window width; every other tab keeps its 1280px (max-w-7xl) workspace, and the
// title and tab bar never move. The rendered fit (Employee + Mon–Sun + Hours at
// 1440px and wider) is measured in a real browser; this guards the wiring.

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    employee: { id: 1, first_name: 'Ada', last_name: 'Admin', role: 'master_admin' },
    isAdmin: true,
    timezone: 'America/Chicago',
    signOut: vi.fn(),
  }),
}));

// Each tab's content is stubbed: this test is about the frame around it.
vi.mock('../components/admin/PayPeriodSummary', () => ({
  default: () => <div>Pay Periods content</div>,
  defaultPayPeriodView: () => ({ mode: 'current' }),
}));
vi.mock('../components/admin/TimeReviewV2', () => ({ default: () => <div>Time Review content</div> }));
vi.mock('../components/admin/EmployeeManagement', () => ({ default: () => <div>Employees content</div> }));
vi.mock('../components/admin/AttendanceV2', () => ({ default: () => <div>Attendance content</div> }));
vi.mock('../components/admin/WorkScheduleV2', () => ({ default: () => <div>Work Schedule content</div> }));
vi.mock('../components/admin/VacationManagement', () => ({ default: () => <div>Vacation content</div> }));
vi.mock('../components/admin/SystemSettings', () => ({ default: () => <div>Settings content</div> }));

import AdminDashboard from '../pages/AdminDashboard';

const TABS = ['Pay Periods', 'Time Review', 'Employees', 'Attendance', 'Work Schedule', 'Vacation Management', 'Settings'];

const workspace = () => screen.getByTestId('admin-workspace');
const frame = () => screen.getByRole('heading', { level: 1, name: 'Admin Dashboard' }).closest('.mx-auto') as HTMLElement;

describe('Admin Dashboard workspace width', () => {
  it('widens only the Work Schedule workspace; every other tab keeps max-w-7xl', () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );
    const frameClass = frame().className;
    expect(frameClass).toContain('max-w-7xl');

    for (const tab of [...TABS, 'Pay Periods']) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      const cls = workspace().className.split(/\s+/);
      if (tab === 'Work Schedule') {
        expect(screen.getByText('Work Schedule content')).toBeInTheDocument();
        expect(cls).toContain('max-w-none');
        expect(cls).not.toContain('max-w-7xl');
        // Still a reasonable margin on every screen size.
        expect(cls).toEqual(expect.arrayContaining(['mx-auto', 'px-4', 'sm:px-6', 'pb-8']));
      } else {
        expect(cls).toEqual(expect.arrayContaining(['max-w-7xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8', 'pb-8']));
        expect(cls).not.toContain('max-w-none');
      }
      // The title and tab bar stay exactly where they were.
      expect(frame().className).toBe(frameClass);
    }
  });
});
