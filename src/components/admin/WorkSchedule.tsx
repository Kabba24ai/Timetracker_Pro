import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CreditCard as Edit, Save, X, Plus, Copy, Trash2, Users, Eye } from 'lucide-react';

type ViewMode = 'assign' | 'view';

interface ScheduleTemplate {
  id: string;
  name: string;
  type: 'every_day_full' | 'every_day_8hours' | 'weekdays_only';
  description: string;
}

interface WorkDay {
  date: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  store_location: string;
  is_scheduled: boolean;
  hours: number;
  notes?: string;
}

interface Employee {
  id: string;
  name: string;
  primary_store: string;
  role: 'employee' | 'admin';
}

const mockEmployees: Employee[] = [
  { id: '2', name: 'Admin User', primary_store: 'Main Store', role: 'admin' },
  { id: '1', name: 'John Doe', primary_store: 'Main Store', role: 'employee' },
  { id: '3', name: 'Jane Smith', primary_store: 'North Branch', role: 'employee' },
];

const storeLocations = [
  'Main Store',
  'North Branch',
  'South Branch',
  'East Location',
  'West Location',
  'Downtown'
];

const scheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'every_day_full',
    name: 'Every Day - Full Shift',
    type: 'every_day_full',
    description: 'Sunday through Saturday, start of shift to end of shift'
  },
  {
    id: 'every_day_8hours',
    name: 'Every Day - 8 Hours',
    type: 'every_day_8hours',
    description: 'Sunday through Saturday, start of shift to 8 hours (with lunch)'
  },
  {
    id: 'weekdays_only',
    name: 'Weekdays Only',
    type: 'weekdays_only',
    description: 'Monday through Friday only, no weekends'
  }
];

