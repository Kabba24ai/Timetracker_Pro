import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Download, Edit, Plus, Save, X, Trash2, ChevronDown, Eye } from 'lucide-react';

interface TimeEntry {
  id: string;
  employee_id: string;
  entry_type: 'clock_in' | 'clock_out' | 'lunch_out' | 'lunch_in' | 'unpaid_out' | 'unpaid_in';
  timestamp: string;
  created_at: string;
}

interface TimeReportData {
  employee_name: string;
  employee_id: string;
  total_hours: number;
  lunch_hours: number;
  unpaid_hours: number;
  paid_hours: number;
  vacation_hours: number;
}

interface PayPeriod {
  number: number;
  start_date: string;
  end_date: string;
  label: string;
}

// Mock report data for demo
const mockReportData: TimeReportData[] = [
  {
    employee_name: 'John Doe',
    employee_id: '1',
    total_hours: 38.5,
    lunch_hours: 4.0,
    unpaid_hours: 1.5,
    paid_hours: 33.0,
    vacation_hours: 8.0,
  },
  {
    employee_name: 'Jane Smith',
    employee_id: '3',
    total_hours: 42.0,
    lunch_hours: 5.0,
    unpaid_hours: 0.5,
    paid_hours: 36.5,
    vacation_hours: 0.0,
  },
  {
    employee_name: 'Admin User',
    employee_id: '2',
    total_hours: 35.0,
    lunch_hours: 3.0,
    unpaid_hours: 0.0,
    paid_hours: 32.0,
    vacation_hours: 0.0,
  }
];

