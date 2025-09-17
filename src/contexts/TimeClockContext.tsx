import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface TimeEntry {
  id: string;
  employee_id: string;
  entry_type: 'clock_in' | 'clock_out' | 'lunch_out' | 'lunch_in' | 'unpaid_out' | 'unpaid_in';
  timestamp: string;
  created_at: string;
}

interface TimeClockContextType {
  currentStatus: string;
  todayEntries: TimeEntry[];
  isOnLunch: boolean;
  isOnUnpaidBreak: boolean;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  startLunch: () => Promise<void>;
  endLunch: () => Promise<void>;
  startUnpaidTime: () => Promise<void>;
  endUnpaidTime: () => Promise<void>;
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
  const [currentStatus, setCurrentStatus] = useState('clocked_out');
  const [isOnLunch, setIsOnLunch] = useState(false);
  const [isOnUnpaidBreak, setIsOnUnpaidBreak] = useState(false);

  useEffect(() => {
    if (employee) {
      initializeDemoData();
      refreshEntries();
    }
  }, [employee]);

  const initializeDemoData = () => {
    if (!employee) return;

    const storageKey = `time_entries_${employee.id}`;
    const existingEntries = localStorage.getItem(storageKey);
    
    // Only create demo data if none exists
    if (!existingEntries) {
      const demoEntries = generateDemoTimeEntries(employee.id);
      localStorage.setItem(storageKey, JSON.stringify(demoEntries));
    }
  };

