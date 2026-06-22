import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TimeClockProvider } from './contexts/TimeClockContext';
import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { SettingsProvider } from './contexts/SettingsContext';

function App() {
  return (
    <AuthProvider>
      <TimeClockProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
            }}
          />
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                     <SettingsProvider>
                        <EmployeeDashboard />
                    </SettingsProvider>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <SettingsProvider>
                      <AdminDashboard />
                    </SettingsProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Router>
      </TimeClockProvider>
    </AuthProvider>
  );
}

export default App;