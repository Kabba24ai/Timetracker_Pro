  import React, { useEffect, useState } from 'react';
  import { Navigate } from 'react-router-dom';
  import { useAuth } from '../contexts/AuthContext';
  import { Clock, AlertCircle } from 'lucide-react';
  import toast from 'react-hot-toast';
  import { api } from '../lib/api';
  import Select from 'react-select';

  interface LoginUser {
    id: number;
    full_name: string;
  }

  const LoginPage: React.FC = () => {
    const { user, employee, signIn } = useAuth();

    const [users, setUsers] = useState<LoginUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<number | ''>('');
    const [employeeCode, setEmployeeCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const userOptions = users.map(user => ({
    value: user.id,
    label: user.full_name,
  }));

  // Fetch users for dropdown
    useEffect(() => {
      const fetchUsers = async () => {
        try {
          const res = await api.get<{ data: LoginUser[] }>('/login-users');
          setUsers(res.data);
        } catch {
          toast.error('Failed to load employees');
        }
      };

      fetchUsers();
    }, []);

    // Redirect if already logged in
    if (user && employee) {
      const isAdmin = employee.role.includes('master_admin');
      return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
    } 

  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (!selectedUser || !employeeCode) {
        setError('Please select employee and enter employee code');
        setLoading(false);
        return;
      }

      try {
        await signIn(Number(selectedUser), employeeCode);
        toast.success('Login successful');
      } catch (err: any) {
        setError(err.message || 'Login failed');
        toast.error(err.message || 'Login failed');
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
            <h2 className="text-3xl font-bold text-gray-900">
              Time Clock System
            </h2>
          </div>

          <form
            className="space-y-6 bg-white p-8 rounded-xl shadow-lg"
            onSubmit={handleSubmit}
          >
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

          

            {/* Employee Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Employee
              </label>

              <Select
                options={userOptions}
                placeholder="Search and select employee..."
                isSearchable
                onChange={(option) => setSelectedUser(option ? option.value : '')}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>


            {/* Employee Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee Code
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                required
                placeholder="Enter employee code"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  export default LoginPage;