const WorkSchedule: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('assign');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [workDays, setWorkDays] = useState<{ [employeeId: string]: WorkDay[] }>({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ employeeId: string; date: string } | null>(null);
  const [editValues, setEditValues] = useState<Partial<WorkDay>>({});
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const [assignStore, setAssignStore] = useState<string>('Main Store');

  const [viewStoreFilters, setViewStoreFilters] = useState<{ [store: string]: boolean }>({
    'Main Store': true,
    'North Branch': true,
    'South Branch': true,
    'East Location': true,
    'West Location': true,
    'Downtown': true
  });

  const [roleFilters, setRoleFilters] = useState<{ admin: boolean; employee: boolean }>({
    admin: true,
    employee: true
  });

  const filteredAndSortedEmployees = [...mockEmployees]
    .filter(emp => {
      const roleMatch = roleFilters[emp.role];

      if (viewMode === 'assign') {
        return roleMatch && emp.primary_store === assignStore;
      } else {
        const storeMatch = viewStoreFilters[emp.primary_store];
        const employeeSelected = selectedEmployees.includes(emp.id);
        return roleMatch && storeMatch && employeeSelected;
      }
    })
    .sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === 'admin' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  useEffect(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay);
    setSelectedWeek(sunday.toISOString().split('T')[0]);

    setSelectedEmployees(mockEmployees.map(emp => emp.id));
  }, []);

  useEffect(() => {
    if (selectedEmployees.length > 0 && selectedWeek) {
      fetchWorkSchedule();
    }
  }, [selectedEmployees, selectedWeek]);

  const fetchWorkSchedule = async () => {
    setLoading(true);
    try {
      const weekStart = new Date(selectedWeek);
      const allWorkDays: { [employeeId: string]: WorkDay[] } = {};

      const savedSettings = localStorage.getItem('demo_system_settings');
      const settings = savedSettings ? JSON.parse(savedSettings) : null;
      const dailyShifts = settings?.daily_shifts || {};

      for (const employeeId of selectedEmployees) {
        const scheduleKey = `work_schedule_${employeeId}_${selectedWeek}`;
        const savedSchedule = localStorage.getItem(scheduleKey);
        const existingSchedule = savedSchedule ? JSON.parse(savedSchedule) : {};

        const employee = mockEmployees.find(emp => emp.id === employeeId);

        const weekDays: WorkDay[] = [];

        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];

          const existingDay = existingSchedule[dateStr];

          const dayShift = dailyShifts[dayName] || { start: '08:00', end: '17:00', enabled: true };

          weekDays.push({
            date: dateStr,
            employee_id: employeeId,
            start_time: existingDay?.start_time || dayShift.start,
            end_time: existingDay?.end_time || dayShift.end,
            store_location: existingDay?.store_location || employee?.primary_store || 'Main Store',
            is_scheduled: existingDay?.is_scheduled !== undefined ? existingDay.is_scheduled : dayShift.enabled,
            hours: existingDay?.hours || calculateHours(dayShift.start, dayShift.end),
            notes: existingDay?.notes || ''
          });
        }

        allWorkDays[employeeId] = weekDays;
      }

      setWorkDays(allWorkDays);
    } catch (error) {
      console.error('Error fetching work schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (startTime: string, endTime: string, includeLunch: boolean = true) => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (includeLunch && hours > 6) {
      const savedSettings = localStorage.getItem('demo_system_settings');
      const settings = savedSettings ? JSON.parse(savedSettings) : null;
      const lunchMinutes = settings?.default_lunch_duration_minutes || 60;
      hours -= lunchMinutes / 60;
    }

    return Math.max(0, hours);
  };

  const saveWorkSchedule = async () => {
    if (selectedEmployees.length === 0 || !selectedWeek) return;

    try {
      for (const employeeId of selectedEmployees) {
        const scheduleKey = `work_schedule_${employeeId}_${selectedWeek}`;
        const scheduleData: { [date: string]: WorkDay } = {};

        const employeeWorkDays = workDays[employeeId] || [];
        employeeWorkDays.forEach(day => {
          scheduleData[day.date] = day;
        });

        localStorage.setItem(scheduleKey, JSON.stringify(scheduleData));
      }
    } catch (error) {
      console.error('Error saving work schedule:', error);
    }
  };

  const applyTemplate = async () => {
    if (!selectedTemplate || selectedEmployees.length === 0) return;

    const template = scheduleTemplates.find(t => t.id === selectedTemplate);
    if (!template) return;

    const savedSettings = localStorage.getItem('demo_system_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : null;
    const dailyShifts = settings?.daily_shifts || {};

    const updatedWorkDays: { [employeeId: string]: WorkDay[] } = {};

    for (const employeeId of selectedEmployees) {
      const employee = mockEmployees.find(emp => emp.id === employeeId);
      const employeeWorkDays = workDays[employeeId] || [];

      const updatedEmployeeWorkDays = employeeWorkDays.map(day => {
        const date = new Date(day.date);
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const dayShift = dailyShifts[dayName] || { start: '08:00', end: '17:00', enabled: true };

        let newDay = { ...day };

        switch (template.type) {
          case 'every_day_full':
            newDay.is_scheduled = true;
            newDay.start_time = dayShift.start;
            newDay.end_time = dayShift.end;
            newDay.hours = calculateHours(dayShift.start, dayShift.end);
            break;

          case 'every_day_8hours':
            newDay.is_scheduled = true;
            newDay.start_time = dayShift.start;
            const startTime = new Date(`2000-01-01T${dayShift.start}:00`);
            const lunchMinutes = settings?.default_lunch_duration_minutes || 60;
            const endTime = new Date(startTime.getTime() + ((8 * 60) + lunchMinutes) * 60000);
            newDay.end_time = endTime.toTimeString().slice(0, 5);
            newDay.hours = 8;
            break;

          case 'weekdays_only':
            const dayOfWeek = date.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
              newDay.is_scheduled = true;
              newDay.start_time = dayShift.start;
              newDay.end_time = dayShift.end;
              newDay.hours = calculateHours(dayShift.start, dayShift.end);
            } else {
              newDay.is_scheduled = false;
              newDay.hours = 0;
            }
            break;
        }

        if (viewMode === 'assign') {
          newDay.store_location = assignStore;
        }

        return newDay;
      });

      updatedWorkDays[employeeId] = updatedEmployeeWorkDays;
    }

    setWorkDays({ ...workDays, ...updatedWorkDays });
    setShowBulkAssign(false);
    setSelectedTemplate('');
  };

  const handleCellEdit = (employeeId: string, date: string, field: keyof WorkDay, value: any) => {
    const updatedWorkDays = { ...workDays };
    const employeeWorkDays = updatedWorkDays[employeeId] || [];
    const dayIndex = employeeWorkDays.findIndex(d => d.date === date);

    if (dayIndex !== -1) {
      employeeWorkDays[dayIndex] = {
        ...employeeWorkDays[dayIndex],
        [field]: value
      };

      if (field === 'start_time' || field === 'end_time') {
        const day = employeeWorkDays[dayIndex];
        day.hours = day.is_scheduled ? calculateHours(day.start_time, day.end_time) : 0;
      }

      updatedWorkDays[employeeId] = employeeWorkDays;
      setWorkDays(updatedWorkDays);
    }
  };

  const getStoreColor = (store: string) => {
    const colors: { [key: string]: string } = {
      'Main Store': 'bg-blue-100 text-blue-800 border-blue-300',
      'North Branch': 'bg-green-100 text-green-800 border-green-300',
      'South Branch': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'East Location': 'bg-purple-100 text-purple-800 border-purple-300',
      'West Location': 'bg-pink-100 text-pink-800 border-pink-300',
      'Downtown': 'bg-orange-100 text-orange-800 border-orange-300'
    };
    return colors[store] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const calculateWeekTotal = (employeeId: string) => {
    const employeeWorkDays = workDays[employeeId] || [];
    return employeeWorkDays.reduce((sum, day) => sum + (day.is_scheduled ? day.hours : 0), 0);
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];
    const monthDay = date.getDate();
    return `${dayName}\n${monthDay}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Work Schedule</h2>
        <p className="text-gray-600">Assign and view employee work schedules</p>
      </div>

      <div className="mb-6 flex items-center space-x-4 border-b border-gray-200 pb-4">
        <button
          onClick={() => setViewMode('assign')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'assign'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Edit className="h-4 w-4" />
          <span>Assign Mode</span>
        </button>
        <button
          onClick={() => setViewMode('view')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'view'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Eye className="h-4 w-4" />
          <span>View Mode</span>
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Week Starting</label>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {viewMode === 'assign' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Location</label>
            <select
              value={assignStore}
              onChange={(e) => setAssignStore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {storeLocations.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Locations</label>
            <div className="grid grid-cols-2 gap-2">
              {storeLocations.map((store) => (
                <label
                  key={store}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={viewStoreFilters[store]}
                    onChange={() => setViewStoreFilters({ ...viewStoreFilters, [store]: !viewStoreFilters[store] })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{store}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role Filters</label>
          <div className="flex space-x-2">
            <button
              onClick={() => setRoleFilters({ ...roleFilters, admin: !roleFilters.admin })}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                roleFilters.admin
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-400 border border-gray-200'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => setRoleFilters({ ...roleFilters, employee: !roleFilters.employee })}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                roleFilters.employee
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-400 border border-gray-200'
              }`}
            >
              Employee
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center space-x-2">
        <button
          onClick={() => setShowBulkAssign(!showBulkAssign)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Apply Template</span>
        </button>
        <button
          onClick={saveWorkSchedule}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Save className="h-4 w-4" />
          <span>Save Schedule</span>
        </button>
      </div>

      {showBulkAssign && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Apply Schedule Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a template</option>
                {scheduleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <button
                onClick={applyTemplate}
                disabled={!selectedTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Apply to Selected Employees
              </button>
              <button
                onClick={() => setShowBulkAssign(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                Employee
              </th>
              {workDays[filteredAndSortedEmployees[0]?.id]?.map((day, idx) => (
                <th key={idx} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r whitespace-pre-line">
                  {getDayLabel(day.date)}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedEmployees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 border-r">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee.id]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      <div className="text-xs text-gray-500">{employee.primary_store}</div>
                    </div>
                  </div>
                </td>
                {(workDays[employee.id] || []).map((day, idx) => (
                  <td key={idx} className="px-2 py-2 border-r">
                    {day.is_scheduled ? (
                      <div className={`text-center p-2 rounded border ${getStoreColor(day.store_location)}`}>
                        <div className="text-xs font-semibold">{day.start_time} - {day.end_time}</div>
                        <div className="text-xs mt-1">{day.hours.toFixed(1)}h</div>
                        {viewMode === 'view' && (
                          <div className="text-xs mt-1 font-medium">{day.store_location}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 text-xs">Off</div>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <div className="text-sm font-bold text-gray-900">
                    {calculateWeekTotal(employee.id).toFixed(1)}h
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkSchedule;
