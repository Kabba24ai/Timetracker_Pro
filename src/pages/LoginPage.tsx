import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Clock, AlertCircle , Eye, EyeOff} from 'lucide-react';
import toast from 'react-hot-toast';



const LoginPage: React.FC = () => {
  const { user,employee, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); 
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  

if (user && employee) {
  const isAdmin = employee.role.includes('admin');
  return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
}


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      await signIn(email, password);

          toast.success('Login successful ');
    } catch (err: any) {
      if (err.type === 'validation') {
        
        setFieldErrors(err.errors || {});
        setError(err.message);
          toast.error(err.message || 'Validation error ');
      } else {
        setError(err.message || 'An error occurred during login');
            toast.error(err.message || 'Login failed ');
      }
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
          <h2 className="text-3xl font-bold text-gray-900">Time Clock System</h2>
          {/* <p className="mt-2 text-gray-600">Demo Login - Use credentials below</p> */}
        </div>

        {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-blue-900 mb-2">Demo Accounts:</h3>
          <div className="space-y-2 text-blue-800">
            <div>
              <strong>Employee:</strong> john@demo.com / demo123
            </div>
            <div>
              <strong>Admin:</strong> admin@demo.com / admin123
            </div>
          </div>
        </div> */}

        <form className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2
    ${fieldErrors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'}
  `}
              placeholder="Enter your email"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div>
  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
    Password
  </label>

  <div className="relative">
    <input
      id="password"
      type={showPassword ? 'text' : 'password'}
      required
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 pr-10
        ${fieldErrors.password
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:ring-blue-500'}
      `}
      placeholder="Enter your password"
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
    >
      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>

  {fieldErrors.password && (
    <p className="mt-1 text-sm text-red-600">
      {fieldErrors.password[0]}
    </p>
  )}
</div>


          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;