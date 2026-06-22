import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Edit, Save, X, Users, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext'
import { formatHoursToTime } from '../utils/helper';

const TENANT_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'UTC';


const parseDate = (dateStr: string) => {
  if (!dateStr) return new Date();

  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};


interface WorkDay {
  date: string
  employee_id: string
  start_time: string
  end_time: string
  store_id?: number
  store_location?: string
  is_scheduled: boolean
  hours: number
  notes?: string
}

interface RoleWithColor {
  name: string
  color: string
}

interface StoreSchedule {
  day: string
  open: string
  close: string
  is_closed: boolean
}

interface Employee {
  id: string
  name: string
  primary_store: string
  role: string
  roles: string[]
  roles_with_color: RoleWithColor[]

  store?: {
    id: number
    store_name: string
    weekly_schedule: StoreSchedule[]
  }
}

const EmpWorkSchedule: React.FC = () => {

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [storeLocations, setStoreLocations] = useState<string[]>([]);

  const { settings } = useSettings()

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [workDays, setWorkDays] = useState<{ [employeeId: string]: WorkDay[] }>({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ employeeId: string; date: string } | null>(null);
  const [editValues, setEditValues] = useState<Partial<WorkDay>>({});
  const [roleFilters, setRoleFilters] = useState<{ [role: string]: boolean }>({});
  const [storeFilters, setStoreFilters] = useState<{ [store: string]: boolean }>({});
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [showEmployees, setShowEmployees] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'1week' | '2week'>('1week');
  const [weekType, setWeekType] = useState<'current' | 'next' | 'previous' | 'all'>('current');

  const storeColors = [
    '#E0E7FF', // indigo (slightly stronger)
    '#DCFCE7', // green
    '#DBEAFE', // blue
    '#F1F5F9', // neutral gray
    '#E9D5FF', // violet
  ];

  const formatDateToYMD = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TENANT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;

    return `${y}-${m}-${d}`; // YYYY-MM-DD
  };

  const getStoreColor = (storeName: string) => {
    const stores = Object.keys(storeFilters);
    const index = stores.indexOf(storeName);

    if (index === -1) return '#F3F4F6'; // fallback gray

    return storeColors[index % storeColors.length];
  };

  // Sort employees by role (admin first) then alphabetically
  const filteredAndSortedEmployees = [...employees]
    .filter(emp => {

      const roleMatch =
        Object.keys(roleFilters).length === 0 ||
        emp.roles?.some(role => roleFilters[role]);

      const storeMatch =
        Object.keys(storeFilters).length === 0 ||
        storeFilters[emp.primary_store];

      return roleMatch && storeMatch;
    })
    .sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';

      const nameCompare = nameA.localeCompare(nameB);
      if (nameCompare !== 0) return nameCompare;

      const roleA = a.role || '';
      const roleB = b.role || '';

      return roleA.localeCompare(roleB);
    });

  useEffect(() => {
    // Set current week as default (find the Sunday of current week)
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay); // Go back to Sunday of current week
    setSelectedWeek(formatDateToYMD(sunday));
    fetchEmployees();
    fetchStores();
   console.log(new Date().toString());
  }, []);

  useEffect(() => {
    if (selectedEmployees.length > 0 && selectedWeek) {
      fetchWorkSchedule();
    }
  }, [selectedEmployees, selectedWeek, viewMode]);

  const fetchStartDate = async () => {
    const res = await api.get('/work-schedule/start-date');

    if (!res.success) return;

    setStartDate(res.data.start_date);

    // set current week as default
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());

    // setSelectedWeek(sunday.toISOString().split('T')[0]);
    setSelectedWeek(formatDateToYMD(sunday));
  };

  useEffect(() => {
    fetchStartDate();
  }, []);

  const getSunday = (date: Date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };

  const addDays = (dateStr: string, days: number) => {
    // const d = new Date(dateStr);
    const d = parseDate(dateStr)
    d.setDate(d.getDate() + days);
    // return d.toISOString().split('T')[0];
    return formatDateToYMD(d);
  };

  const handleWeekTypeChange = (type: any) => {
    setWeekType(type);

    // const todaySunday = getSunday(new Date()).toISOString().split('T')[0];
    const todaySunday = formatDateToYMD(getSunday(new Date()));

    if (type === 'current') {
      setSelectedWeek(todaySunday);
    }

    if (type === 'next') {
      setSelectedWeek(addDays(todaySunday, 7));
    }

    if (type === 'previous') {
      setSelectedWeek(addDays(todaySunday, -7));
    }

    if (type === 'all') {
      setSelectedWeek('');
    }
  };

  const generateAllWeeks = () => {
    if (!startDate) return [];

    const weeks = [];

    // const start = getSunday(new Date(startDate));
    const start = getSunday(parseDate(startDate))
    const today = new Date();

    // go 10 weeks ahead also
    const end = new Date(today);
    end.setDate(end.getDate() + 70);

    let current = new Date(start);

    while (current <= end) {
      // const weekStart = current.toISOString().split('T')[0];
      const weekStart = formatDateToYMD(current);

      weeks.push({
        value: weekStart,
        label: getWeekRange(weekStart),
      });

      current.setDate(current.getDate() + 7);
    }

    return weeks;
  };

  const fetchEmployees = async () => {
    try {

      setLoadingEmployees(true);

      const res = await api.get('/work-schedule/employees');

      if (!res.success) {
        toast.error(res.message || 'Failed to load employees');
        return;
      }

      setEmployees(res.data);
      setSelectedEmployees(res.data.map((e: Employee) => e.id));

      // build role filters dynamically
      const roles: { [role: string]: boolean } = {};
      res.data.forEach((e: Employee) => {
        e.roles.forEach(role => {
          roles[role] = true;
        });
      });

      setRoleFilters(roles);

    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  function formatTimeTo24Safe(time: string) {
    if (!time) return null;


    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time.substring(0, 5); // → "08:00"
    }


    if (/^\d{2}:\d{2}$/.test(time)) {
      return time;
    }


    const match = time.match(/(\d+):(\d+)\s?(AM|PM)/i);
    if (!match) return null; // safer

    let [_, hour, minute, modifier] = match;

    let h = parseInt(hour);

    if (modifier.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (modifier.toUpperCase() === 'AM' && h === 12) h = 0;

    return `${String(h).padStart(2, '0')}:${minute}`;
  }

  const fetchStores = async () => {
    try {
      const res = await api.get('/work-schedule/stores');

      if (!res.success) {
        toast.error(res.message || 'Failed to load stores');
        return;
      }

      const stores = res.data.map((s: any) => s.name);

      setStoreLocations(stores);

      const filters: { [store: string]: boolean } = {};
      stores.forEach((store: string) => {
        filters[store] = true;
      });

      setStoreFilters(filters);

    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch stores');
    }
  };

    const fetchWorkSchedule = async (showLoader = true) => {

      if (showLoader) {
        setLoading(true);
      }

    try {

      const employeeParams = selectedEmployees
        .map(id => `employee_ids[]=${id}`)
        .join('&')

      // const res = await api.get(`/work-schedule/work-schedule?week_start=${selectedWeek}&${employeeParams}`)

        const totalDays = viewMode === '2week' ? 14 : 7;

        const res = await api.get(
          `/work-schedule/work-schedule?week_start=${selectedWeek}&days=${totalDays}&${employeeParams}`
        )
        
      if (!res.success) {
        toast.error(res.message || 'Failed to fetch schedule')
        return
      }

      const dbSchedules = res.data || {}

      // const weekStart = new Date(selectedWeek)
      const weekStart = parseDate(selectedWeek)
      const allWorkDays: { [employeeId: string]: WorkDay[] } = {}

      for (const employeeId of selectedEmployees) {

        const employee = employees.find(emp => emp.id === employeeId)

        const storeSchedule = employee?.store?.weekly_schedule || []

        const weekDays: WorkDay[] = []

        const totalDays = viewMode === '2week' ? 14 : 7;

        for (let i = 0; i < totalDays; i++) {

          const date = new Date(weekStart)
          date.setDate(weekStart.getDate() + i)

          // const dateStr = date.toISOString().split('T')[0]
          const dateStr = formatDateToYMD(date);


          const dayName = [
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday'
          ][date.getDay()]

          const existingDay = dbSchedules?.[Number(employeeId)]?.[dateStr]?.[0] || null

          const storeDay = storeSchedule.find(
            (d: any) => d.day.toLowerCase() === dayName
          )

          const dayShift = storeDay
            ? {
              start: storeDay.open ? storeDay.open.substring(0, 5) : '08:00',
              end: storeDay.close ? storeDay.close.substring(0, 5) : '17:00',
              enabled: !storeDay.is_closed
            }
            : {
              start: '08:00',
              end: '17:00',
              enabled: true
            }

          weekDays.push({
            date: dateStr,
            employee_id: employeeId,
            start_time: existingDay?.start_time || dayShift.start,
            end_time: existingDay?.end_time || dayShift.end,
            store_id: existingDay?.store_id || employee?.store?.id,
            store_location: existingDay?.store?.store_name || employee?.primary_store,
            is_scheduled: Boolean(existingDay?.is_scheduled ?? dayShift.enabled),
            hours: existingDay?.hours
              ? Number(existingDay.hours)
              : calculateHours(dayShift.start, dayShift.end),
            notes: existingDay?.notes || ''
          })
        }

        allWorkDays[employeeId] = weekDays
      }

      setWorkDays(allWorkDays);

    } catch (error) {

      console.error(error)
      toast.error('Error loading schedule')

    } finally {
        if (showLoader) {
          setLoading(false);
        }
    }
  }

  const calculateHours = (startTime?: string, endTime?: string, includeLunch: boolean = true) => {
    if (!startTime || !endTime) return 0;

    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (includeLunch && hours > 6) {
      const lunchMinutes = settings?.default_lunch_duration_minutes || 60;
      hours -= lunchMinutes / 60;
    }

    return Math.max(0, Number(hours.toFixed(2)));
  };

  const toggleScheduled = async (employeeId: string, date: string) => {
    // console.log('employeeId :- ',employeeId);
    // console.log('date :- ',date);

  };

  const formatTime12h = (time?: string | null) => {
    if (!time) return '';

    const [hour, minute] = time.split(':').map(Number);

    const date = new Date();
    date.setHours(hour, minute);

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };


  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      }

      const updated = [...prev, employeeId];

      // keep same order as filteredAndSortedEmployees
      return filteredAndSortedEmployees
        .map(emp => emp.id)
        .filter(id => updated.includes(id));
    });
  };


  const handleStoreFilterChange = (store: string, checked: boolean) => {
    setStoreFilters(prev => ({ ...prev, [store]: checked }));

    // Update selected employees based on new filters
    const newStoreFilters = { ...storeFilters, [store]: checked };
    const filteredEmployees = employees.filter(emp => {
      const roleMatch =
        Object.keys(roleFilters).length === 0 ||
        roleFilters[emp.role];

      const storeMatch = newStoreFilters[emp.primary_store];
      return roleMatch && storeMatch;
    });
    setSelectedEmployees(filteredEmployees.map(emp => emp.id));
  };

  const getWeekDates = (weekStart: string) => {
    const dates = [];
    // const start = new Date(weekStart);
    const start = parseDate(weekStart)

    const currentDay = start.getDay();
    if (currentDay !== 0) {
      start.setDate(start.getDate() - currentDay);
    }

    const totalDays = viewMode === '2week' ? 14 : 7;

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const getWeekLabelByType = (type: string) => {
    // const todaySunday = getSunday(new Date()).toISOString().split('T')[0];
    const todaySunday = formatDateToYMD(getSunday(new Date()));

    if (type === 'current') return getWeekRange(todaySunday);
    if (type === 'next') return getWeekRange(addDays(todaySunday, 7));
    if (type === 'previous') return getWeekRange(addDays(todaySunday, -7));

    return '';
  };


  const getWeekRange = (weekStart: string) => {
    // const start = new Date(weekStart);
    const start = parseDate(weekStart)

    // force Sunday
    const day = start.getDay();
    if (day !== 0) {
      start.setDate(start.getDate() - day);
    }

    const totalDays = viewMode === '2week' ? 13 : 6;
    const end = new Date(start);
    end.setDate(start.getDate() + totalDays);

    const format = (d: Date) =>
      `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

    return `${format(start)} - ${format(end)}`;
  };

  const getEmployeeTotalHours = (employeeId: string) => {
    const employeeWorkDays = workDays[employeeId] || [];
    return employeeWorkDays.filter(d => d.is_scheduled).reduce((sum, day) => sum + day.hours, 0);
  };

  const formatRoleLabel = (role: string) => {
    return role
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const weekDates = selectedWeek ? getWeekDates(selectedWeek) : [];

  return (
    <div className="p-6">
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">

        {/* TOP ROW */}
        <div className="flex items-center justify-between mb-3">

          {/* LEFT: Title */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Work Schedule
            </h2>
          </div>

          {/* RIGHT: 1W / 2W */}
          <div className="flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('1week')}
              className={`px-3 py-1 text-xs font-medium rounded ${viewMode === '1week'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600'
                }`}
            >
              1W
            </button>

            <button
              onClick={() => setViewMode('2week')}
              className={`px-3 py-1 text-xs font-medium rounded ${viewMode === '2week'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600'
                }`}
            >
              2W
            </button>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="flex items-center justify-between">

          {/* LEFT: Week controls */}
          <div className="flex items-center gap-5">

            {['current', 'next', 'previous', 'all'].map(type => (
              <button
                key={type}
                onClick={() => handleWeekTypeChange(type)}
                className="flex items-center gap-2 text-sm"
              >
                {/* 🔘 Radio circle */}
                <span
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center
        ${weekType === type
                      ? 'border-blue-600'
                      : 'border-gray-300'
                    }`}
                >
                  {weekType === type && (
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </span>

                {/* TEXT */}
                <span
                  className={`font-medium ${weekType === type
                    ? 'text-blue-600'
                    : 'text-gray-600'
                    }`}
                >
                  {type === 'current' && 'Current'}
                  {type === 'next' && 'Next'}
                  {type === 'previous' && 'Previous'}
                  {type === 'all' && 'All'}
                </span>

                {/* DATE LABEL */}
                {type !== 'all' && (
                  <span className="text-xs text-gray-400">
                    ({getWeekLabelByType(type)})
                  </span>
                )}
              </button>
            ))}

            {/* Dropdown */}
            {weekType === 'all' && (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="ml-2 text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                <option value="">Select week</option>
                {generateAllWeeks().map(w => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            )}

          </div>

          {/* RIGHT: Date + Range */}
          <div className="flex items-center gap-3">
            {selectedWeek && (
              <span className="text-sm text-gray-500">
                {getWeekRange(selectedWeek)}
              </span>
            )}

          </div>

        </div>
      </div>

      {/* Filters and Employee Selection */}

      {loadingEmployees ? (
        <div className="space-y-6 mb-6">
          {/* Role filter skeleton */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="flex space-x-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 w-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Store filter skeleton */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <div className="animate-pulse grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>

          {/* Employee grid skeleton */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          {/* Row 1: Role Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              By Role
            </label>
            <div className="flex items-center space-x-6 bg-gray-50 border border-gray-300 rounded-lg p-3">
              {Object.entries(roleFilters).map(([role, checked]) => (
                <label key={role} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setRoleFilters(prev => ({
                        ...prev,
                        [role]: e.target.checked
                      }))
                    }
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {formatRoleLabel(role)}
                  </span>
                </label>
              ))}
            </div>
          </div>


          {/* Row 3: Employee Selection Grid */}
          <div>

            {/* Header */}
            <div className="flex items-center justify-start mb-3 gap-3">
              <label className="text-sm font-medium text-gray-700">
                Select Users ({filteredAndSortedEmployees.length} shown, {
                  selectedEmployees.filter(id =>
                    filteredAndSortedEmployees.find(emp => emp.id === id)
                  ).length
                } selected)
              </label>

              <button
                onClick={() => setShowEmployees(prev => !prev)}
                className="p-1 rounded hover:bg-gray-100 transition"
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-300 ${showEmployees ? 'rotate-90' : ''
                    }`}
                />
              </button>
            </div>

            {/* Animated Content */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden
      ${showEmployees ? 'max-h-[900px] opacity-100 mt-2' : 'max-h-0 opacity-0'}
    `}
            >
              <div
                className={`bg-gray-50 border rounded-lg p-4 transition-transform duration-300 ${showEmployees ? 'translate-y-0' : '-translate-y-2'
                  }`}
              >
                {filteredAndSortedEmployees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">No employees match the current filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 min-h-[200px]">
                    {filteredAndSortedEmployees.map(employee => (
                      <label
                        key={employee.id}
                        className="flex items-start space-x-2 cursor-pointer hover:bg-white p-2 rounded border border-transparent hover:border-gray-200 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => toggleEmployeeSelection(employee.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded mt-0.5 flex-shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div
                            className="text-sm font-medium text-gray-900 truncate"
                            title={employee.name}
                          >
                            {employee.name}
                          </div>

                          <div className="flex flex-wrap gap-1 mt-1">
                            {employee.roles_with_color?.map(role => (
                              <span
                                key={role.name}
                                className="inline-flex px-3 py-1 text-[10px] font-medium rounded-full"
                                style={{
                                  backgroundColor: `${role.color}20`,
                                  color: role.color,
                                }}
                              >
                                {formatRoleLabel(role.name)}
                              </span>
                            ))}
                          </div>

                          <div
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-gray-600 mt-1"
                            style={{
                              backgroundColor: getStoreColor(employee.primary_store),
                            }}
                            title={employee.primary_store}
                          >
                            <MapPin className="w-3 h-3" />
                            {employee.primary_store}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      )
      }

      {/* Calendar View */}

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b flex flex-col md:flex-row md:items-start md:justify-between gap-4">

          {/* LEFT SIDE */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Work Schedule Calendar
            </h3>
            <p className="text-sm text-gray-600">
              Week: {getWeekRange(selectedWeek)} (Sunday - Saturday)
            </p>
          </div>

          {/* RIGHT SIDE (Store Filters) */}
          <div className="w-full md:w-auto">
            <div className="flex flex-wrap gap-4">
              {Object.entries(storeFilters).map(([store, checked], index) => (
                <label key={store} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleStoreFilterChange(store, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />

                  <span className="text-sm font-medium text-gray-900 truncate  inline-flex items-center gap-1 px-3 py-2 rounded-full  mt-1" style={{ backgroundColor: storeColors[index % storeColors.length] }}
                    title={store} >
                    <MapPin className="w-4 h-4" /> {store}
                  </span>



                </label>
              ))}
            </div>
          </div>

        </div>

        {/* ONLY TABLE DEPENDS ON CONDITION */}
        {selectedEmployees.length > 0 && selectedWeek ? (
          loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading schedule...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-4 font-medium text-gray-900 bg-gray-50 sticky left-0 z-10 min-w-[200px]">
                      Employee
                    </th>
                    {weekDates.map((date, index) => (
                      <th key={index} className="text-center py-3 px-2 font-medium text-gray-900 bg-gray-50 min-w-[110px]">
                        <div>
                          <div className="text-sm font-semibold">
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="text-xs text-gray-600">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </th>
                    ))}

                  </tr>
                </thead>
                <tbody>
                  {selectedEmployees.map(employeeId => {
                    const employee = filteredAndSortedEmployees.find(emp => emp.id === employeeId);
                    if (!employee) return null;

                    const employeeWorkDays = workDays[employeeId] || [];
                    const totalHours = getEmployeeTotalHours(employeeId);

                    return (
                      <tr key={employeeId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 bg-white sticky left-0 z-10 border-r border-gray-200 min-w-[200px]">
                          <div className="flex items-start gap-2">

                            {/* Avatar */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                              {employee.name?.charAt(0).toUpperCase()}
                            </div>

                            <div className="flex flex-col min-w-0">

                              {/* Name */}
                              <p
                                className="text-sm font-semibold text-gray-900 truncate leading-tight"
                                title={employee.name}
                              >
                                {employee.name}
                              </p>

                              {/* Roles */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {employee.roles_with_color?.map(role => (
                                  <span
                                    key={role.name}
                                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border"
                                    style={{
                                      backgroundColor: `${role.color}20`,
                                      color: role.color,
                                      borderColor: `${role.color}40`
                                    }}
                                  >
                                    {formatRoleLabel(role.name)}
                                  </span>
                                ))}
                              </div>

                              {/* Store */}
                              <div
                                className="inline-flex items-center gap-1 mt-1 text-[10px] text-gray-600 px-2 py-0.5 rounded-md w-fit"
                                title={employee.primary_store}


                                style={{
                                  backgroundColor: getStoreColor(employee.primary_store),
                                  color: '#374151'
                                }}
                              >
                                <MapPin className="w-3 h-3 text-gray-400" />
                                {employee.primary_store}

                              </div>

                              <div className="py-2 px-1 text-center">
                                  <div className="text-sm font-bold text-blue-600 flex items-center  gap-1">

                                    <span className="text-black">Total:</span>

                                    {updatingCell?.startsWith(String(employeeId)) ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs text-gray-500"></span>
                                      </>
                                    ) : (
                                      <span>{formatHoursToTime(totalHours)}</span>
                                    )}

                                </div>
                              </div>

                            </div>
                          </div>
                        </td>
                        {weekDates.map((date, dayIndex) => {
                          // const dateStr = date.toISOString().split('T')[0];
                          const dateStr = formatDateToYMD(date);
                          const dayData = employeeWorkDays.find(d => d.date === dateStr);
                          const isEditing = editingCell?.employeeId === employeeId && editingCell?.date === dateStr;
                          const isUpdating = updatingCell === `${employeeId}-${dateStr}`;
                          return (
                            <td key={dayIndex} className="py-2 px-1 text-center">
                              {isUpdating ? (
                                <div className="text-xs text-gray-500">Saving...</div>
                              ) : dayData && (
                                <div className={`p-2 rounded-lg border-2 `} style={
                                  dayData.is_scheduled
                                    ? {
                                      backgroundColor: getStoreColor(dayData.store_location),
                                      borderColor: getStoreColor(dayData.store_location)
                                    }
                                    : {
                                      backgroundColor: '#F9FAFB',
                                      borderColor: '#E5E7EB'
                                    }
                                }>
                                  
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-center">
                                        <input
                                          type="checkbox"
                                          checked={dayData.is_scheduled}
                                          onChange={() => toggleScheduled(employeeId, dateStr)}
                                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                      </div>
                                      {dayData.is_scheduled && (
                                        <>
                                          <div className="text-xs font-mono text-gray-700">
                                            <div>{formatTime12h(dayData.start_time)}</div>
                                            <div>{formatTime12h(dayData.end_time)}</div>

                                          </div>
                                          <div className="text-xs text-blue-600 font-semibold">
                                            {formatHoursToTime(dayData.hours)}
                                            {/* {Number(dayData.hours).toFixed(1)}h */}
                                          </div>
                                          <div className="text-xs text-gray-600 truncate" title={dayData.store_location}>
                                            {dayData.store_location}
                                          </div>
                                          
                                        </>
                                      )}
                                    </div>
                                  
                                </div>
                              )}
                            </td>
                          );
                        })}

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredAndSortedEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No employees match the current filters.</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting the role or store location filters.</p>
            </div>
          ) : selectedEmployees.filter(id =>
            filteredAndSortedEmployees.find(emp => emp.id === id)
          ).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>Please select at least one employee to manage their work schedule.</p>
            </div>
          ) : null
        )}


      </div>

      {/* Information Panel */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Calendar View Information</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong>Traditional Calendar:</strong> Days run Sunday through Saturday across the top</p>
              <p>• <strong>Employee Sorting:</strong> Admins listed first, then employees alphabetically</p>
              <p>• <strong>Quick Edit:</strong> Click checkbox to enable/disable, click edit button for details</p>
              <p>• <strong>Store Locations:</strong> Defaults to primary store, can be changed per day</p>
              <p>• <strong>Hours Calculation:</strong> Automatically includes lunch deduction for shifts over 6 hours</p>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default EmpWorkSchedule;