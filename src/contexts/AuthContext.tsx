import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Employee } from '../types/employee';
import toast from 'react-hot-toast';

interface User {
  id: number;
  unique_id: string;
  full_name: string;
  email: string;
  role: string;   
  status: string;
  token: string;
}


interface AuthContextType {
  user: User | null;
  employee: Employee | null;
  loading: boolean;

  
  dashboardMode: DashboardMode;
  toggleDashboardMode: () => void;

  // signIn: (email: string, password: string) => Promise<void>;
  signIn: (userId: number, employeeCode: string) => Promise<void>;
  signOut: () => Promise<void>;
}

type DashboardMode = 'admin' | 'employee';



const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

const [dashboardMode, setDashboardMode] = useState<DashboardMode>('employee');


  // Restore session on page load
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    const storedEmployee = localStorage.getItem('auth_employee');
    const token = localStorage.getItem('auth_token');
  const storedMode = localStorage.getItem('dashboard_mode') as DashboardMode;

    if (storedUser && storedEmployee && token) {
      setUser(JSON.parse(storedUser));
      setEmployee(JSON.parse(storedEmployee));
      api.setToken(token);

       if (storedMode) {
        setDashboardMode(storedMode);
      }
    }

    setLoading(false);
  }, []);



const toggleDashboardMode = () => {
  if (!employee?.roles?.includes('master_admin')) return;

  setDashboardMode((prev) => {
    const next = prev === 'admin' ? 'employee' : 'admin';

    localStorage.setItem('dashboard_mode', next);

    toast.success(
      next === 'admin'
        ? 'Switched to Admin Dashboard'
        : 'Switched to Employee Dashboard'
    );

    return next;
  });
};


  // LOGIN
  // LOGIN
const signIn = async (userId: number, employeeCode: string) => {
  try {
    const response = await api.post('/login', {
      user_id: userId,
      employee_code: employeeCode,
    });

    if (!response.success) {
      throw {
        type: 'validation',
        message: response.message,
        errors: response.errors || {},
      };
    }

    const userData: User = response.user;
    const employeeData: Employee = response.employee;
    const token = userData.token;

    const isMasterAdmin = employeeData.roles?.includes('master_admin');
const initialMode: DashboardMode = 'employee';

setDashboardMode(initialMode);



    api.setToken(token);

    localStorage.setItem('dashboard_mode', initialMode);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    localStorage.setItem('auth_employee', JSON.stringify(employeeData));
    localStorage.setItem('auth_token', token);

    setUser(userData);
    setEmployee(employeeData);

    toast.success(`Welcome back, ${employeeData.first_name}!`);

  } catch (err: any) {

    //  THIS is the important part
    if (err.response?.data?.errors) {
      throw {
        type: 'validation',
        message: err.response.data.message || 'Validation failed.',
        errors: err.response.data.errors,
      };
    }

    throw {
      type: err.type || 'generic',
      message: err.message || 'Login failed',
      errors: err.errors || {},
    };
  }
};



  // LOGOUT
  const signOut = async () => {
    api.setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_employee');
      localStorage.removeItem('dashboard_mode');
    setUser(null);
    setEmployee(null);
     setDashboardMode('employee');

     toast('Signed out successfully ', {
      icon: '👋',
    });

  };

  return (
    <AuthContext.Provider
        value={{
          user,
          employee,
          loading,
          dashboardMode,
          toggleDashboardMode,
          signIn,
          signOut,
        }}
      >
        {children}
  </AuthContext.Provider>

  );
};