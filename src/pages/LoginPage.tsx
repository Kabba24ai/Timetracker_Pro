import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';
import { Clock, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginUser {
  id: number;
  full_name: string;
}

const LoginPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<LoginUser[]>('/auth/login-users')
      .then((res) => {
        if (active) setUsers(res.data ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Could not load the employee list.');
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userId) {
      setError('Please select your name.');
      return;
    }
    if (code.length < 4) {
      setError('Please enter your employee code.');
      return;
    }

    setLoading(true);
    try {
      await signIn(Number(userId), code);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">TimeTracker Pro</h2>
          <p className="mt-2 text-gray-600">Select your name and enter your employee code</p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="employee" className="block text-sm font-medium text-gray-700 mb-1">
              Employee
            </label>
            <select
              id="employee"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={loadingUsers}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            >
              <option value="">{loadingUsers ? 'Loading employees…' : 'Select your name'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Employee Code
            </label>
            <div className="relative">
              <input
                id="code"
                type={showCode ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                aria-label={showCode ? 'Hide code' : 'Show code'}
                aria-pressed={showCode}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Your 6-digit code</p>
          </div>

          <button
            type="submit"
            disabled={loading || loadingUsers}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
