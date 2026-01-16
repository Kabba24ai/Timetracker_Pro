import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { TimeEntry } from '../types/time-entry';
import toast from 'react-hot-toast';


/* =====================
   Types
===================== */


interface TimeClockContextType {
  currentStatus: 'clocked_in' | 'clocked_out';
  todayEntries: TimeEntry[];
  activeEntry: TimeEntry | null;
  clockIn: (notes?: string) => Promise<void>;
  clockOut: (breakDuration?: number) => Promise<void>;
  refreshEntries: () => Promise<void>;
}


/* =====================
   Context
===================== */



const TimeClockContext = createContext<TimeClockContextType>(
  {} as TimeClockContextType
);

export const useTimeClock = () => {
  const context = useContext(TimeClockContext);
  if (!context) {
    throw new Error('useTimeClock must be used within a TimeClockProvider');
  }
  return context;
};

/* =====================
   Provider
===================== */

export const TimeClockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { employee } = useAuth();

  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [currentStatus, setCurrentStatus] =
    useState<'clocked_in' | 'clocked_out'>('clocked_out');


  /* =====================
     Load data on login
  ===================== */

  useEffect(() => {
    if (employee) {
      loadActiveEntry();
      refreshEntries();
    } else {
      resetState();
    }
  }, [employee]);

  const resetState = () => {
    setActiveEntry(null);
    setTodayEntries([]);
    setCurrentStatus('clocked_out');
  };


  
  /* =====================
     API Calls
  ===================== */

  const loadActiveEntry = async () => {
    try {
      const response = await api.get('/time-clock/active');

      const entry = response?.data ?? null;

      if (entry) {
        setActiveEntry(entry);
        setCurrentStatus('clocked_in');
      } else {
        setActiveEntry(null);
        setCurrentStatus('clocked_out');
      }
    } catch (error) {
      console.error('Failed to load active entry', error);
    }
  };
  const refreshEntries = async () => {
    try {
      const response = await api.get('/time-clock/today');
      setTodayEntries(response?.data?.entries ?? []);
    } catch (error) {
      console.error('Failed to load today entries', error);
    }
  };

const clockIn = async (notes?: string) => {
  try {
    const res = await api.post('/time-clock/clock-in', { notes });

    toast.success(res.message || 'Clock-in successful');

    await loadActiveEntry();
    await refreshEntries();
  } catch (error: any) {
    console.error('Clock-in failed', error);

    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Clock-in failed. Please try again.';

    toast.error(message);

    throw error; // keep if caller needs to react
  }
};

  const clockOut = async (breakDuration: number = 0) => {
  try {
    const res = await api.post('/time-clock/clock-out', {
      break_duration: breakDuration,
    });

    toast.success(res.message || 'Clock-out successful');

    setActiveEntry(null);
    setCurrentStatus('clocked_out');
    await refreshEntries();
  } catch (error: any) {
    console.error('Clock-out failed', error);

    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Clock-out failed. Please try again.';

    toast.error(message);

    throw error; // keep this if caller needs to react
  }
};

  /* =====================
     Provider
  ===================== */

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