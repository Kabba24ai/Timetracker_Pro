import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

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
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employee.id)
        .is('clock_out', null)
        .eq('status', 'active')
        .maybeSingle();

      if (!error && data) {
        setActiveEntry(data);
        setCurrentStatus('clocked_in');
      } else {
        setActiveEntry(null);
        setCurrentStatus('clocked_out');
      }
    } catch (error) {
      console.error('Error loading active entry:', error);
    }
  };

  const refreshEntries = async () => {
    if (!employee) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('clock_in', today.toISOString())
        .lt('clock_in', tomorrow.toISOString())
        .order('clock_in', { ascending: false });

      if (!error && data) {
        setTodayEntries(data);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const clockIn = async (notes?: string) => {
    if (!employee) return;

    try {
      const { data: existingEntry } = await supabase
        .from('time_entries')
        .select('id')
        .eq('employee_id', employee.id)
        .is('clock_out', null)
        .eq('status', 'active')
        .maybeSingle();

      if (existingEntry) {
        throw new Error('Already clocked in');
      }

      const { error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: employee.id,
          clock_in: new Date().toISOString(),
          notes: notes || null,
          status: 'active',
        });

      if (error) throw error;

      await loadActiveEntry();
      await refreshEntries();
    } catch (error) {
      console.error('Error clocking in:', error);
      throw error;
    }
  };

  const clockOut = async (breakDuration: number = 0) => {
    if (!employee || !activeEntry) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_out: new Date().toISOString(),
          break_duration: breakDuration,
          status: 'completed',
        })
        .eq('id', activeEntry.id);

      if (error) throw error;

      setActiveEntry(null);
      setCurrentStatus('clocked_out');
      await refreshEntries();
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