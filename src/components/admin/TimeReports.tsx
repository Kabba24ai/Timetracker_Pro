import React, { useState, useEffect, useRef } from 'react';
import { Clock, Calendar, Download, Edit, Save, X, ChevronDown, Eye, Plus, Check, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { formatHoursToTime, formatSecondsToTime } from '../../utils/helper';
import { useSettings } from '../../contexts/SettingsContext';
import Swal from "sweetalert2";

const TENANT_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'UTC';

interface TimeEntry {
  id: string;
  employee_id: string;
  break_id?: number;
  entry_type: 'clock_in' | 'clock_out' | 'lunch_out' | 'lunch_in' | 'unpaid_out' | 'unpaid_in';
  rounded_time: string;
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

const formatTimeForInput = (dateString?: string | null) => {
  if (!dateString) return "";

  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TENANT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = parts.find(p => p.type === "hour")?.value || "00";
  const minute = parts.find(p => p.type === "minute")?.value || "00";

  return `${hour}:${minute}`;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TENANT_TIMEZONE,
    weekday: 'short',
    year: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const TimeReports: React.FC = () => {
  const [reportData, setReportData] = useState<TimeReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [employeeEntries, setEmployeeEntries] = useState<TimeEntry[]>([]);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<PayPeriod | null>(null);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [showPayPeriodDropdown, setShowPayPeriodDropdown] = useState(false);
  const [showDailyBreakdown, setShowDailyBreakdown] = useState<string | null>(null);
  const [dailyBreakdownData, setDailyBreakdownData] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [periodType, setPeriodType] = useState<'current' | 'previous' | 'all'>('current');
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState<number | null>(null);
  const [activeInputs, setActiveInputs] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string[]>>({});
  const [editEntryValues, setEditEntryValues] = useState({
    date: '',
    time: '',
    entry_type: 'clock_in' as TimeEntry['entry_type'],
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const { settings } = useSettings();
  const [isEditMode, setIsEditMode] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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


  const handleAddNewTime = async (key: string) => {
    // const value = inputValues[key]?.[0];

    const value = inputRefs.current[key]?.value;

    if (!value) {
      toast.error("Please enter time");
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [key]: true }));
      const [entryId, type, side] = key.split("-");

      let entry_type = "";

      if (type === "lunch") {
        entry_type = side === "start" ? "lunch_out" : "lunch_in";
      }

      if (type === "unpaid") {
        entry_type = side === "start" ? "unpaid_out" : "unpaid_in";
      }

      await api.post("/users/time-entries/create", {
        entry_id: Number(entryId),
        break_id: null,
        entry_type,
        new_time: value,
      });


      // refresh UI
      await generateDailyBreakdown(showDailyBreakdown!);

      // cleanup
      setActiveInputs(prev => ({ ...prev, [key]: false }));

      delete inputRefs.current[key];

      toast.success("Time added successfully");

    } catch (error) {
      console.error(error);
      toast.error("Failed to add time");
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
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
  const [perPage, setPerPage] = useState(30);
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

  const refreshOpenedEmployeeData = async () => {
    if (!selectedPayPeriod) return;
    if (!showDailyBreakdown) return;

    await generateDailyBreakdown(showDailyBreakdown);
  };

  useEffect(() => {
    refreshOpenedEmployeeData();
  }, [selectedPayPeriod]);


  const fetchPayPeriods = async () => {
    try {
      const res = await api.get('/time-reports/pay-periods');

      if (!res.success) return;

      const periods = res.data;
      const currentNumber = res.current_period;

      setPayPeriods(periods);
      setCurrentPeriodNumber(currentNumber);

      const current = periods.find((p: any) => p.number === currentNumber);

      if (current) {
        setSelectedPayPeriod(current);
      }

    } catch (error) {
      console.error(error);
    }
  };
  const handlePeriodTypeChange = (type: 'current' | 'previous' | 'all') => {
    setPeriodType(type);

    if (type === 'current') {
      const current = payPeriods.find(p => p.number === currentPeriodNumber);
      if (current) setSelectedPayPeriod(current);
    }

    if (type === 'previous') {
      const index = payPeriods.findIndex(p => p.number === currentPeriodNumber);
      if (index > 0) {
        setSelectedPayPeriod(payPeriods[index - 1]);
      }
    }

    if (type === 'all') {
      setSelectedPayPeriod(null);
    }

    setShowPayPeriodDropdown(false); // cleanup
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
    return t.actual || t.adjusted || null;
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
            rounded_time: entry.clock_in.adjusted,
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
            rounded_time: l.start.adjusted,
            timestamp: normalizeTime(l.start),
            created_at: normalizeTime(l.start),
          });

          flat.push({
            id: `${entry.entry_id}-lunch-in-${i}`,
            employee_id: '',
            entry_type: 'lunch_in',
            break_id: l.id,
            rounded_time: l.end.adjusted,
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
            rounded_time: u.start.adjusted,
            timestamp: normalizeTime(u.start),
            created_at: normalizeTime(u.start),
          });

          flat.push({
            id: `${entry.entry_id}-unpaid-in-${i}`,
            employee_id: '',
            entry_type: 'unpaid_in',
            break_id: u.id,
            rounded_time: u.end.adjusted,
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
            rounded_time: entry.clock_out.adjusted,
            timestamp: normalizeTime(entry.clock_out),
            created_at: normalizeTime(entry.clock_out),
          });
        }

      });
    });

    return flat.filter(e => e.timestamp);
  };

  const handleEditEmployee = async (employeeId: string) => {

    handleViewDailyBreakdown(employeeId);

    setIsEditMode(true);

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

  const formatDateSimple = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');

    const date = new Date(Number(year), Number(month) - 1, Number(day));

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const AddTimeCell = ({
    entryId,
    type,
    side,
    breaks
  }: {
    entryId: number | string;
    type: "lunch" | "unpaid";
    side: "start" | "end";
    breaks: any[] | undefined;
  }) => {
    const key = `${entryId}-${type}-${side}`;


    const hasStart = breaks?.some(b => b?.start?.adjusted);
    const hasEnd = breaks?.some(b => b?.end?.adjusted);

    //  special case: END should be "-" when nothing exists
    if (side === "end" && !hasStart && !hasEnd) {
      return <span className="text-gray-400">-</span>;
    }

    const shouldShowAdd =
      (side === "start" && !hasStart) ||
      (side === "end" && hasStart && !hasEnd);


    if (shouldShowAdd && !activeInputs[key]) {
      return (
        <button

          onClick={() => {
            const [entryId, type, side] = key.split("-");

            let defaultTime = "";

            //  only for END
            if (side === "end") {

              const entry = dailyBreakdownData
                .flatMap(d => d.entries)
                .find(e => e.entry_id == entryId);

              let startTime = null;

              if (type === "lunch") {
                startTime = entry?.lunch_breaks?.[0]?.start?.adjusted;
              }

              if (type === "unpaid") {
                startTime = entry?.unpaid_breaks?.[0]?.start?.adjusted;
              }

              //  SETTINGS BASED DURATION
              const duration =
                settings?.minimum_lunch_duration_minutes || 30;

              console.log('duration :-', duration);

              if (startTime) {
                const start = formatTimeForInput(startTime); // "HH:mm"

                console.log(start);

                if (start) {
                  let [h, m] = start.split(":").map(Number);

                  m += duration;
                  h += Math.floor(m / 60);
                  m = m % 60;
                  h = h % 24;

                  defaultTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                }
              }
            }

            //  open input
            setActiveInputs(prev => ({
              ...prev,
              [key]: true
            }));

            //  pre-fill input value
            if (defaultTime) {
              setInputValues(prev => ({
                ...prev,
                [key]: [defaultTime]
              }));
            }
          }}

          className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition"
        >
          + Add Time
        </button>
      );
    }

    if (shouldShowAdd && activeInputs[key]) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="time"

            defaultValue={inputValues[key]?.[0] || ""}
            ref={(el) => (inputRefs.current[key] = el)}
            autoFocus

            className="px-2 py-1 border border-gray-300 rounded"

          />

          {/*  SAVE BUTTON */}
          <button
            onClick={() => handleAddNewTime(key)}
            className="p-1 text-green-600"
          >
            {actionLoading[key] ? (
              <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
          </button>

          {/* CLOSE */}
          <button
            onClick={() => {
              setActiveInputs(prev => ({ ...prev, [key]: false }));

              // setInputValues(prev => {
              //   const updated = { ...prev };
              //   delete updated[key];
              //   return updated;
              // });

              delete inputRefs.current[key];
            }}
            className="p-1 text-gray-500 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return <span className="text-gray-400">-</span>;
  };

  const AddClockTimeCell = ({
    date,
    type
  }: {
    date: string;
    type: "clock_in" | "clock_out";
  }) => {

    const key = `${date}-${type}`;

    if (!activeInputs[key]) {
      return (
        <button
          onClick={() => {
            setActiveInputs(prev => ({ ...prev, [key]: true }));
          }}

          className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition"
        >
          + Add Time
        </button>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <input
          type="time"
          // value={inputValues[key]?.[0] || ""}
          // onChange={(e) => {
          //   setInputValues(prev => ({
          //     ...prev,
          //     [key]: [e.target.value]
          //   }));
          // }}

          defaultValue={inputValues[key]?.[0] || ""}
          ref={(el) => (inputRefs.current[key] = el)}
          autoFocus
          className="px-2 py-1 border border-gray-300 rounded"
        />

        <button
          onClick={async () => {
            // const value = inputValues[key]?.[0];

            const value = inputRefs.current[key]?.value;

            if (!value) {
              toast.error("Please enter time");
              return;
            }


            try {

              setActionLoading(prev => ({ ...prev, [key]: true }));


              await api.post("/users/time-entries/create-empty", {
                user_id: showDailyBreakdown,
                date,
                entry_type: type,
                time: value
              });

              await generateDailyBreakdown(showDailyBreakdown!);



              setActiveInputs(prev => ({ ...prev, [key]: false }));


              delete inputRefs.current[key];

              toast.success("Time added");
            } catch (e) {
              toast.error("Failed");
            } finally {
              setActionLoading(prev => ({ ...prev, [key]: false }));
            }
          }}
          className="text-green-600"
        >
          {actionLoading[key] ? (
            <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
        </button>

        <button
          onClick={() => {
            setActiveInputs(prev => ({ ...prev, [key]: false }));

            // setInputValues(prev => {
            //   const updated = { ...prev };
            //   delete updated[key];
            //   return updated;
            // });

            delete inputRefs.current[key];

          }}
          className="text-gray-500"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const EditInputCell = ({
    adjusted,
    actual,
    entryId,
    breakId,
    entryType
  }: {
    adjusted?: string | null;
    actual?: string | null;
    entryId: number;
    breakId?: number | null;
    entryType: string;
  }) => {

    if (!adjusted) return <span className="text-gray-400">-</span>;

    const oldTime = formatTimeForInput(adjusted);

    const key = `${entryId}-${entryType}-${breakId ?? 0}`;

    const currentValue =
      editedValues[key]?.new_time ?? oldTime;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value;

      setEditedValues(prev => ({
        ...prev,
        [key]: {
          entry_id: entryId,
          break_id: breakId ?? null,
          entry_type: entryType,
          old_time: oldTime,
          new_time: newTime
        }
      }));
    };

    return (
      <div className="flex items-start gap-2">
        <div>
          <input
            type="time"
            value={currentValue}
            onChange={handleChange}
            className="px-2 py-1 border border-gray-300 rounded"
          />

          {actual && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="italic text-gray-500">
                {formatTime(new Date(actual))}
              </span>

              <button
                onClick={() =>
                  handleDeleteEntry({
                    entry_id: entryId,
                    break_id: breakId ?? null,
                    entry_type: entryType,
                  })
                }
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            // <div className="italic text-gray-500 text-center mt-1">
            //   {formatTime(new Date(actual))}
            // </div>
          )}
        </div>
      </div>

    );
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


    if (count === 0) {
      return <span className="text-gray-400">-</span>;
    }

    // ENTRY TYPE AUTO
    const getEntryType = () => {

      if (type === "lunch") {
        return side === "start"
          ? "lunch_in"
          : "lunch_out";
      }

      return side === "start"
        ? "unpaid_in"
        : "unpaid_out";
    };

    //  single break -> show directly
    if (count === 1) {
      const b = breaks![0];
      return (
        <div className="flex items-center gap-2">
          <TimeCell
            adjusted={b?.[side]?.adjusted}
            actual={b?.[side]?.actual}
            className={colorClass}
          />

          {/* {b?.[side]?.adjusted != null && (

            <button
              onClick={() =>
                handleDeleteEntry({
                  entry_id: Number(entryId),
                  break_id: b?.id,
                  entry_type: getEntryType(),
                })
              }
              className="
                flex items-center justify-center
                w-8 h-8
                rounded-lg
                bg-red-500
                hover:bg-red-600
                text-white
                shadow-sm
                transition-all duration-200
                hover:scale-105
                active:scale-95
                shrink-0
              "
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )} */}
        </div>
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
              className={`inline-block transition-transform duration-200 ${openBreaks[key] ? "rotate-90" : ""
                }`}
            >
              ▸
            </span>
            {count} breaks
          </button>

          {openBreaks[key] && (
            <div className="mt-2 space-y-1 rounded-md bg-white p-2 border border-gray-300 shadow-sm">
              {breaks!.map((b, i) => (
                <>
                  <TimeCell
                    key={i}
                    adjusted={b?.[side]?.adjusted}
                    actual={b?.[side]?.actual}
                    className={colorClass}
                  />
                  {/* {b?.[side]?.adjusted != null && (
                    <button
                      onClick={() =>
                        handleDeleteEntry({
                          entry_id: Number(entryId),
                          break_id: b?.id,
                          entry_type: getEntryType(),
                        })
                      }
                      className="
                      flex items-center justify-center
                      w-8 h-8
                      rounded-lg
                      bg-red-500
                      hover:bg-red-600
                      text-white
                      shadow-sm
                      transition-all duration-200
                      hover:scale-105
                      active:scale-95
                      shrink-0
                    "
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )} */}
                </>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const CloseTheView = async () => {
    setShowDailyBreakdown(null);
    setIsEditMode(false);
    fetchTimeReports();
  };

  const handleSaveAllChanges = async () => {

    const updates = Object.values(editedValues);

    if (!updates.length) {
      toast("No changes detected");
      return;
    }

    try {
      setSaving(true);
      await toast.promise(

        api.post("/users/time-entries/bulk-update", { updates }),

        {
          loading: "Saving time changes...",
          success: "Times updated successfully",
          error: "Update failed",
        }

      );

      setEditedValues({});
      // setIsEditMode(false);
      await generateDailyBreakdown(showDailyBreakdown!);

    } catch (error) {

      console.error(error);

    } finally {
      setSaving(false);
      setIsEditMode(false);
    }

  };


  const handleDeleteEntry = async ({
    entry_id,
    break_id = null,
    entry_type,
  }: {
    entry_id: number;
    break_id?: number | null;
    entry_type: string;
  }) => {

    const result = await Swal.fire({
      title: "Delete Time Entry?",
      text: "Are you sure you want to delete this item? Deleted entries cannot be recovered.",
      icon: "warning",

      showCancelButton: true,

      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",

      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",

      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {

      await api.post("/users/time-entries/delete", {
        entry_id,
        break_id,
        entry_type,
      });

      toast.success("Entry deleted successfully");

      await generateDailyBreakdown(showDailyBreakdown!);

    } catch (error) {

      console.error(error);

      toast.error("Failed to delete entry");
    }
  };

  if (showDailyBreakdown) {
    const employee = reportData.find(r => r.employee_id === showDailyBreakdown);

    const grandTotals = dailyBreakdownData.reduce(
      (acc, day) => {

        acc.worked += Number(day.totals?.worked_hours ?? 0);

        acc.unpaid += Number(day.totals?.unpaid_hours ?? 0);

        acc.paid += Number(day.totals?.paid_hours ?? 0);

        return acc;

      },
      {
        worked: 0,
        unpaid: 0,
        paid: 0,
      }
    );


    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => CloseTheView()}
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

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors ${isEditMode ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-800"
                }`}
            >
              {isEditMode ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              <span>{isEditMode ? "Exit Edit" : "Edit"}</span>
            </button>

            {isEditMode ? <button
              onClick={handleSaveAllChanges}
              disabled={saving}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button> : ''}


            <button
              onClick={() => handleUserTimeEntryCSV(showDailyBreakdown)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>

          </div>

        </div>

        <div className="flex items-center justify-between mt-3">

          {/* LEFT: options */}
          <div className="flex items-center gap-6">

            {/* CURRENT */}
            <button
              onClick={() => handlePeriodTypeChange('current')}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center
        ${periodType === 'current'
                  ? 'border-gray-700'
                  : 'border-gray-300'}
      `}>
                {periodType === 'current' && (
                  <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                )}
              </span>

              <span className="text-gray-900 font-medium">
                Current:
              </span>

              <span className="text-gray-600">
                {payPeriods.find(p => p.number === currentPeriodNumber)?.label}
              </span>
            </button>


            {/* PREVIOUS */}
            <button
              onClick={() => handlePeriodTypeChange('previous')}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center
        ${periodType === 'previous'
                  ? 'border-gray-700'
                  : 'border-gray-300'}
      `}>
                {periodType === 'previous' && (
                  <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                )}
              </span>

              <span className="text-gray-900 font-medium">
                Previous:
              </span>

              <span className="text-gray-600">
                {payPeriods[
                  payPeriods.findIndex(p => p.number === currentPeriodNumber) - 1
                ]?.label}
              </span>
            </button>


            {/* ALL */}
            <button
              onClick={() => handlePeriodTypeChange('all')}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center
        ${periodType === 'all'
                  ? 'border-gray-700'
                  : 'border-gray-300'}
      `}>
                {periodType === 'all' && (
                  <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                )}
              </span>

              <span className="text-gray-900 font-medium">All</span>
            </button>

          </div>

          {/* RIGHT: dropdown */}
          <div className="relative">
            <button
              disabled={periodType !== 'all'}
              onClick={() => {
                if (periodType === 'all') {
                  setShowPayPeriodDropdown(!showPayPeriodDropdown);
                }
              }}
              className={`w-80 px-4 py-2 text-sm text-left border rounded-lg flex items-center justify-between
        ${periodType !== 'all'
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white border-gray-300 hover:bg-gray-50'}
      `}
            >
              <span className="truncate text-gray-700">
                {selectedPayPeriod
                  ? `Period ${selectedPayPeriod.number}: ${selectedPayPeriod.label}`
                  : 'Select pay period'}
              </span>

              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showPayPeriodDropdown && (
              <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-md max-h-60 overflow-y-auto z-20">
                {payPeriods.map((period) => (
                  <button
                    key={period.number}
                    onClick={() => {
                      setSelectedPayPeriod(period);
                      setShowPayPeriodDropdown(false);
                      setPeriodType('all');
                    }}
                    className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50
              ${selectedPayPeriod?.number === period.number
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-700'}
            `}
                  >
                    Period {period.number}: {period.label}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full ">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Date</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Clock In</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Lunch  Start</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Lunch  End</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Unpaid Start</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Unpaid End</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900">Clock Out</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900 text-center">Total Paid</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900 text-center">Total Unpaid</th>
                  <th className="whitespace-nowrap text-left px-2 py-3 font-medium text-gray-900 text-center">Total Hours</th>
                </tr>
              </thead>

              <tbody>
                {dailyBreakdownData.map((day, dayIndex) => {

                  const entryCount = day.entries?.length ?? 0;

                  const isSingle = entryCount === 1;
                  const isEmpty = entryCount === 0;
                  const isOpen = !isSingle && !!openDays[day.date];
                  const entry = day.entries?.[0];
                  const dayBg =
                    dayIndex % 2 === 0 ? "bg-white" : "bg-gray-50";

                  const dayHover =
                    dayIndex % 2 === 0 ? " " : " ";

                  return (
                    <React.Fragment key={day.date}>
                      {/* DAY SUMMARY ROW */}
                      <tr className={`border-b border-gray-300 ${dayBg} ${dayHover} transition-colors`}>
                        <td className="whitespace-nowrap py-3 px-2 font-medium text-gray-900">
                          <button
                            onClick={() => {
                              if (!isSingle) toggleDay(day.date);
                            }}
                            className={`flex items-center  ${entryCount > 1 ? 'hover:text-blue-600' : 'cursor-default'
                              }`}
                          >
                            <span className="whitespace-nowrap inline-block w-4">
                              {entryCount > 1 && (
                                <span
                                  className={`inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''
                                    }`}
                                >
                                  ▸
                                </span>
                              )}
                            </span>
                            {/* {formatDate(new Date(day.date))} */}
                            {formatDateSimple(day.date)}
                          </button>
                        </td>

                        {/* Show dash in time columns for summary row */}
                        {/* TIME COLUMNS */}
                        {isEmpty ? (
                          <>
                            {/* CLOCK IN */}
                            <td className="py-3 px-2">
                              {isEditMode ? (
                                <AddClockTimeCell date={day.date} type="clock_in" />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>

                            {/* LUNCH START */}
                            <td className="py-3 px-2 text-gray-400">-</td>

                            {/* LUNCH END */}
                            <td className="py-3 px-2 text-gray-400">-</td>

                            {/* UNPAID START */}
                            <td className="py-3 px-2 text-gray-400">-</td>

                            {/* UNPAID END */}
                            <td className="py-3 px-2 text-gray-400">-</td>

                            {/* CLOCK OUT */}
                            <td className="py-3 px-2 text-gray-400">-</td>
                          </>
                        ) : isSingle ? (
                          <>
                            {/* Clock In */}
                            <td className="whitespace-nowrap py-3 px-2 ">
                              {isEditMode ? (
                                <EditInputCell
                                  adjusted={entry.clock_in?.adjusted}
                                  actual={entry.clock_in?.actual}
                                  entryId={entry.entry_id}
                                  breakId={null}
                                  entryType="clock_in"
                                />
                              ) : (
                                <div className="flex items-center  gap-3 ">
                                  <TimeCell
                                    adjusted={entry.clock_in?.adjusted}
                                    actual={entry.clock_in?.actual}
                                    className="text-green-600"
                                  />

                                  {/* <button
                                    onClick={() =>
                                      handleDeleteEntry({
                                        entry_id: entry.entry_id,
                                        entry_type: "clock_in",
                                      })
                                    }
                                    className="
                                    flex items-center justify-center
                                    w-8 h-8
                                    rounded-lg
                                    bg-red-500
                                    hover:bg-red-600
                                    text-white
                                    shadow-sm
                                    transition-all duration-200
                                    hover:scale-105
                                    active:scale-95
                                  "
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button> */}
                                </div>
                              )}

                            </td>

                            {/* Lunch Start */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">

                              {isEditMode ? (

                                entry?.lunch_breaks?.length ? (
                                  <EditInputCell
                                    adjusted={entry?.lunch_breaks?.[0]?.start?.adjusted ?? null}
                                    actual={entry?.lunch_breaks?.[0]?.start?.actual ?? null}
                                    entryId={entry.entry_id}
                                    breakId={entry?.lunch_breaks?.[0]?.id ?? null}
                                    entryType="lunch_out"
                                  />
                                ) : (
                                  <AddTimeCell
                                    entryId={entry.entry_id}
                                    type="lunch"
                                    side="start"
                                    breaks={entry?.lunch_breaks}
                                  />
                                )

                              ) : (


                                <BreakCell
                                  breaks={entry?.lunch_breaks}
                                  type="lunch"
                                  side="start"
                                  entryId={entry?.entry_id}
                                  colorClass="text-orange-600"
                                />



                              )}


                            </td>

                            {/* Lunch End */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">


                              {isEditMode ? (

                                entry?.lunch_breaks?.[0]?.end?.adjusted ? (
                                  <EditInputCell
                                    adjusted={entry?.lunch_breaks?.[0]?.end?.adjusted ?? null}
                                    actual={entry?.lunch_breaks?.[0]?.end?.actual ?? null}
                                    entryId={entry.entry_id}
                                    breakId={entry?.lunch_breaks?.[0]?.id ?? null}
                                    entryType="lunch_in"
                                  />
                                ) : (
                                  <AddTimeCell
                                    entryId={entry.entry_id}
                                    type="lunch"
                                    side="end"
                                    breaks={entry?.lunch_breaks}
                                  />
                                )


                              ) : (
                                <BreakCell
                                  breaks={entry?.lunch_breaks}
                                  type="lunch"
                                  side="end"
                                  entryId={entry?.entry_id}
                                  colorClass="text-orange-600"
                                />

                              )}


                            </td>

                            {/* Unpaid Start */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">



                              {isEditMode ? (

                                entry?.unpaid_breaks?.length ? (
                                  <EditInputCell
                                    adjusted={entry?.unpaid_breaks?.[0]?.start?.adjusted ?? null}
                                    actual={entry?.unpaid_breaks?.[0]?.start?.actual ?? null}
                                    entryId={entry.entry_id}
                                    breakId={entry?.unpaid_breaks?.[0]?.id ?? null}
                                    entryType="unpaid_out"
                                  />

                                ) : (
                                  <AddTimeCell
                                    entryId={entry.entry_id}
                                    type="unpaid"
                                    side="start"
                                    breaks={entry?.unpaid_breaks}
                                  />
                                )


                              ) : (

                                <BreakCell
                                  breaks={entry?.unpaid_breaks}
                                  type="unpaid"
                                  side="start"
                                  entryId={entry?.entry_id}
                                  colorClass="text-purple-600"
                                />

                              )}


                            </td>

                            {/* Unpaid End */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">


                              {isEditMode ? (

                                entry?.unpaid_breaks?.[0]?.end?.adjusted ? (
                                  <EditInputCell
                                    adjusted={entry?.unpaid_breaks?.[0]?.end?.adjusted ?? null}
                                    actual={entry?.unpaid_breaks?.[0]?.end?.actual ?? null}
                                    entryId={entry.entry_id}
                                    breakId={entry?.unpaid_breaks?.[0]?.id ?? null}
                                    entryType="unpaid_in"
                                  />
                                ) : (
                                  <AddTimeCell
                                    entryId={entry.entry_id}
                                    type="unpaid"
                                    side="end"
                                    breaks={entry?.unpaid_breaks}
                                  />
                                )


                              ) : (

                                <BreakCell
                                  breaks={entry?.unpaid_breaks}
                                  type="unpaid"
                                  side="end"
                                  entryId={entry?.entry_id}
                                  colorClass="text-purple-600"
                                />

                              )}


                            </td>

                            {/* Clock Out */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">

                              {isEditMode ? (

                                entry.clock_out ? (

                                  <EditInputCell
                                    adjusted={entry.clock_out?.adjusted}
                                    actual={entry.clock_out?.actual}
                                    entryId={entry.entry_id}
                                    breakId={null}
                                    entryType="clock_out"
                                  />

                                ) : (

                                  <AddClockTimeCell
                                    date={day.date}
                                    type="clock_out"
                                  />

                                )

                              ) : (

                                <div className="flex items-center  gap-3 ">
                                  <TimeCell
                                    adjusted={entry.clock_out?.adjusted}
                                    actual={entry.clock_out?.actual}
                                    className="text-red-600"
                                  />
                                  {/* {entry.clock_out?.adjusted != null && (

                                    <button
                                      onClick={() =>
                                        handleDeleteEntry({
                                          entry_id: entry.entry_id,
                                          entry_type: "clock_out",
                                        })
                                      }
                                      className="
                                    flex items-center justify-center
                                    w-8 h-8
                                    rounded-lg
                                    bg-red-500
                                    hover:bg-red-600
                                    text-white
                                    shadow-sm
                                    transition-all duration-200
                                    hover:scale-105
                                    active:scale-95
                                  "
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )} */}
                                </div>

                              )}

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
                        <td className=" text-green-600 font-semibold text-center">
                          {formatHoursToTime(day.totals?.paid_hours ?? 0)}

                          {/* {day.totals?.paid_hours ?? 0} */}
                        </td>

                        <td className="  text-red-600 font-semibold text-center">
                          {formatHoursToTime(day.totals?.unpaid_hours ?? 0)}

                          {/* {day.totals?.unpaid_hours ?? 0} */}
                        </td>

                        <td className="  text-blue-600 font-semibold text-center">
                          {formatHoursToTime(day.totals?.worked_hours ?? 0)}

                          {/* {day.totals?.worked_hours ?? 0} */}
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

                              {isEditMode ? (

                                <EditInputCell
                                  adjusted={entry.clock_in?.adjusted}
                                  actual={entry.clock_in?.actual}
                                  entryId={entry.entry_id}
                                  breakId={null}
                                  entryType="clock_in"
                                />

                              ) : (

                                <div className="flex items-center  gap-3 ">
                                  <TimeCell
                                    adjusted={entry.clock_in?.adjusted}
                                    actual={entry.clock_in?.actual}
                                    className="text-green-600"
                                  />

                                  {/* <button
                                    onClick={() =>
                                      handleDeleteEntry({
                                        entry_id: entry.entry_id,
                                        entry_type: "clock_in",
                                      })
                                    }
                                    className="
                                    flex items-center justify-center
                                    w-8 h-8
                                    rounded-lg
                                    bg-red-500
                                    hover:bg-red-600
                                    text-white
                                    shadow-sm
                                    transition-all duration-200
                                    hover:scale-105
                                    active:scale-95
                                  "
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button> */}
                                </div>


                              )}

                            </td>

                            {/* Lunch Start / End (show first lunch break or list) */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">

                              {isEditMode ? (


                                <div className="space-y-1 grid">
                                  {entry?.lunch_breaks?.length
                                    ? entry.lunch_breaks.map((b: any, i: number) => (

                                      <EditInputCell
                                        key={i}
                                        adjusted={b?.start?.adjusted ?? null}
                                        actual={b?.start?.actual ?? null}
                                        entryId={entry.entry_id}
                                        breakId={b?.id ?? null}
                                        entryType="lunch_out"
                                      />


                                    ))
                                    : (
                                      <AddTimeCell
                                        entryId={entry.entry_id}
                                        type="lunch"
                                        side="start"
                                        breaks={entry.lunch_breaks}
                                      />
                                    )
                                  }
                                </div>

                              ) : (
                                <BreakCell
                                  breaks={entry.lunch_breaks}
                                  type="lunch"
                                  side="start"
                                  entryId={entry.entry_id}
                                  colorClass="text-orange-600"
                                />

                              )}



                            </td>

                            <td className="whitespace-nowrap py-3 px-2 align-top">

                              {isEditMode ? (

                                <div className="space-y-1 grid">
                                  {


                                    entry.lunch_breaks.map((b: any, i: number) => (

                                      b?.end?.adjusted ? (
                                        <EditInputCell
                                          key={i}
                                          adjusted={b.end.adjusted}
                                          actual={b.end.actual}
                                          entryId={entry.entry_id}
                                          breakId={b?.id ?? null}
                                          entryType="lunch_in"
                                        />
                                      ) : (
                                        <AddTimeCell
                                          key={i}
                                          entryId={entry.entry_id}
                                          type="lunch"
                                          side="end"
                                          breaks={[b]}
                                        />
                                      )

                                    ))
                                  }
                                </div>

                              ) : (
                                <BreakCell
                                  breaks={entry.lunch_breaks}
                                  type="lunch"
                                  side="end"
                                  entryId={entry.entry_id}
                                  colorClass="text-orange-600"
                                />

                              )}

                            </td>

                            {/* Unpaid Start / End */}
                            <td className="whitespace-nowrap py-3 px-2 align-top">

                              {isEditMode ? (

                                <div className="space-y-1 grid">
                                  {entry?.unpaid_breaks?.length
                                    ? entry.unpaid_breaks.map((b: any, i: number) => (


                                      <EditInputCell
                                        key={i}
                                        adjusted={b?.start?.adjusted ?? null}
                                        actual={b?.start?.actual ?? null}
                                        entryId={entry.entry_id}
                                        breakId={b?.id ?? null}
                                        entryType="unpaid_out"
                                      />


                                    ))
                                    : (
                                      <AddTimeCell
                                        entryId={entry.entry_id}
                                        type="unpaid"
                                        side="start"
                                        breaks={entry.unpaid_breaks}
                                      />
                                    )
                                  }
                                </div>

                              ) : (

                                <BreakCell
                                  breaks={entry.unpaid_breaks}
                                  type="unpaid"
                                  side="start"
                                  entryId={entry.entry_id}
                                  colorClass="text-purple-600"
                                />

                              )}


                            </td>

                            <td className="whitespace-nowrap py-3 px-2 align-top">

                              {isEditMode ? (

                                <div className="space-y-1 grid">
                                  {


                                    entry?.unpaid_breaks?.length
                                      ? entry.unpaid_breaks.map((b: any, i: number) => (

                                        b?.end?.adjusted ? (
                                          <EditInputCell
                                            key={i}
                                            adjusted={b.end.adjusted}
                                            actual={b.end.actual}
                                            entryId={entry.entry_id}
                                            breakId={b?.id ?? null}
                                            entryType="unpaid_in"
                                          />
                                        ) : (
                                          <AddTimeCell
                                            key={i}
                                            entryId={entry.entry_id}
                                            type="unpaid"
                                            side="end"
                                            breaks={[b]}
                                          />
                                        )

                                      ))
                                      : (
                                        <AddTimeCell
                                          entryId={entry.entry_id}
                                          type="unpaid"
                                          side="end"
                                          breaks={entry.unpaid_breaks}
                                        />
                                      )

                                  }
                                </div>

                              ) : (

                                <BreakCell
                                  breaks={entry.unpaid_breaks}
                                  type="unpaid"
                                  side="end"
                                  entryId={entry.entry_id}
                                  colorClass="text-purple-600"
                                />

                              )}

                            </td>

                            {/* Clock Out */}
                            <td className="py-3 px-2">

                              {isEditMode ? (

                                <EditInputCell
                                  adjusted={entry.clock_out?.adjusted}
                                  actual={entry.clock_out?.actual}
                                  entryId={entry.entry_id}
                                  breakId={null}
                                  entryType="clock_out"
                                />

                              ) : (


                                <div className="flex items-center  gap-3 ">
                                  <TimeCell
                                    adjusted={entry.clock_out?.adjusted}
                                    actual={entry.clock_out?.actual}
                                    className="text-red-600"
                                  />
                                  {/* {entry.clock_out?.adjusted != null && (

                                    <button
                                      onClick={() =>
                                        handleDeleteEntry({
                                          entry_id: entry.entry_id,
                                          entry_type: "clock_out",
                                        })
                                      }
                                      className="
                                    flex items-center justify-center
                                    w-8 h-8
                                    rounded-lg
                                    bg-red-500
                                    hover:bg-red-600
                                    text-white
                                    shadow-sm
                                    transition-all duration-200
                                    hover:scale-105
                                    active:scale-95
                                  "
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )} */}
                                </div>

                              )}

                            </td>


                            <td className="text-center font-semibold text-green-700 bg-green-50">
                              {formatSecondsToTime(Number(entry.paid_seconds ?? 0))}

                              {/* {(Number(entry.paid_seconds ?? 0) / 3600).toFixed(2)} */}
                            </td>

                            <td className="text-center font-semibold text-red-700 bg-red-50">
                              {formatSecondsToTime(Number(entry.unpaid_seconds ?? 0))}

                              {/* {(Number(entry.unpaid_seconds ?? 0) / 3600).toFixed(2)} */}
                            </td>

                            {/* Entry totals (instead of repeating day totals) */}
                            <td className="text-center font-semibold text-blue-700 bg-blue-50">
                              {formatSecondsToTime(Number(entry.worked_seconds ?? 0))}
                              {/* {(Number(entry.worked_seconds ?? 0) / 3600).toFixed(2)} */}
                            </td>

                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}

                <tr className="border-t-2 border-gray-400 bg-gray-100 sticky bottom-0">

                  <td
                    colSpan={7}
                    className="py-4 px-2 text-right font-bold text-gray-900"
                  >
                    Grand Totals
                  </td>
                  <td className="text-center font-bold text-green-700 bg-green-100">
                    {formatHoursToTime(grandTotals.paid)}
                  </td>


                  <td className="text-center font-bold text-red-700 bg-red-100">
                    {formatHoursToTime(grandTotals.unpaid)}
                  </td>

                  <td className="text-center font-bold text-blue-700 bg-blue-100">
                    {formatHoursToTime(grandTotals.worked)}
                  </td>

                </tr>
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
            <p>• <strong>Large Times:</strong> Adjusted times rounded to the nearest increment for payroll</p>
            <p>• <strong>Small Italic Times:</strong> The exact time the employee clocked in/out</p>
            <p>• <strong>Color Coding:</strong> Blue = Clock In Times, Red = Clock Out Times</p>

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

        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Entry Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actual Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Shift Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeEntries.map((entry) => {
                  const { date, time } = formatDateTime(entry.timestamp);

                  const rounded_time = formatTime(new Date(entry.rounded_time));


                  const isEditing = editingEntry === entry.id;

                  return (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-white">
                      <td className="py-3 px-4">

                        <span className={`inline-flex px-3 py-1  font-medium rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                          {getEntryTypeLabel(entry.entry_type)}
                        </span>

                      </td>
                      <td className="py-3 px-4">

                        <span className="text-gray-900">{date}</span>

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
                        <span className=" text-gray-900">{rounded_time}</span>
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


        <div className="flex items-center justify-between mt-3">

          {/* LEFT: options */}
          <div className="flex items-center gap-6">

            {/* CURRENT */}
            <button
              onClick={() => handlePeriodTypeChange('current')}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center
        ${periodType === 'current'
                  ? 'border-gray-700'
                  : 'border-gray-300'}
      `}>
                {periodType === 'current' && (
                  <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                )}
              </span>

              <span className="text-gray-900 font-medium">
                Current:
              </span>

              <span className="text-gray-600">
                {payPeriods.find(p => p.number === currentPeriodNumber)?.label}
              </span>
            </button>


            {/* PREVIOUS */}
            <button
              onClick={() => handlePeriodTypeChange('previous')}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center
        ${periodType === 'previous'
                  ? 'border-gray-700'
                  : 'border-gray-300'}
      `}>
                {periodType === 'previous' && (
                  <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                )}
              </span>

              <span className="text-gray-900 font-medium">
                Previous:
              </span>

              <span className="text-gray-600">
                {payPeriods[
                  payPeriods.findIndex(p => p.number === currentPeriodNumber) - 1
                ]?.label}
              </span>
            </button>


            {/* ALL */}
            <button
              onClick={() => handlePeriodTypeChange('all')}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center
        ${periodType === 'all'
                  ? 'border-gray-700'
                  : 'border-gray-300'}
      `}>
                {periodType === 'all' && (
                  <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
                )}
              </span>

              <span className="text-gray-900 font-medium">All</span>
            </button>

          </div>


          {/* RIGHT: dropdown */}
          <div className="relative">
            <button
              disabled={periodType !== 'all'}
              onClick={() => {
                if (periodType === 'all') {
                  setShowPayPeriodDropdown(!showPayPeriodDropdown);
                }
              }}
              className={`w-80 px-4 py-2 text-sm text-left border rounded-lg flex items-center justify-between
        ${periodType !== 'all'
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white border-gray-300 hover:bg-gray-50'}
      `}
            >
              <span className="truncate text-gray-700">
                {selectedPayPeriod
                  ? `Period ${selectedPayPeriod.number}: ${selectedPayPeriod.label}`
                  : 'Select pay period'}
              </span>

              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showPayPeriodDropdown && (
              <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-md max-h-60 overflow-y-auto z-20">
                {payPeriods.map((period) => (
                  <button
                    key={period.number}
                    onClick={() => {
                      setSelectedPayPeriod(period);
                      setShowPayPeriodDropdown(false);
                      setPeriodType('all');
                    }}
                    className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50
              ${selectedPayPeriod?.number === period.number
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-700'}
            `}
                  >
                    Period {period.number}: {period.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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

                  <th className="text-left py-3 px-4 font-medium text-gray-900">Paid Hours</th>

                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Lunch Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Unpaid Hours</th>

                  <th className="text-left py-3 px-4 font-medium text-gray-900">Vacation Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((report) => (
                  <tr key={report.employee_id} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-3 px-4 font-medium text-gray-900">{report.employee_name}</td>

                    <td className="py-3 px-4 text-green-600 font-semibold">
                      {formatHoursToTime(report.paid_hours)}
                      {/* {report.paid_hours.toFixed(2)} */}
                    </td>

                    <td className="py-3 px-4 text-blue-600 font-semibold">
                      {formatHoursToTime(report.total_hours)}
                      {/* {report.total_hours.toFixed(2)} */}
                    </td>
                    <td className="py-3 px-4 text-orange-600 font-medium">
                      {formatHoursToTime(report.lunch_hours)}
                      {/* {report.lunch_hours.toFixed(2)} */}
                    </td>
                    <td className="py-3 px-4 text-red-600 font-medium">
                      {formatHoursToTime(report.unpaid_hours)}
                      {/* {report.unpaid_hours.toFixed(2)} */}
                    </td>

                    <td className="py-3 px-4 text-purple-600 font-semibold">
                      {formatHoursToTime(report.vacation_hours)}
                      {/* {report.vacation_hours.toFixed(2)} */}
                    </td>
                    <td className="py-3 px-4 flex">
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
                        <span className=""> View</span>
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