import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
}

interface Employee {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'employee' | 'admin';
  created_at: string;
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = localStorage.getItem('demo_user');
        const savedEmployee = localStorage.getItem('demo_employee');

        if (savedUser && savedEmployee) {
          setUser(JSON.parse(savedUser));
          setEmployee(JSON.parse(savedEmployee));
        }
      } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('demo_user');
        localStorage.removeItem('demo_employee');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const demoAccounts: { [key: string]: { password: string; employee: Employee } } = {
        'admin@demo.com': {
          password: 'admin123',
          employee: {
            id: '2',
            user_id: 'demo-admin-id',
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@demo.com',
            role: 'admin',
            created_at: new Date().toISOString()
          }
        },
        'john@demo.com': {
          password: 'demo123',
          employee: {
            id: '1',
            user_id: 'demo-employee-id',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@demo.com',
            role: 'employee',
            created_at: new Date().toISOString()
          }
        }
      };

      const account = demoAccounts[email.toLowerCase()];

      if (!account || account.password !== password) {
        throw new Error('Invalid email or password');
      }

      const userData = { id: account.employee.user_id, email };

      setUser(userData);
      setEmployee(account.employee);

      localStorage.setItem('demo_user', JSON.stringify(userData));
      localStorage.setItem('demo_employee', JSON.stringify(account.employee));
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('demo_user');
    localStorage.removeItem('demo_employee');
    setUser(null);
    setEmployee(null);
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};