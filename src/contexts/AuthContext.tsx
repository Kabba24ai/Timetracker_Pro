import React, { createContext, useContext, useEffect, useState } from 'react';

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

// Mock users for demo
const mockUsers = [
  {
    id: '1',
    email: 'john@demo.com',
    password: 'demo123',
    employee: {
      id: '1',
      user_id: '1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@demo.com',
      role: 'employee' as const,
      created_at: '2024-01-01T00:00:00Z',
    }
  },
  {
    id: '2',
    email: 'admin@demo.com',
    password: 'admin123',
    employee: {
      id: '2',
      user_id: '2',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@demo.com',
      role: 'admin' as const,
      created_at: '2024-01-01T00:00:00Z',
    }
  }
];

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
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem('demo_user');
    const savedEmployee = localStorage.getItem('demo_employee');
    
    if (savedUser && savedEmployee) {
      setUser(JSON.parse(savedUser));
      setEmployee(JSON.parse(savedEmployee));
    }
    
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const mockUser = mockUsers.find(u => u.email === email && u.password === password);
    
    if (!mockUser) {
      throw new Error('Invalid email or password');
    }
    
    const user = { id: mockUser.id, email: mockUser.email };
    const employee = mockUser.employee;
    
    setUser(user);
    setEmployee(employee);
    
    // Save to localStorage for persistence
    localStorage.setItem('demo_user', JSON.stringify(user));
    localStorage.setItem('demo_employee', JSON.stringify(employee));
  };

  const signOut = async () => {
    setUser(null);
    setEmployee(null);
    localStorage.removeItem('demo_user');
    localStorage.removeItem('demo_employee');
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};