import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Download, Edit, Plus, Save, X, Trash2, ChevronDown, Eye } from 'lucide-react';
import {  } from "lucide-react";
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const TENANT_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'UTC';

interface TimeEntry {
  id: string;
  employee_id: string;
  break_id?: number;
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

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TENANT_TIMEZONE,
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TENANT_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

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
    entry_type: 'clock_in' as TimeEntry['entry_type'],
  });

  //  MOVE THIS HERE (TOP-LEVEL)
  const handleExportCSV = async () => {
    if (!selectedPayPeriod) return;

    try {
      const blob = await api.download(
        `/time-reports/export?pay_period=${selectedPayPeriod.number}`
      );

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `time-reports-${selectedPayPeriod.start_date}-${selectedPayPeriod.end_date}.csv`;
      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV export failed', error);
    }
  };

  const handleUserTimeEntryCSV = async (userId: string) => {
    if (!selectedPayPeriod || !userId) return;

    try {
      const blob = await api.download(
        `/users/${userId}/time-entries/export?pay_period=${selectedPayPeriod.number}`
      );

      const employee = reportData.find(r => r.employee_id === userId);

      const fileName = `time-entries-${employee?.employee_name}-${selectedPayPeriod.start_date}-${selectedPayPeriod.end_date}.csv`;

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('User time entry CSV export failed', error);
    }
  };


const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
const toggleDay = (date: string) =>
  setOpenDays((p) => ({ ...p, [date]: !p[date] }));

const [openBreaks, setOpenBreaks] = useState<Record<string, boolean>>({});

const toggleBreak = (key: string) =>
  setOpenBreaks(p => ({ ...p, [key]: !p[key] }));


  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);


  useEffect(() => {
  fetchTimeReports();
}, [page, perPage, selectedPayPeriod]);

useEffect(() => {
  setPage(1);
}, [perPage, selectedPayPeriod]);


useEffect(() => {
  fetchPayPeriods();
}, []);


const fetchPayPeriods = async () => {
  const res = await api.get('/time-reports/pay-periods');
  if (res.success) {
    setPayPeriods(res.data);
    setSelectedPayPeriod(res.data[0]);
  }
};


 const fetchTimeReports = async () => {
  if (!selectedPayPeriod) {
    setLoading(false);
    return;
  }

  setLoading(true);

  try {
      const res = await api.get<{
      success: boolean;
      message?: string;
      data: TimeReportData[];
      meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
      };
    }>(
      `/time-reports/get?page=${page}&per_page=${perPage}&pay_period=${selectedPayPeriod.number}`
    );

    if (!res.success) {
      console.error(res.message || 'Failed to fetch time reports');
      setReportData([]);
      return;
    }

    setReportData(res.data);
    setPage(res.meta.current_page);
    setLastPage(res.meta.last_page);
    setTotal(res.meta.total);

  } catch (error) {
    console.error('Failed to fetch time reports', error);
    setReportData([]);
  } finally {
    setLoading(false);
  }
};