const TimeReports: React.FC = () => {
  const [reportData, setReportData] = useState<TimeReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [employeeEntries, setEmployeeEntries] = useState<TimeEntry[]>([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    entry_type: 'clock_in' as TimeEntry['entry_type'],
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
  });
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<PayPeriod | null>(null);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [showPayPeriodDropdown, setShowPayPeriodDropdown] = useState(false);
  const [showDailyBreakdown, setShowDailyBreakdown] = useState<string | null>(null);
  const [dailyBreakdownData, setDailyBreakdownData] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editEntryValues, setEditEntryValues] = useState({
    date: '',
    time: '',
    entry_type: 'clock_in' as TimeEntry['entry_type']
  });

  useEffect(() => {
    generatePayPeriods();
  }, []);

  useEffect(() => {
    fetchTimeReports();
  }, [selectedPayPeriod]);

  const generatePayPeriods = () => {
    // Get pay period settings from localStorage
    const savedSettings = localStorage.getItem('demo_system_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {
      pay_period_type: 'biweekly',
      pay_period_start_date: '2025-01-05'
    };

    const startDate = new Date(settings.pay_period_start_date);
    
    // Validate the date - if invalid, use default
    if (isNaN(startDate.getTime())) {
      startDate.setTime(new Date('2025-01-05').getTime());
    }
    
    const periodLength = settings.pay_period_type === 'weekly' ? 7 : 14;
    const periods: PayPeriod[] = [];
    const currentDate = new Date();

    // Generate periods from start date to current date + 2 periods ahead
    let periodStart = new Date(startDate);
    let periodNumber = 1;

    // Generate at least 10 periods to ensure we have data
    while (periodNumber <= 10) {
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + periodLength - 1);

      periods.push({
        number: periodNumber,
        start_date: periodStart.toISOString().split('T')[0],
        end_date: periodEnd.toISOString().split('T')[0],
        label: `Period ${periodNumber}: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`
      });

      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() + 1);
      periodNumber++;
    }

    setPayPeriods(periods);
    
    // Set first period as default (our demo data period)
    if (periods.length > 0) {
      setSelectedPayPeriod(periods[0]);
    }
  };

  const fetchTimeReports = async () => {
    if (!selectedPayPeriod) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Calculate actual report data from time entries
      const reportData: TimeReportData[] = [];
      const employees = [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Admin User' },
        { id: '3', name: 'Jane Smith' }
      ];

      for (const employee of employees) {
        const storageKey = `time_entries_${employee.id}`;
        const savedEntries = localStorage.getItem(storageKey);
        
        let entries: any[] = [];
        if (savedEntries) {
          const allEntries = JSON.parse(savedEntries);
          // Filter for selected pay period
          entries = allEntries.filter((entry: any) => {
            const entryDate = entry.timestamp.split('T')[0];
            return entryDate >= selectedPayPeriod.start_date && 
                   entryDate <= selectedPayPeriod.end_date;
          });
        }

        const hours = calculateEmployeeHours(entries);
        const vacationHours = calculateVacationHours(employee.id, selectedPayPeriod);
        
        reportData.push({
          employee_name: employee.name,
          employee_id: employee.id,
          total_hours: hours.total,
          lunch_hours: hours.lunch,
          unpaid_hours: hours.unpaid,
          paid_hours: hours.paid,
          vacation_hours: vacationHours,
        });
      }

      setReportData(reportData);
    } catch (error) {
      console.error('Error fetching time reports:', error);
      setReportData([]); // Set empty data on error
    } finally {
      setLoading(false);
    }
  };

  const calculateEmployeeHours = (entries: any[]) => {
    let totalHours = 0;
    let lunchHours = 0;
    let unpaidHours = 0;
    
    // Group entries by date
    const entriesByDate: { [date: string]: any[] } = {};
    entries.forEach(entry => {
      const date = entry.timestamp.split('T')[0];
      if (!entriesByDate[date]) {
        entriesByDate[date] = [];
      }
      entriesByDate[date].push(entry);
    });

    // Calculate hours for each day
    Object.values(entriesByDate).forEach(dayEntries => {
      dayEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let clockInTime: Date | null = null;
      let clockOutTime: Date | null = null;
      let lunchStartTime: Date | null = null;
      let lunchEndTime: Date | null = null;
      let unpaidStartTime: Date | null = null;
      let unpaidEndTime: Date | null = null;
      let dayLunchHours = 0;
      let dayUnpaidHours = 0;

      dayEntries.forEach(entry => {
        const entryTime = new Date(entry.timestamp);

        switch (entry.entry_type) {
          case 'clock_in':
            clockInTime = entryTime;
            break;
          case 'clock_out':
            clockOutTime = entryTime;
            break;
          case 'lunch_out':
            lunchStartTime = entryTime;
            break;
          case 'lunch_in':
            lunchEndTime = entryTime;
            if (lunchStartTime) {
              dayLunchHours += (lunchEndTime.getTime() - lunchStartTime.getTime()) / (1000 * 60 * 60);
              lunchStartTime = null;
            }
            break;
          case 'unpaid_out':
            unpaidStartTime = entryTime;
            break;
          case 'unpaid_in':
            unpaidEndTime = entryTime;
            if (unpaidStartTime) {
              dayUnpaidHours += (unpaidEndTime.getTime() - unpaidStartTime.getTime()) / (1000 * 60 * 60);
              unpaidStartTime = null;
            }
            break;
        }
      });

      // Calculate total hours for the day
      if (clockInTime && clockOutTime) {
        const dayTotalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        totalHours += dayTotalHours;
        lunchHours += dayLunchHours;
        unpaidHours += dayUnpaidHours;
      }
    });

    const paidHours = Math.max(0, totalHours - lunchHours - unpaidHours);

    return {
      total: Math.round(totalHours * 100) / 100,
      lunch: Math.round(lunchHours * 100) / 100,
      unpaid: Math.round(unpaidHours * 100) / 100,
      paid: Math.round(paidHours * 100) / 100,
    };
  };

  const calculateVacationHours = (employeeId: string, payPeriod: PayPeriod) => {
    try {
      const requestsKey = `vacation_requests_${employeeId}`;
      const savedRequests = localStorage.getItem(requestsKey);
      
      if (!savedRequests) return 0;
      
      const requests = JSON.parse(savedRequests);
      let vacationHours = 0;
      
      requests.forEach((request: any) => {
        if (request.status === 'approved') {
          // Check if vacation dates overlap with pay period
          const vacationStart = new Date(request.start_date);
          const vacationEnd = new Date(request.end_date);
          const periodStart = new Date(payPeriod.start_date);
          const periodEnd = new Date(payPeriod.end_date);
          
          // Check for overlap
          if (vacationStart <= periodEnd && vacationEnd >= periodStart) {
            // Calculate overlapping days and proportional hours
            const overlapStart = new Date(Math.max(vacationStart.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(vacationEnd.getTime(), periodEnd.getTime()));
            
            const totalVacationDays = Math.ceil((vacationEnd.getTime() - vacationStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            const proportionalHours = (request.hours * overlapDays) / totalVacationDays;
            vacationHours += proportionalHours;
          }
        }
      });
      
      return Math.round(vacationHours * 100) / 100;
    } catch (error) {
      console.error('Error calculating vacation hours:', error);
      return 0;
    }
  };

  const fetchEmployeeEntries = async (employeeId: string) => {
    try {
      // Get entries from localStorage for demo
      const storageKey = `time_entries_${employeeId}`;
      const savedEntries = localStorage.getItem(storageKey);
      
      let entries: TimeEntry[] = [];
      if (savedEntries) {
        const allEntries = JSON.parse(savedEntries);
        // Filter for selected pay period
        entries = allEntries.filter((entry: TimeEntry) => {
          const entryDate = entry.timestamp.split('T')[0];
          return selectedPayPeriod && 
                 entryDate >= selectedPayPeriod.start_date && 
                 entryDate <= selectedPayPeriod.end_date;
        });
      }
      
      // Sort by timestamp
      entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setEmployeeEntries(entries);
    } catch (error) {
      console.error('Error fetching employee entries:', error);
    }
  };

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployee(employeeId);
    setShowDailyBreakdown(null);
    fetchEmployeeEntries(employeeId);
  };

  const handleViewDailyBreakdown = async (employeeId: string) => {
    setShowDailyBreakdown(employeeId);
    await generateDailyBreakdown(employeeId);
  };

  const generateDailyBreakdown = async (employeeId: string) => {
    if (!selectedPayPeriod) return;

    try {
      const storageKey = `time_entries_${employeeId}`;
      const savedEntries = localStorage.getItem(storageKey);
      
      let entries: TimeEntry[] = [];
      if (savedEntries) {
        const allEntries = JSON.parse(savedEntries);
        entries = allEntries.filter((entry: TimeEntry) => {
          const entryDate = entry.timestamp.split('T')[0];
          return entryDate >= selectedPayPeriod.start_date && 
                 entryDate <= selectedPayPeriod.end_date;
        });
      }

      // Group entries by date
      const entriesByDate: { [date: string]: TimeEntry[] } = {};
      entries.forEach(entry => {
        const date = entry.timestamp.split('T')[0];
        if (!entriesByDate[date]) {
          entriesByDate[date] = [];
        }
        entriesByDate[date].push(entry);
      });

      // Generate daily breakdown
      const breakdown = Object.entries(entriesByDate).map(([date, dayEntries]) => {
        dayEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        const dayData: any = {
          date,
          clock_in_actual: null,
          clock_in_adjusted: null,
          lunch_start: null,
          lunch_end: null,
          unpaid_start: null,
          unpaid_end: null,
          clock_out_actual: null,
          clock_out_adjusted: null,
          total_hours: 0,
          total_unpaid_hours: 0,
          total_paid_hours: 0,
        };

        let clockInTime: Date | null = null;
        let clockOutTime: Date | null = null;
        let lunchHours = 0;
        let unpaidHours = 0;

        dayEntries.forEach(entry => {
          const time = entry.timestamp.split('T')[1].substring(0, 5);
          const adjustedTime = adjustTimeToIncrement(time, 15); // Use 15-minute increment

          switch (entry.entry_type) {
            case 'clock_in':
              dayData.clock_in_actual = time;
              dayData.clock_in_adjusted = adjustedTime;
              clockInTime = new Date(`${date}T${adjustedTime}:00`);
              break;
            case 'clock_out':
              dayData.clock_out_actual = time;
              dayData.clock_out_adjusted = adjustedTime;
              clockOutTime = new Date(`${date}T${adjustedTime}:00`);
              break;
            case 'lunch_out':
              dayData.lunch_start = time;
              dayData.lunch_out_time = new Date(entry.timestamp);
              break;
            case 'lunch_in':
              dayData.lunch_end = time;
              if (dayData.lunch_out_time) {
                const lunchInTime = new Date(entry.timestamp);
                lunchHours += (lunchInTime.getTime() - dayData.lunch_out_time.getTime()) / (1000 * 60 * 60);
              }
              break;
            case 'unpaid_out':
              dayData.unpaid_start = time;
              dayData.unpaid_out_time = new Date(entry.timestamp);
              break;
            case 'unpaid_in':
              dayData.unpaid_end = time;
              if (dayData.unpaid_out_time) {
                const unpaidInTime = new Date(entry.timestamp);
                unpaidHours += (unpaidInTime.getTime() - dayData.unpaid_out_time.getTime()) / (1000 * 60 * 60);
              }
              break;
          }
        });

        // Calculate daily totals
        if (clockInTime && clockOutTime) {
          const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
          dayData.total_hours = Math.max(0, totalHours);
          dayData.total_unpaid_hours = lunchHours + unpaidHours;
          dayData.total_paid_hours = Math.max(0, totalHours - lunchHours - unpaidHours);
        }

        return dayData;
      });

      // Sort by date
      breakdown.sort((a, b) => a.date.localeCompare(b.date));
      setDailyBreakdownData(breakdown);
    } catch (error) {
      console.error('Error generating daily breakdown:', error);
    }
  };

  const adjustTimeToIncrement = (time: string, increment: number) => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const adjustedMinutes = Math.round(totalMinutes / increment) * increment;
    const adjustedHours = Math.floor(adjustedMinutes / 60);
    const adjustedMins = adjustedMinutes % 60;
    return `${adjustedHours.toString().padStart(2, '0')}:${adjustedMins.toString().padStart(2, '0')}`;
  };

  const handleAddEntry = async () => {
    if (!editingEmployee) return;

    const timestamp = `${newEntry.date}T${newEntry.time}:00.000Z`;
    const entry: TimeEntry = {
      id: Date.now().toString(),
      employee_id: editingEmployee,
      entry_type: newEntry.entry_type,
      timestamp,
      created_at: new Date().toISOString(),
    };

    try {
      // Save to localStorage for demo
      const storageKey = `time_entries_${editingEmployee}`;
      const savedEntries = localStorage.getItem(storageKey);
      const entries = savedEntries ? JSON.parse(savedEntries) : [];
      entries.push(entry);
      localStorage.setItem(storageKey, JSON.stringify(entries));

      // Refresh entries
      await fetchEmployeeEntries(editingEmployee);
      setShowAddEntry(false);
      setNewEntry({
        entry_type: 'clock_in',
        date: new Date().toISOString().split('T')[0],
        time: '08:00',
      });
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!editingEmployee) return;

    try {
      // Remove from localStorage for demo
      const storageKey = `time_entries_${editingEmployee}`;
      const savedEntries = localStorage.getItem(storageKey);
      if (savedEntries) {
        const entries = JSON.parse(savedEntries);
        const updatedEntries = entries.filter((entry: TimeEntry) => entry.id !== entryId);
        localStorage.setItem(storageKey, JSON.stringify(updatedEntries));
      }

      // Refresh entries
      await fetchEmployeeEntries(editingEmployee);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry.id);
    const [date, timeWithSeconds] = entry.timestamp.split('T');
    const time = timeWithSeconds.substring(0, 5);
    setEditEntryValues({
      date,
      time,
      entry_type: entry.entry_type
    });
  };

  const handleSaveEditEntry = async () => {
    if (!editingEmployee || !editingEntry) return;

    try {
      const timestamp = `${editEntryValues.date}T${editEntryValues.time}:00.000Z`;
      
      const storageKey = `time_entries_${editingEmployee}`;
      const savedEntries = localStorage.getItem(storageKey);
      if (savedEntries) {
        const entries = JSON.parse(savedEntries);
        const updatedEntries = entries.map((entry: TimeEntry) => 
          entry.id === editingEntry 
            ? { ...entry, entry_type: editEntryValues.entry_type, timestamp }
            : entry
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedEntries));
      }

      await fetchEmployeeEntries(editingEmployee);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error saving entry edit:', error);
    }
  };

  const handleCancelEditEntry = () => {
    setEditingEntry(null);
    setEditEntryValues({ date: '', time: '', entry_type: 'clock_in' });
  };

  const getEntryTypeLabel = (entryType: string) => {
    const labels: { [key: string]: string } = {
      clock_in: 'Clock In',
      clock_out: 'Clock Out',
      lunch_out: 'Lunch Start',
      lunch_in: 'Lunch End',
      unpaid_out: 'Unpaid Start',
      unpaid_in: 'Unpaid End',
    };
    return labels[entryType] || entryType;
  };

  const getEntryTypeColor = (entryType: string) => {
    switch (entryType) {
      case 'clock_in':
        return 'text-green-600 bg-green-50';
      case 'clock_out':
        return 'text-red-600 bg-red-50';
      case 'lunch_out':
      case 'lunch_in':
        return 'text-orange-600 bg-orange-50';
      case 'unpaid_out':
      case 'unpaid_in':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  };

  if (showDailyBreakdown) {
    const employee = reportData.find(r => r.employee_id === showDailyBreakdown);
    
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowDailyBreakdown(null)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <Clock className="h-6 w-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Daily Breakdown - {employee?.employee_name}
            </h2>
          </div>
          <div className="text-sm text-gray-600">
            {selectedPayPeriod?.label}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Clock In</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Lunch<br/><span className="text-xs text-gray-500">Start</span></th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Lunch<br/><span className="text-xs text-gray-500">End</span></th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Unpaid<br/><span className="text-xs text-gray-500">Start</span></th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Unpaid<br/><span className="text-xs text-gray-500">End</span></th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Clock Out</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Total Hours</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Total Unpaid</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Total Paid</th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdownData.map((day) => (
                  <tr key={day.date} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-3 px-2 font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </td>
                    <td className="py-3 px-2">
                      {day.clock_in_adjusted ? (
                        <div>
                          <div className="font-mono text-blue-600 font-semibold">{day.clock_in_adjusted}</div>
                          <div className="font-mono text-xs text-gray-500 italic">{day.clock_in_actual}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 font-mono text-orange-600">{day.lunch_start || '-'}</td>
                    <td className="py-3 px-2 font-mono text-orange-600">{day.lunch_end || '-'}</td>
                    <td className="py-3 px-2 font-mono text-purple-600">{day.unpaid_start || '-'}</td>
                    <td className="py-3 px-2 font-mono text-purple-600">{day.unpaid_end || '-'}</td>
                    <td className="py-3 px-2">
                      {day.clock_out_adjusted ? (
                        <div>
                          <div className="font-mono text-red-600 font-semibold">{day.clock_out_adjusted}</div>
                          <div className="font-mono text-xs text-gray-500 italic">{day.clock_out_actual}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 font-mono text-blue-600 font-semibold">
                      {day.total_hours ? day.total_hours.toFixed(2) : '-'}
                    </td>
                    <td className="py-3 px-2 font-mono text-red-600 font-semibold">
                      {day.total_unpaid_hours ? day.total_unpaid_hours.toFixed(2) : '-'}
                    </td>
                    <td className="py-3 px-2 font-mono text-green-600 font-semibold">
                      {day.total_paid_hours ? day.total_paid_hours.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dailyBreakdownData.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No time data found for the selected pay period.</p>
            </div>
          )}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Time Adjustment Information</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• <strong>Large Times:</strong> Adjusted times rounded to the nearest 15-minute increment for payroll</p>
            <p>• <strong>Small Italic Times:</strong> The exact time the employee clocked in/out</p>
            <p>• <strong>Color Coding:</strong> Blue = Clock In Times, Red = Clock Out Times</p>
            <p>• Lunch and unpaid break times are recorded as-is (no adjustment needed)</p>
          </div>
        </div>
      </div>
    );
  }

  if (editingEmployee) {
    const employee = reportData.find(r => r.employee_id === editingEmployee);
    
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setEditingEmployee(null)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <Clock className="h-6 w-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Manage Time Entries - {employee?.employee_name}
            </h2>
          </div>
          <button
            onClick={() => setShowAddEntry(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Entry</span>
          </button>
        </div>

        {showAddEntry && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Add New Time Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type</label>
                <select
                  value={newEntry.entry_type}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, entry_type: e.target.value as TimeEntry['entry_type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="clock_in">Clock In</option>
                  <option value="clock_out">Clock Out</option>
                  <option value="lunch_out">Lunch Start</option>
                  <option value="lunch_in">Lunch End</option>
                  <option value="unpaid_out">Unpaid Start</option>
                  <option value="unpaid_in">Unpaid End</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={newEntry.time}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  onClick={handleAddEntry}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Add</span>
                </button>
                <button
                  onClick={() => setShowAddEntry(false)}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Entry Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeEntries.map((entry) => {
                  const { date, time } = formatDateTime(entry.timestamp);
                  const isEditing = editingEntry === entry.id;
                  
                  return (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-white">
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editEntryValues.entry_type}
                            onChange={(e) => setEditEntryValues(prev => ({ ...prev, entry_type: e.target.value as TimeEntry['entry_type'] }))}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="clock_in">Clock In</option>
                            <option value="clock_out">Clock Out</option>
                            <option value="lunch_out">Lunch Start</option>
                            <option value="lunch_in">Lunch End</option>
                            <option value="unpaid_out">Unpaid Start</option>
                            <option value="unpaid_in">Unpaid End</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                            {getEntryTypeLabel(entry.entry_type)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editEntryValues.date}
                            onChange={(e) => setEditEntryValues(prev => ({ ...prev, date: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-gray-900">{date}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="time"
                            value={editEntryValues.time}
                            onChange={(e) => setEditEntryValues(prev => ({ ...prev, time: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                          />
                        ) : (
                          <span className="font-mono text-gray-900">{time}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleSaveEditEntry}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelEditEntry}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditEntry(entry)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {employeeEntries.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No time entries found for the selected pay period.</p>
              <p className="text-sm text-gray-400 mt-1">Add entries using the button above.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Time Reports</h2>
        </div>
        <button className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> Showing sample time report data. Select a pay period and click "Edit" to manage individual employee time entries.
        </p>
      </div>

      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Pay Period:</label>
        </div>
        <div className="relative mt-2">
          <button
            onClick={() => setShowPayPeriodDropdown(!showPayPeriodDropdown)}
            className="w-full md:w-96 px-4 py-2 text-left bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
          >
            <span className="text-gray-900">
              {selectedPayPeriod ? selectedPayPeriod.label : 'Select a pay period...'}
            </span>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>
          
          {showPayPeriodDropdown && (
            <div className="absolute z-10 w-full md:w-96 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {payPeriods.map((period) => (
                <button
                  key={period.number}
                  onClick={() => {
                    setSelectedPayPeriod(period);
                    setShowPayPeriodDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 ${
                    selectedPayPeriod?.number === period.number ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading reports...</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Employee</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Lunch Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Unpaid Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Paid Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Vacation Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((report) => (
                  <tr key={report.employee_id} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-3 px-4 font-medium text-gray-900">{report.employee_name}</td>
                    <td className="py-3 px-4 text-blue-600 font-semibold">
                      {report.total_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-orange-600 font-medium">
                      {report.lunch_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-red-600 font-medium">
                      {report.unpaid_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-green-600 font-semibold">
                      {report.paid_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-purple-600 font-semibold">
                      {report.vacation_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleEditEmployee(report.employee_id)}
                        className="flex items-center space-x-1 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded mr-2"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                      <button
                        onClick={() => handleViewDailyBreakdown(report.employee_id)}
                        className="flex items-center space-x-1 text-green-600 hover:bg-green-50 px-2 py-1 rounded"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">Daily View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reportData.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No time data found for the selected pay period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeReports;