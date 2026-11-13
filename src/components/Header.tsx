import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Clock, LogOut, Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const { employee, isAdmin, signOut } = useAuth();
  const location = useLocation();

  // Admin ↔ Employee view toggle for the SAME authenticated user (no
  // impersonation, no second login). While on an admin route the control offers
  // "Employee View" → the employee dashboard; while on the employee side an
  // authorized admin sees "Admin View" → /admin. Standard employees never see
  // it. Server authorization for /admin is unchanged — this only navigates.
  const onAdmin = location.pathname.startsWith('/admin');
  const showToggle = onAdmin || isAdmin;
  const toggleTo = onAdmin ? '/' : '/admin';
  const toggleLabel = onAdmin ? 'Employee View' : 'Admin View';

  const handleSignOut = () => {
    // signOut revokes the token server-side then clears the local session.
    void signOut();
  };

  // One layout for every width. From `md` up: one row — brand, view toggle,
  // identity (capped, so a long name truncates rather than the title), Sign Out.
  // On phones the brand and Sign Out share the first row (Sign Out never shrinks
  // or scrolls away) and the toggle + identity wrap to a second row; long names
  // and the title truncate instead of widening the page.
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 py-2 md:h-16 md:flex-nowrap md:gap-x-4 md:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <div className="shrink-0 bg-blue-600 p-2 rounded-lg">
              <Clock className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg md:text-xl font-bold text-gray-900">TimeTracker Pro</h1>
              <p className="hidden md:block text-xs text-gray-500">Rental Company Time Clock</p>
            </div>
          </div>

          <div className="order-3 flex w-full min-w-0 items-center gap-3 border-t border-gray-100 pt-2 md:order-none md:w-auto md:gap-4 md:border-0 md:pt-0">
            {showToggle && (
              <Link
                to={toggleTo}
                className="flex shrink-0 items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Shield className="h-4 w-4" />
                <span>{toggleLabel}</span>
              </Link>
            )}

            <div className="ml-auto min-w-0 text-right md:max-w-[12rem]">
              <p className="truncate text-sm font-medium text-gray-900">
                {employee?.first_name} {employee?.last_name}
              </p>
              <p className="truncate text-xs text-gray-500 capitalize">{employee?.role}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="order-2 flex shrink-0 items-center gap-2 px-2 md:px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors md:order-none"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;