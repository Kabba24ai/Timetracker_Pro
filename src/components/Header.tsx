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

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">TimeTracker Pro</h1>
              <p className="text-xs text-gray-500">Rental Company Time Clock</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {showToggle && (
              <Link
                to={toggleTo}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Shield className="h-4 w-4" />
                <span>{toggleLabel}</span>
              </Link>
            )}

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {employee?.first_name} {employee?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">{employee?.role}</p>
              </div>
              
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;