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
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (employee) {
            setUser({ id: session.user.id, email: session.user.email || '' });
            setEmployee({
              id: employee.id,
              user_id: employee.user_id,
              first_name: employee.first_name,
              last_name: employee.last_name,
              email: employee.email,
              role: employee.role,
              created_at: employee.created_at
            });
          }
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (employee) {
            setUser({ id: session.user.id, email: session.user.email || '' });
            setEmployee({
              id: employee.id,
              user_id: employee.user_id,
              first_name: employee.first_name,
              last_name: employee.last_name,
              email: employee.email,
              role: employee.role,
              created_at: employee.created_at
            });
          }
        } else {
          setUser(null);
          setEmployee(null);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Invalid email or password');
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (employeeError || !employee) {
      throw new Error('Employee record not found');
    }

    setUser({ id: data.user.id, email: data.user.email || '' });
    setEmployee({
      id: employee.id,
      user_id: employee.user_id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      role: employee.role,
      created_at: employee.created_at
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setEmployee(null);
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};