const normalizeTime = (t: any) => {
  if (!t) return null;

  // If already string
  if (typeof t === 'string') return t;

  // If object with adjusted/actual
  return t.adjusted || t.actual || null;
};
const convertDailyToFlatEntries = (dailyData: any[]) => {
  const flat: TimeEntry[] = [];

  dailyData.forEach(day => {
    day.entries.forEach((entry: any) => {

      //  Clock In first
      if (entry.clock_in) {
        flat.push({
          id: `${entry.entry_id}-in`,
          employee_id: '',
          entry_type: 'clock_in',
          timestamp: normalizeTime(entry.clock_in),
          created_at: normalizeTime(entry.clock_in),
        });
      }

      //  Lunch breaks
      entry.lunch_breaks?.forEach((l: any, i: number) => {
        flat.push({
          id: `${entry.entry_id}-lunch-out-${i}`,
          employee_id: '',
           break_id: l.id,   
          entry_type: 'lunch_out',
          timestamp: normalizeTime(l.start),
          created_at: normalizeTime(l.start),
        });

        flat.push({
          id: `${entry.entry_id}-lunch-in-${i}`,
          employee_id: '',
          entry_type: 'lunch_in',
           break_id: l.id,  
          timestamp: normalizeTime(l.end),
          created_at: normalizeTime(l.end),
        });
      });

      //  Unpaid breaks
      entry.unpaid_breaks?.forEach((u: any, i: number) => {
        flat.push({
          id: `${entry.entry_id}-unpaid-out-${i}`,
          employee_id: '',
          entry_type: 'unpaid_out',
           break_id: u.id,       
          timestamp: normalizeTime(u.start),
          created_at: normalizeTime(u.start),
        });

        flat.push({
          id: `${entry.entry_id}-unpaid-in-${i}`,
          employee_id: '',
          entry_type: 'unpaid_in',
           break_id: u.id,       
          timestamp: normalizeTime(u.end),
          created_at: normalizeTime(u.end),
        });
      });

      //  Clock Out last
      if (entry.clock_out) {
        flat.push({
          id: `${entry.entry_id}-out`,
          employee_id: '',
          entry_type: 'clock_out',
          timestamp: normalizeTime(entry.clock_out),
          created_at: normalizeTime(entry.clock_out),
        });
      }

    });
  });

  return flat.filter(e => e.timestamp);
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

  const handleEditEmployee = async  (employeeId: string) => {
    setEditingEmployee(employeeId);
    setShowDailyBreakdown(null);
    fetchEmployeeEntries(employeeId);

     await generateDailyBreakdown(employeeId);
  };

  const handleViewDailyBreakdown = async (employeeId: string) => {
    setShowDailyBreakdown(employeeId);
    await generateDailyBreakdown(employeeId);
  };


  const generateDailyBreakdown = async (employeeId: string) => {
  if (!selectedPayPeriod) return;

  try {
    const res = await api.get<{
      success: boolean;
      data: any[];
    }>(`/users/time-entries-list/${employeeId}?pay_period=${selectedPayPeriod.number}`);

    if (!res.success) {
      setDailyBreakdownData([]);
       setEmployeeEntries([]);
      return;
    }

    // Backend already returns daily breakdown
    setDailyBreakdownData(res.data);

     //  THIS IS IMPORTANT
    const flatEntries = convertDailyToFlatEntries(res.data);

    setEmployeeEntries(flatEntries);

    

  } catch (err) {
    console.error('Daily breakdown fetch failed', err);
    setDailyBreakdownData([]);
     setEmployeeEntries([]);
  }
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

    const dateObj = new Date(entry.timestamp);

    // Format date in tenant timezone (YYYY-MM-DD)
    const inputDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: TENANT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);

    // Format time in tenant timezone (HH:mm 24-hour)
    const inputTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: TENANT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateObj);

    setEditEntryValues({
      date: inputDate,
      time: inputTime,
      entry_type: entry.entry_type,
    });
  };



  const handleSaveEditEntry = async () => {
    if (!editingEmployee || !editingEntry) return;

    try {

      const realEntryId = parseInt(editingEntry.split('-')[0]);

      const current = employeeEntries.find(e => e.id === editingEntry);

      if (!current) return;

    await api.post('/users/time-entries/update', {
      entry_id: realEntryId,    
      break_id: current.break_id ?? null,  
      entry_type: current.entry_type,
      new_time: editEntryValues.time
    });

    
    toast.success(`Time Updated Successfully `);
   
    await generateDailyBreakdown(editingEmployee);

    setEditingEntry(null);

    } catch (error) {
      toast.error('Something went wrong while Processing.. ');
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

  // const formatDateTime = (timestamp: string) => {
  //   const date = new Date(timestamp);
  //   return {
  //     date: date.toLocaleDateString(),
  //     time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  //   };
  // };

  const formatDateTime = (timestamp: string) => {

   

  const date = new Date(timestamp);

  return {
    date: new Intl.DateTimeFormat('en-US', {
      timeZone: TENANT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date),

    time: new Intl.DateTimeFormat('en-US', {
      timeZone: TENANT_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date),
  };
};


  const TimeCell = ({ adjusted, actual, className = "" }: any) => {
  if (!adjusted) return <span className="text-gray-400">-</span>;

  return (
    <div className={className}>
      <div className=" font-semibold">{formatTime(new Date(adjusted))}</div>
      {actual && (
        <div className="  italic text-gray-500">
          {formatTime(new Date(actual))}
        </div>
      )}
    </div>
  );
  };


const BreakCell = ({
  breaks,
  type, // "lunch" | "unpaid"
  side, // "start" | "end"
  entryId,
  colorClass,
}: {
  breaks: any[] | undefined;
  type: "lunch" | "unpaid";
  side: "start" | "end";
  entryId: number | string;
  colorClass: string;
}) => {
  const count = breaks?.length ?? 0;
  const key = `${entryId}-${type}-${side}`;

  if (count === 0) return <span className="text-gray-400">-</span>;

  //  single break -> show directly
  if (count === 1) {
    const b = breaks![0];
    return (
      <TimeCell
        adjusted={b?.[side]?.adjusted}
        actual={b?.[side]?.actual}
        className={colorClass}
      />
    );
  }

  //  multiple breaks -> expandable in SAME CELL
  return (
    <div className="mt-1 space-y-1 animate-in fade-in duration-200">

      <div className="align-top">
        <button
          onClick={() => toggleBreak(key)}
          className={`${colorClass}  font-medium  flex items-center gap-1`}
        >
          <span
            className={`inline-block transition-transform duration-200 ${
              openBreaks[key] ? "rotate-90" : ""
            }`}
          >
            ▸
          </span>
          {count} breaks
        </button>

        {openBreaks[key] && (
          <div className="mt-2 space-y-1 rounded-md bg-white p-2 border border-gray-300 shadow-sm">
            {breaks!.map((b, i) => (
              <TimeCell
                key={i}
                adjusted={b?.[side]?.adjusted}
                actual={b?.[side]?.actual}
                className={colorClass}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};





  if (showDailyBreakdown) {
    const employee = reportData.find(r => r.employee_id === showDailyBreakdown);
    
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowDailyBreakdown(null)}
              className="p-2 text-gray-600 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <Clock className="h-6 w-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Daily Breakdown - {employee?.employee_name}
            </h2>


          </div>
             <div className="flex items-center gap-4 text-gray-600">
                <span>{selectedPayPeriod?.label}</span>

                <button
                  onClick={() => handleUserTimeEntryCSV(showDailyBreakdown)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>

              </div>

          
      
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full ">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Date</th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Clock In</th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Lunch<br/><span className=" text-gray-500">Start</span></th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Lunch<br/><span className=" text-gray-500">End</span></th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Unpaid<br/><span className=" text-gray-500">Start</span></th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Unpaid<br/><span className=" text-gray-500">End</span></th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Clock Out</th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Total Hours</th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Total Unpaid</th>
                  <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Total Paid</th>
                </tr>
              </thead>
              

              
              <tbody>
                {dailyBreakdownData.map((day, dayIndex) => {

                       const entryCount = day.entries?.length ?? 0;

                    const isSingle = entryCount === 1;
                    const isOpen = !isSingle && !!openDays[day.date];
                    const entry = day.entries?.[0];
                    const dayBg =
                      dayIndex % 2 === 0 ? "bg-white" : "bg-gray-50";

                    const dayHover =
                      dayIndex % 2 === 0 ? " " : " ";



             
                  return (
                    <React.Fragment key={day.date}>
                      {/* DAY SUMMARY ROW */}
                      <tr  className={`border-b border-gray-300 ${dayBg} ${dayHover} transition-colors`}>
                        <td className="whitespace-nowrap py-3 px-2 font-medium text-gray-900">
                          <button
                            onClick={() => {
                            if (!isSingle) toggleDay(day.date);
                          }}

                            className={`flex items-center gap-2 ${
                              entryCount > 1 ? 'hover:text-blue-600' : 'cursor-default'
                            }`}
                          >

                                <span className="whitespace-nowrap inline-block w-4">
                                  {entryCount > 1 && (
                                    <span
                                      className={`inline-block transition-transform duration-200 ${
                                        isOpen ? 'rotate-90' : ''
                                      }`}
                                    >
                                      ▸
                                    </span>
                                  )}
                                </span>


                            {formatDate(new Date(day.date))}
                            
                          </button>
                        </td>

                        {/* Show dash in time columns for summary row */}
                       {/* TIME COLUMNS */}
                      {isSingle ? (
                        <>
                          {/* Clock In */}
                          <td className="whitespace-nowrap py-3 px-2">
                            <TimeCell
                              adjusted={entry.clock_in?.adjusted}
                              actual={entry.clock_in?.actual}
                              className="text-green-600"
                            />
                          </td>

                          {/* Lunch Start */}
                          <td className="whitespace-nowrap py-3 px-2 align-top">
                            <BreakCell
                              breaks={entry?.lunch_breaks}
                              type="lunch"
                              side="start"
                              entryId={entry?.entry_id}
                              colorClass="text-orange-600"
                            />
                          </td>

                          {/* Lunch End */}
                          <td className="whitespace-nowrap py-3 px-2 align-top">
                            <BreakCell
                              breaks={entry?.lunch_breaks}
                              type="lunch"
                              side="end"
                              entryId={entry?.entry_id}
                              colorClass="text-orange-600"
                            />
                          </td>

                          {/* Unpaid Start */}
                          <td className="whitespace-nowrap py-3 px-2 align-top">
                            <BreakCell
                              breaks={entry?.unpaid_breaks}
                              type="unpaid"
                              side="start"
                              entryId={entry?.entry_id}
                              colorClass="text-purple-600"
                            />
                          </td>

                          {/* Unpaid End */}
                          <td className="whitespace-nowrap py-3 px-2 align-top">
                            <BreakCell
                              breaks={entry?.unpaid_breaks}
                              type="unpaid"
                              side="end"
                              entryId={entry?.entry_id}
                              colorClass="text-purple-600"
                            />
                          </td>

                          {/* Clock Out */}
                          <td className="whitespace-nowrap py-3 px-2">
                            <TimeCell
                              adjusted={entry.clock_out?.adjusted}
                              actual={entry.clock_out?.actual}
                              className="text-red-600"
                            />
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleDay(day.date)}
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Show all entries ({entryCount})
                          </button>
                        </td>

                      )}




                        {/* DAY TOTALS */}
                        <td className="py-3 px-2  text-blue-600 font-semibold">
                          {Number(day.totals?.worked_hours ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2  text-red-600 font-semibold">
                          {Number(day.totals?.unpaid_hours ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2  text-green-600 font-semibold">
                          {Number(day.totals?.paid_hours ?? 0).toFixed(2)}
                        </td>
                      </tr>

                      {/* EXPANDED ENTRIES */}
                      {!isSingle && isOpen &&
                          day.entries.map((entry, entryIndex) => (
                            <tr
                              key={entry.entry_id}
                             className="whitespace-nowrap border-b border-gray-200 bg-gray-100
                                transition-colors duration-200 "

                            >
                            {/* Empty date cell for entry row */}
                           <td className="py-3 px-2  text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              
                                Entry {entryIndex + 1}
                            </span>
                          </td>


                            {/* Clock In */}
                            <td className="whitespace-nowrap py-3 px-2">
                              <TimeCell
                                adjusted={entry.clock_in?.adjusted}
                                actual={entry.clock_in?.actual}
                                className="text-green-600"
                              />
                            </td>

                            {/* Lunch Start / End (show first lunch break or list) */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">
                              <BreakCell
                                  breaks={entry.lunch_breaks}
                                  type="lunch"
                                  side="start"
                                  entryId={entry.entry_id}
                                  colorClass="text-orange-600"
                                />
                              </td>


                            <td className="whitespace-nowrap py-3 px-2 align-top">
                              <BreakCell
                                breaks={entry.lunch_breaks}
                                type="lunch"
                                side="end"
                                entryId={entry.entry_id}
                                colorClass="text-orange-600"
                              />
                            </td>


                            {/* Unpaid Start / End */}
                           <td className="whitespace-nowrap py-3 px-2 align-top">
                              <BreakCell
                                breaks={entry.unpaid_breaks}
                                type="unpaid"
                                side="start"
                                entryId={entry.entry_id}
                                colorClass="text-purple-600"
                              />
                            </td>


                            <td className="whitespace-nowrap py-3 px-2 align-top">
                              <BreakCell
                                breaks={entry.unpaid_breaks}
                                type="unpaid"
                                side="end"
                                entryId={entry.entry_id}
                                colorClass="text-purple-600"
                              />
                            </td>


                            {/* Clock Out */}
                            <td className="py-3 px-2">
                              <TimeCell
                                adjusted={entry.clock_out?.adjusted}
                                actual={entry.clock_out?.actual}
                                className="text-red-600"
                              />
                            </td>

                            {/* Entry totals (instead of repeating day totals) */}
                            <td className="py-3 px-2  font-semibold text-blue-700 bg-blue-50">
                              {(Number(entry.worked_seconds ?? 0) / 3600).toFixed(2)}
                            </td>
                           <td className="py-3 px-2  font-semibold text-red-700 bg-red-50">
                              {(Number(entry.unpaid_seconds ?? 0) / 3600).toFixed(2)}
                            </td>
                            <td className="py-3 px-2  font-semibold text-green-700 bg-green-50">
                              {(Number(entry.paid_seconds ?? 0) / 3600).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
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
          <h4 className=" font-semibold text-blue-900 mb-2">Time Adjustment Information</h4>
          <div className=" text-blue-800 space-y-1">
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
              className="p-2 text-gray-600  rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <Clock className="h-6 w-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Manage Time Entries - {employee?.employee_name}
            </h2>
          </div>
          {/* <button
            onClick={() => setShowAddEntry(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg  transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Entry</span>
          </button> */}
        </div>

        {showAddEntry && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Add New Time Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block  font-medium text-gray-700 mb-1">Entry Type</label>
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
                <label className="block  font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block  font-medium text-gray-700 mb-1">Time</label>
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
                        {/* {isEditing ? (
                          <select
                            value={editEntryValues.entry_type}
                            onChange={(e) => setEditEntryValues(prev => ({ ...prev, entry_type: e.target.value as TimeEntry['entry_type'] }))}
                            className="px-2 py-1 border border-gray-300 rounded "
                          >
                            <option value="clock_in">Clock In</option>
                            <option value="clock_out">Clock Out</option>
                            <option value="lunch_out">Lunch Start</option>
                            <option value="lunch_in">Lunch End</option>
                            <option value="unpaid_out">Unpaid Start</option>
                            <option value="unpaid_in">Unpaid End</option>
                          </select>
                        ) : ( */}
                          <span className={`inline-flex px-3 py-1  font-medium rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                            {getEntryTypeLabel(entry.entry_type)}
                          </span>
                        {/* )} */}
                      </td>
                      <td className="py-3 px-4">
                        {/* {isEditing ? (
                          <input
                            type="date"
                            value={editEntryValues.date}
                            onChange={(e) => setEditEntryValues(prev => ({ ...prev, date: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 rounded "
                          />
                        ) : ( */}
                          <span className="text-gray-900">{date}</span>
                        {/* )} */}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="time"
                            value={editEntryValues.time}
                            onChange={(e) => setEditEntryValues(prev => ({ ...prev, time: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 rounded  "
                          />
                        ) : (
                          <span className=" text-gray-900">{time}</span>
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
                            {/* <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button> */}
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
              <p className=" text-gray-400 mt-1">Add entries using the button above.</p>
            </div>
          )}
        </div>
      </div>
    );
  }


  const from =
    total === 0
      ? 0
      : Math.min((page - 1) * perPage + 1, total);

  const to = Math.min(page * perPage, total);


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Time Reports</h2>
        </div>
    
        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>


      </div>

      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <label className=" font-medium text-gray-700">Pay Period:</label>
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
                        <span className="">Edit</span>
                      </button>
                      <button
                        onClick={() => handleViewDailyBreakdown(report.employee_id)}
                        className="flex items-center space-x-1 text-green-600 hover:bg-green-50 px-2 py-1 rounded"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="">Daily View</span>
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


        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          {/* Left: page info */}
          <p className=" text-gray-600">
            Showing <span className="font-medium">{from}</span> to{' '}
            <span className="font-medium">{to}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>

          {/* Right: controls */}
          <div className="flex items-center gap-3">
            {/* Rows per page */}
            <div className="flex items-center gap-2">
              <label className=" text-gray-600">Rows:</label>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-md 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[5, 10, 30, 50, 100, 500].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Prev / Next */}
            <div className="flex gap-2">
              <button
                disabled={loading || page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="px-3 py-1 rounded border 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-gray-100"
              >
                Prev
              </button>

              <button
                disabled={loading || page === lastPage}
                onClick={() => setPage(p => Math.min(p + 1, lastPage))}
                className="px-3 py-1 rounded border 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>


        </div>
      )}
    </div>
  );
};

export default TimeReports;