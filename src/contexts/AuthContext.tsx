import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Employee } from '../types/employee';

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
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

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

  // Restore session on page load
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    const storedEmployee = localStorage.getItem('auth_employee');
    const token = localStorage.getItem('auth_token');

    if (storedUser && storedEmployee && token) {
      setUser(JSON.parse(storedUser));
      setEmployee(JSON.parse(storedEmployee));
      api.setToken(token);
    }

    setLoading(false);
  }, []);


  // LOGIN
  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.post('/login', { email, password });

      if (!response.success) {
        if (response.errors) {
          throw {
            type: 'validation',
            message: response.message,
            errors: response.errors,
          };
        }
        throw new Error(response.message);
      }

      const userData: User = response.user;
      const employeeData: Employee = response.employee;
      const token = userData.token;

      api.setToken(token);

      localStorage.setItem('auth_user', JSON.stringify(userData));
      localStorage.setItem('auth_employee', JSON.stringify(employeeData));
      localStorage.setItem('auth_token', token);

      setUser(userData);
      setEmployee(employeeData);

    } catch (err: any) {
      if (err.errors) {
        throw {
          type: 'validation',
          message: err.message || 'Validation failed.',
          errors: err.errors,
        };
      }
      throw {
        type: 'generic',
        message: err.message || 'Login failed',
      };
    }
  };


  // LOGOUT
  const signOut = async () => {
    api.setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    setUser(null);
    setEmployee(null);
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};