  const generateDemoTimeEntries = (employeeId: string): TimeEntry[] => {
    const entries: TimeEntry[] = [];
    let entryId = 1;

    // Generate entries for Jan 5-18, 2025 (first pay period)
    const startDate = new Date('2025-01-05'); // Sunday
    const endDate = new Date('2025-01-18'); // Saturday
    
    // Skip weekends for work days
    const workDays = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        workDays.push(new Date(d));
      }
    }

    workDays.forEach((date, index) => {
      const dateStr = date.toISOString().split('T')[0];
      
      // Different patterns for different employees
      let clockInTime = '08:00';
      let clockOutTime = '17:00';
      let lunchStart = '12:00';
      let lunchEnd = '13:00';
      
      if (employeeId === '1') { // John Doe - regular schedule
        clockInTime = '08:00';
        clockOutTime = '17:00';
      } else if (employeeId === '2') { // Admin User - flexible schedule
        clockInTime = '09:00';
        clockOutTime = '18:00';
        lunchStart = '13:00';
        lunchEnd = '14:00';
      } else if (employeeId === '3') { // Jane Smith - early schedule
        clockInTime = '07:00';
        clockOutTime = '16:00';
        lunchStart = '11:30';
        lunchEnd = '12:30';
      }

      // Add some variation to make it realistic
      const variation = Math.floor(Math.random() * 10) - 5; // -5 to +5 minutes
      const clockInMinutes = parseInt(clockInTime.split(':')[1]) + variation;
      const clockInHour = parseInt(clockInTime.split(':')[0]);
      
      const adjustedClockIn = `${clockInHour.toString().padStart(2, '0')}:${Math.max(0, Math.min(59, clockInMinutes)).toString().padStart(2, '0')}`;

      // Clock In
      entries.push({
        id: (entryId++).toString(),
        employee_id: employeeId,
        entry_type: 'clock_in',
        timestamp: `${dateStr}T${adjustedClockIn}:00.000Z`,
        created_at: `${dateStr}T${adjustedClockIn}:00.000Z`,
      });

      // Lunch Out (skip lunch on some days randomly)
      if (Math.random() > 0.1) { // 90% chance of taking lunch
        entries.push({
          id: (entryId++).toString(),
          employee_id: employeeId,
          entry_type: 'lunch_out',
          timestamp: `${dateStr}T${lunchStart}:00.000Z`,
          created_at: `${dateStr}T${lunchStart}:00.000Z`,
        });

        // Lunch In
        entries.push({
          id: (entryId++).toString(),
          employee_id: employeeId,
          entry_type: 'lunch_in',
          timestamp: `${dateStr}T${lunchEnd}:00.000Z`,
          created_at: `${dateStr}T${lunchEnd}:00.000Z`,
        });
      }

      // Occasional unpaid break
      if (Math.random() > 0.7) { // 30% chance of unpaid break
        const breakStart = '15:00';
        const breakEnd = '15:15';
        
        entries.push({
          id: (entryId++).toString(),
          employee_id: employeeId,
          entry_type: 'unpaid_out',
          timestamp: `${dateStr}T${breakStart}:00.000Z`,
          created_at: `${dateStr}T${breakStart}:00.000Z`,
        });

        entries.push({
          id: (entryId++).toString(),
          employee_id: employeeId,
          entry_type: 'unpaid_in',
          timestamp: `${dateStr}T${breakEnd}:00.000Z`,
          created_at: `${dateStr}T${breakEnd}:00.000Z`,
        });
      }

      // Clock Out (occasionally forget to clock out to simulate real scenarios)
      if (Math.random() > 0.05) { // 95% chance of clocking out
        const outVariation = Math.floor(Math.random() * 20) - 10; // -10 to +10 minutes
        const clockOutMinutes = parseInt(clockOutTime.split(':')[1]) + outVariation;
        const clockOutHour = parseInt(clockOutTime.split(':')[0]);
        
        const adjustedClockOut = `${clockOutHour.toString().padStart(2, '0')}:${Math.max(0, Math.min(59, clockOutMinutes)).toString().padStart(2, '0')}`;

        entries.push({
          id: (entryId++).toString(),
          employee_id: employeeId,
          entry_type: 'clock_out',
          timestamp: `${dateStr}T${adjustedClockOut}:00.000Z`,
          created_at: `${dateStr}T${adjustedClockOut}:00.000Z`,
        });
      }
    });

    return entries;
  };
  const refreshEntries = async () => {
    if (!employee) return;

    // Get entries from localStorage for demo
    const storageKey = `time_entries_${employee.id}`;
    const today = new Date().toISOString().split('T')[0];
    const savedEntries = localStorage.getItem(storageKey);
    
    let entries: TimeEntry[] = [];
    if (savedEntries) {
      const allEntries = JSON.parse(savedEntries);
      // Filter for today's entries
      entries = allEntries.filter((entry: TimeEntry) => 
        entry.timestamp.startsWith(today)
      );
    }
    
    setTodayEntries(entries);
    calculateCurrentStatus(entries);
  };

  const calculateCurrentStatus = (entries: TimeEntry[]) => {
    if (entries.length === 0) {
      setCurrentStatus('clocked_out');
      setIsOnLunch(false);
      setIsOnUnpaidBreak(false);
      return;
    }

    const lastEntry = entries[entries.length - 1];
    
    // Check lunch status
    const lunchEntries = entries.filter(e => e.entry_type.includes('lunch'));
    const lastLunchEntry = lunchEntries[lunchEntries.length - 1];
    setIsOnLunch(lastLunchEntry?.entry_type === 'lunch_out');
    
    // Check unpaid break status
    const unpaidEntries = entries.filter(e => e.entry_type.includes('unpaid'));
    const lastUnpaidEntry = unpaidEntries[unpaidEntries.length - 1];
    setIsOnUnpaidBreak(lastUnpaidEntry?.entry_type === 'unpaid_out');

    // Determine overall status
    if (lastEntry.entry_type === 'clock_out') {
      setCurrentStatus('clocked_out');
    } else if (lastEntry.entry_type === 'clock_in') {
      setCurrentStatus('clocked_in');
    } else if (lastEntry.entry_type === 'lunch_out') {
      setCurrentStatus('on_lunch');
    } else if (lastEntry.entry_type === 'lunch_in') {
      setCurrentStatus('clocked_in');
    } else if (lastEntry.entry_type === 'unpaid_out') {
      setCurrentStatus('on_unpaid_break');
    } else if (lastEntry.entry_type === 'unpaid_in') {
      setCurrentStatus('clocked_in');
    }
  };

  const createTimeEntry = async (entryType: TimeEntry['entry_type']) => {
    if (!employee) return;
    
    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      employee_id: employee.id,
      entry_type: entryType,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    
    // Save to localStorage for demo
    const storageKey = `time_entries_${employee.id}`;
    const savedEntries = localStorage.getItem(storageKey);
    const entries = savedEntries ? JSON.parse(savedEntries) : [];
    entries.push(newEntry);
    localStorage.setItem(storageKey, JSON.stringify(entries));
    
    await refreshEntries();
  };

  const clockIn = () => createTimeEntry('clock_in');
  const clockOut = () => createTimeEntry('clock_out');
  const startLunch = () => createTimeEntry('lunch_out');
  const endLunch = () => createTimeEntry('lunch_in');
  const startUnpaidTime = () => createTimeEntry('unpaid_out');
  const endUnpaidTime = () => createTimeEntry('unpaid_in');

  return (
    <TimeClockContext.Provider
      value={{
        currentStatus,
        todayEntries,
        isOnLunch,
        isOnUnpaidBreak,
        clockIn,
        clockOut,
        startLunch,
        endLunch,
        startUnpaidTime,
        endUnpaidTime,
        refreshEntries,
      }}
    >
      {children}
    </TimeClockContext.Provider>
  );
};