import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

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
      const token = localStorage.getItem('auth_token');

      if (token) {
        try {
          const response = await api.get('/api/auth/me');
          if (response.success && response.data) {
            const emp = response.data;
            setUser({ id: emp.id, email: emp.email });
            setEmployee({
              id: emp.id,
              user_id: emp.id,
              first_name: emp.first_name,
              last_name: emp.last_name,
              email: emp.email,
              role: emp.role,
              created_at: emp.created_at
            });
          }
        } catch (error) {
          console.error('Auth error:', error);
          localStorage.removeItem('auth_token');
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Invalid email or password');
    }

    const { token, user: userData } = response.data;

    api.setToken(token);

    const user = { id: userData.id, email: userData.email };
    const employee = {
      id: userData.id,
      user_id: userData.id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email,
      role: userData.role,
      created_at: userData.created_at
    };

    setUser(user);
    setEmployee(employee);
  };

  const signOut = async () => {
    setUser(null);
    setEmployee(null);
    api.setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};