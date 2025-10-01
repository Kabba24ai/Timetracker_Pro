import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  break_duration: number;
  notes: string | null;
  status: string;
  total_hours: number;
  created_at: string;
}

interface TimeClockContextType {
  currentStatus: string;
  todayEntries: TimeEntry[];
  activeEntry: TimeEntry | null;
  clockIn: (notes?: string) => Promise<void>;
  clockOut: (breakDuration?: number) => Promise<void>;
  refreshEntries: () => Promise<void>;
}

const TimeClockContext = createContext<TimeClockContextType>({} as TimeClockContextType);

export const useTimeClock = () => {
  const context = useContext(TimeClockContext);
  if (!context) {
    throw new Error('useTimeClock must be used within a TimeClockProvider');
  }
  return context;
};

export const TimeClockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employee } = useAuth();
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [currentStatus, setCurrentStatus] = useState('clocked_out');

  useEffect(() => {
    if (employee) {
      refreshEntries();
      loadActiveEntry();
    }
  }, [employee]);

  const loadActiveEntry = async () => {
    if (!employee) return;

    try {
      const response = await api.get('/api/timeclock/active');
      if (response.success) {
        setActiveEntry(response.data);
        setCurrentStatus(response.data ? 'clocked_in' : 'clocked_out');
      }
    } catch (error) {
      console.error('Error loading active entry:', error);
    }
  };

  const refreshEntries = async () => {
    if (!employee) return;

    try {
      const response = await api.get('/api/timeclock/today');
      if (response.success) {
        setTodayEntries(response.data || []);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const clockIn = async (notes?: string) => {
    if (!employee) return;

    try {
      const response = await api.post('/api/timeclock/clock-in', { notes });
      if (response.success) {
        await loadActiveEntry();
        await refreshEntries();
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      throw error;
    }
  };

  const clockOut = async (breakDuration: number = 0) => {
    if (!employee) return;

    try {
      const response = await api.post('/api/timeclock/clock-out', { break_duration: breakDuration });
      if (response.success) {
        setActiveEntry(null);
        setCurrentStatus('clocked_out');
        await refreshEntries();
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      throw error;
    }
  };

  return (
    <TimeClockContext.Provider
      value={{
        currentStatus,
        todayEntries,
        activeEntry,
        clockIn,
        clockOut,
        refreshEntries,
      }}
    >
      {children}
    </TimeClockContext.Provider>
  );
};