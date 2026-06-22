import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { TimeEntry } from '../types/time-entry';
import toast from 'react-hot-toast';

/* =====================
   Types
===================== */

type WorkStatus =
  | 'clocked_out'
  | 'working'
  | 'lunch_break'
  | 'other_break';

interface TimeClockContextType {
  status: WorkStatus;
  todayEntries: TimeEntry[];
  activeEntry: TimeEntry | null;

    processingAction: ProcessingAction | null;

  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;

  startLunch: () => Promise<void>;
  endLunch: () => Promise<void>;

  startOther: () => Promise<void>;
  endOther: () => Promise<void>;

  refreshEntries: () => Promise<void>;
}

type ProcessingAction =
  | 'clock_in'
  | 'clock_out'
  | 'lunch_start'
  | 'lunch_end'
  | 'other_start'
  | 'other_end'
  | null;


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
  // const [currentStatus, setCurrentStatus] =
  //   useState<'clocked_in' | 'clocked_out'>('clocked_out');

  const [status, setStatus] = useState<WorkStatus>('clocked_out');



  /* =====================
     Load data on login
  ===================== */

const [processingAction, setProcessingAction] =
  useState<ProcessingAction>(null);


  const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  error?.message ||
  fallback;




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
  setStatus('clocked_out');
};

  
const startLunch = async () => {
  if (processingAction) return;

  try {
    setProcessingAction('lunch_start');

    await api.post('/time-clock/lunch-start');
    toast.success('Lunch started');

    await loadActiveEntry();
    await refreshEntries();
  } catch (error: any) {
    toast.error(
      error?.response?.message || 'Unable to start lunch'
    );
  } finally {
    setProcessingAction(null);
  }
};



const endLunch = async () => {
  if (processingAction) return;

  try {
    setProcessingAction('lunch_end');

    await api.post('/time-clock/lunch-end');
    toast.success('Lunch ended');

    await loadActiveEntry();
    await refreshEntries();
  } catch (error: any) {
    toast.error(getErrorMessage(error, 'Unable to end lunch break'));
  } finally {
    setProcessingAction(null);
  }
};


const startOther = async () => {
  if (processingAction) return;

  try {
    setProcessingAction('other_start');

    await api.post('/time-clock/other-start');
    toast.success('Break started');

    await loadActiveEntry();
    await refreshEntries();
  } catch (error: any) {
    toast.error(
      getErrorMessage(error, 'Unable to start break')
    );
    await loadActiveEntry();
  } finally {
    setProcessingAction(null);
  }
};


const endOther = async () => {
  if (processingAction) return;

  try {
    setProcessingAction('other_end');

    await api.post('/time-clock/other-end');
    toast.success('Break ended');

    await loadActiveEntry();
    await refreshEntries();
  } catch (error: any) {
    toast.error(getErrorMessage(error, 'Unable to end break'));
  } finally {
    setProcessingAction(null);
  }
};

  const loadActiveEntry = async () => {
  try {
    const res = await api.get('/time-clock/active');

    const entry = res.data?.entry ?? null;
    const activeBreak = res.data?.active_break ?? null;

    setActiveEntry(entry);

    if (!entry) {
      setStatus('clocked_out');
    } else if (activeBreak?.type === 'lunch') {
      setStatus('lunch_break');
    } else if (activeBreak?.type === 'other') {
      setStatus('other_break');
    } else {
      setStatus('working');
    }
  } catch (error) {
    console.error('Failed to load active entry', error);
  }
};


  const refreshEntries = async () => {
    try {
      const response = await api.get('/time-clock/today');

      // console.log('response');
      // console.log(response);
      // console.log('response');

      setTodayEntries(response?.data?.entries ?? []);
    } catch (error) {
      console.error('Failed to load today entries', error);
    }
  };


  const clockIn = async () => {
    if (processingAction) return;

    try {
      setProcessingAction('clock_in');

      await api.post('/time-clock/clock-in');
      toast.success('Clock-in successful');

      await loadActiveEntry();
      await refreshEntries();
    } catch (error: any) {

      console.log(error);

      toast.error(
        error?.message || 'Clock-in failed'
      );
    } finally {
      setProcessingAction(null);
    }
  };



  const clockOut = async () => {
  if (processingAction) return;

  try {
    setProcessingAction('clock_out');

    await api.post('/time-clock/clock-out');
    toast.success('Clock-out successful');

    setActiveEntry(null);
    setStatus('clocked_out');
    await refreshEntries();
  } catch (error: any) {
    toast.error(getErrorMessage(error, 'Clock-out failed'));
  } finally {
    setProcessingAction(null);
  }
};


  /* =====================
     Provider
  ===================== */

  return (
    <TimeClockContext.Provider
      value={{
        status,
        todayEntries,
        activeEntry,
        processingAction,
        clockIn,
        clockOut,
        startLunch,
        endLunch,
        startOther,
        endOther,
        refreshEntries,
      }}
    >
      {children}
    </TimeClockContext.Provider>
  );
};