// import React from 'react';
// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext';
// import LoadingSpinner from './LoadingSpinner';

// interface ProtectedRouteProps {
//   children: React.ReactNode;
//   adminOnly?: boolean;
//   allowedRoles?: string[];
// }

// const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
//   const { user, employee, loading } = useAuth();

//   if (loading) {
//     return <LoadingSpinner />;
//   }

//   if (!user || !employee) {
//     return <Navigate to="/login" />;
//   }


//   const isAdmin = employee.roles?.includes('master_admin');


//     if (isAdmin && location.pathname === '/') {
//     return <Navigate to="/admin" replace />;
//   }


//   if (adminOnly && !isAdmin) {
//     return <Navigate to="/" />;
//   }
    


//   return <>{children}</>;
// };

// export default ProtectedRoute;



import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
}) => {
  const { user, employee, loading, dashboardMode } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;

  if (!user || !employee) {
    return <Navigate to="/login" replace />;
  }

  const isMasterAdmin = employee.roles?.includes('master_admin');

  //  Dashboard toggle redirect
  if (isMasterAdmin) {
    if (dashboardMode === 'admin' && location.pathname === '/') {
      return <Navigate to="/admin" replace />;
    }

    if (
      dashboardMode === 'employee' &&
      location.pathname.startsWith('/admin')
    ) {
      return <Navigate to="/" replace />;
    }
  }

  // Admin-only protection
  if (adminOnly && !isMasterAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
