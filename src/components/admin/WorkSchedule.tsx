import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Edit, Save, X, Plus, Copy, Trash2 } from 'lucide-react';

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
}

// Mock data for demo
const mockEmployees: Employee[] = [
  { id: '1', name: 'John Doe', primary_store: 'Main Store' },
  { id: '2', name: 'Admin User', primary_store: 'Main Store' },
  { id: '3', name: 'Jane Smith', primary_store: 'North Branch' },
];

const storeLocations = [
  'Main Store',
  'North Branch',
  'South Branch',
  'East Location',
  'West Location'
];

const scheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'every_day_full',
    name: 'Every Day - Full Shift',
    type: 'every_day_full',
    description: 'Monday through Sunday, start of shift to end of shift'
  },
  {
    id: 'every_day_8hours',
    name: 'Every Day - 8 Hours',
    type: 'every_day_8hours',
    description: 'Monday through Sunday, start of shift to 8 hours (with lunch)'
  },
  {
    id: 'weekdays_only',
    name: 'Weekdays Only',
    type: 'weekdays_only',
    description: 'Monday through Friday only, no weekends'
  }
];

const WorkSchedule: React.FC = () => {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [workDays, setWorkDays] = useState<{ [employeeId: string]: WorkDay[] }>({});
  const [loading, setLoading] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<WorkDay>>({});
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    // Set current week as default
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    setSelectedWeek(monday.toISOString().split('T')[0]);
    
    // Pre-check all employees by default
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
      
      // Get system settings for default shift times
      const savedSettings = localStorage.getItem('demo_system_settings');
      const settings = savedSettings ? JSON.parse(savedSettings) : null;
      const dailyShifts = settings?.daily_shifts || {};
      
      for (const employeeId of selectedEmployees) {
        // Get saved schedule from localStorage
        const scheduleKey = `work_schedule_${employeeId}_${selectedWeek}`;
        const savedSchedule = localStorage.getItem(scheduleKey);
        const existingSchedule = savedSchedule ? JSON.parse(savedSchedule) : {};

        // Get employee data
        const employee = mockEmployees.find(emp => emp.id === employeeId);
        
        const weekDays: WorkDay[] = [];
        
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
          
          // Check if there's existing data for this day
          const existingDay = existingSchedule[dateStr];
          
          // Get default shift for this day
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
    
    // Subtract lunch if it's a full day (more than 6 hours) and includeLunch is true
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
        scheduleData[day.date] = day;
      });
      
      localStorage.setItem(scheduleKey, JSON.stringify(scheduleData));
    } catch (error) {
      console.error('Error saving work schedule:', error);
    }
  };

  const applyTemplate = async () => {
    if (!selectedTemplate || selectedEmployees.length === 0) return;
    
    const template = scheduleTemplates.find(t => t.id === selectedTemplate);
    if (!template) return;
    
    // Get system settings for shift times
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
            // Calculate end time for 8 hours + lunch
            const startTime = new Date(`2000-01-01T${dayShift.start}:00`);
            const lunchMinutes = settings?.default_lunch_duration_minutes || 60;
            const endTime = new Date(startTime.getTime() + (8 * 60 * 60 * 1000) + (lunchMinutes * 60 * 1000));
            newDay.end_time = endTime.toTimeString().substring(0, 5);
            newDay.hours = 8;
            break;
            
          case 'weekdays_only':
            const isWeekday = date.getDay() >= 1 && date.getDay() <= 5;
            newDay.is_scheduled = isWeekday;
            if (isWeekday) {
              newDay.start_time = dayShift.start;
              newDay.end_time = dayShift.end;
              newDay.hours = calculateHours(dayShift.start, dayShift.end);
            }
            break;
        }
        
        // Reset store to primary
        newDay.store_location = employee?.primary_store || 'Main Store';
        
        return newDay;
      });
      
      updatedWorkDays[employeeId] = updatedEmployeeWorkDays;
    }
    
    setWorkDays(updatedWorkDays);
    setShowBulkAssign(false);
    setSelectedTemplate('');
    
    // Auto-save after applying template
    setTimeout(() => {
      saveWorkSchedule();
    }, 100);
  };

  const startEditing = (date: string) => {
    const employeeWorkDays = workDays[editingEmployee || ''] || [];
    const day = employeeWorkDays.find(d => d.date === date);
    if (day && editingEmployee) {
      setEditingDay(date);
      setEditValues(day);
    }
  };

  const saveEdit = async () => {
    if (!editingDay) return;
    
    const updatedWorkDays = { ...workDays };
    
    if (editingEmployee) {
      updatedWorkDays[editingEmployee] = workDays[editingEmployee].map(day => {
        if (day.date === editingDay) {
          const updatedDay = { ...day, ...editValues };
          // Recalculate hours
          updatedDay.hours = calculateHours(updatedDay.start_time, updatedDay.end_time);
          return updatedDay;
        }
        return day;
      });
    }
    
    setWorkDays(updatedWorkDays);
    setEditingDay(null);
    setEditValues({});
    
    // Auto-save
    setTimeout(() => {
      saveWorkSchedule();
    }, 100);
  };

  const cancelEdit = () => {
    setEditingDay(null);
    setEditValues({});
    setEditingEmployee(null);
  };

  const toggleScheduled = (date: string) => {
    if (!editingEmployee) return;
    
    const updatedWorkDays = { ...workDays };
    updatedWorkDays[editingEmployee] = workDays[editingEmployee].map(day => {
      if (day.date === date) {
        return { ...day, is_scheduled: !day.is_scheduled };
      }
      return day;
    });
    
    setWorkDays(updatedWorkDays);
    
    // Auto-save
    setTimeout(() => {
      saveWorkSchedule();
    }, 100);
  };

  const copyWeek = () => {
    // This would copy the current week to next week
    // Implementation would depend on requirements
    alert('Copy week functionality - would copy current schedule to next week');
  };

  const clearWeek = () => {
    if (confirm('Are you sure you want to clear all scheduled days for this week?')) {
      const clearedWorkDays: { [employeeId: string]: WorkDay[] } = {};
      
      for (const employeeId of selectedEmployees) {
        const employeeWorkDays = workDays[employeeId] || [];
        clearedWorkDays[employeeId] = employeeWorkDays.map(day => ({
          ...day,
          is_scheduled: false,
          notes: ''
        }));
        ...day,
        is_scheduled: false,
        notes: ''
      }));
      
      setWorkDays(clearedWorkDays);
      
      setTimeout(() => {
        saveWorkSchedule();
      }, 100);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getWeekRange = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Work Schedule</h2>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBulkAssign(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Bulk Assign</span>
          </button>
          <button
            onClick={copyWeek}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Week</span>
          </button>
          <button
            onClick={clearWeek}
            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Week</span>
          </button>
        </div>
      </div>

      {/* Bulk Assignment Modal */}
      {showBulkAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Bulk Schedule Assignment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a template...</option>
                  {scheduleTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <p className="text-sm text-gray-600 mt-2">
                    {scheduleTemplates.find(t => t.id === selectedTemplate)?.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowBulkAssign(false);
                  setSelectedTemplate('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyTemplate}
                disabled={!selectedTemplate}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>Apply Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee and Week Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Employees (All checked by default)
          </label>
          <div className="space-y-2 bg-gray-50 border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
            {mockEmployees.map(employee => (
              <label key={employee.id} className="flex items-center space-x-3 cursor-pointer hover:bg-white p-2 rounded">
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(employee.id)}
                  onChange={() => toggleEmployeeSelection(employee.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                  <p className="text-xs text-gray-500">{employee.primary_store}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {selectedEmployees.length} of {mockEmployees.length} employees selected
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Week Starting (Monday)
          </label>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {selectedWeek && (
            <p className="text-sm text-gray-600 mt-1">
              Week: {getWeekRange(selectedWeek)}
            </p>
          )}
        </div>
      </div>

      {/* Schedule Display */}
      {selectedEmployees.length > 0 && selectedWeek && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Work Schedule Management
            </h3>
            <p className="text-sm text-gray-600">
              Week of {getWeekRange(selectedWeek)} - {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading schedule...</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-6">
                {workDays.map((day) => {
                  const isEditing = editingDay === day.date;
                  
                  return (
                    <div key={day.date} className={`border rounded-lg p-4 ${
                      day.is_scheduled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <input
                            type="checkbox"
                            checked={day.is_scheduled}
                            onChange={() => toggleScheduled(day.date)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {getDayName(day.date)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDate(day.date)}
                            </p>
                          </div>
                        </div>
                        
                        {day.is_scheduled && (
                          <div className="flex items-center space-x-6">
                            {isEditing ? (
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                  <input
                                    type="time"
                                    value={editValues.start_time || ''}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, start_time: e.target.value }))}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <span className="text-gray-500">to</span>
                                  <input
                                    type="time"
                                    value={editValues.end_time || ''}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, end_time: e.target.value }))}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-gray-500" />
                                  <select
                                    value={editValues.store_location || ''}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, store_location: e.target.value }))}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    {storeLocations.map(location => (
                                      <option key={location} value={location}>
                                        {location}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={saveEdit}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-6">
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-mono">
                                    {day.start_time} - {day.end_time}
                                  </span>
                                  <span className="text-blue-600 font-semibold">
                                    ({day.hours.toFixed(1)}h)
                                  </span>
                                </div>
                                
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <MapPin className="h-4 w-4" />
                                  <span>{day.store_location}</span>
                                </div>
                                
                                <button
                                  onClick={() => startEditing(day.date)}
                                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {day.notes && (
                        <div className="mt-2 text-sm text-gray-600 italic">
                          Note: {day.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {selectedEmployees.map(employeeId => {
                const employee = mockEmployees.find(emp => emp.id === employeeId);
                const employeeWorkDays = workDays[employeeId] || [];
                
                return (
                  <div key={employeeId} className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{employee?.name}</h4>
                        <p className="text-sm text-gray-600">Primary Store: {employee?.primary_store}</p>
                      </div>
                      <div className="text-sm text-gray-600">
                        Total hours: {' '}
                        <span className="font-semibold text-blue-600">
                          {employeeWorkDays.filter(d => d.is_scheduled).reduce((sum, day) => sum + day.hours, 0).toFixed(1)}h
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {employeeWorkDays.map((day) => {
                        const isEditing = editingDay === day.date && editingEmployee === employeeId;
                        
                        return (
                          <div key={day.date} className={`border rounded-lg p-4 ${
                            day.is_scheduled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <input
                                  type="checkbox"
                                  checked={day.is_scheduled}
                                  onChange={() => {
                                    setEditingEmployee(employeeId);
                                    toggleScheduled(day.date);
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {getDayName(day.date)}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {formatDate(day.date)}
                                  </p>
                                </div>
                              </div>
                              
                              {day.is_scheduled && (
                                <div className="flex items-center space-x-6">
                                  {isEditing ? (
                                    <div className="flex items-center space-x-4">
                                      <div className="flex items-center space-x-2">
                                        <Clock className="h-4 w-4 text-gray-500" />
                                        <input
                                          type="time"
                                          value={editValues.start_time || ''}
                                          onChange={(e) => setEditValues(prev => ({ ...prev, start_time: e.target.value }))}
                                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                        <span className="text-gray-500">to</span>
                                        <input
                                          type="time"
                                          value={editValues.end_time || ''}
                                          onChange={(e) => setEditValues(prev => ({ ...prev, end_time: e.target.value }))}
                                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <MapPin className="h-4 w-4 text-gray-500" />
                                        <select
                                          value={editValues.store_location || ''}
                                          onChange={(e) => setEditValues(prev => ({ ...prev, store_location: e.target.value }))}
                                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                          {storeLocations.map(location => (
                                            <option key={location} value={location}>
                                              {location}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={saveEdit}
                                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                                        >
                                          <Save className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={cancelEdit}
                                          className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-6">
                                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-mono">
                                          {day.start_time} - {day.end_time}
                                        </span>
                                        <span className="text-blue-600 font-semibold">
                                          ({day.hours.toFixed(1)}h)
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                                        <MapPin className="h-4 w-4" />
                                        <span>{day.store_location}</span>
                                      </div>
                                      
                                      <button
                                        onClick={() => {
                                          setEditingEmployee(employeeId);
                                          startEditing(day.date);
                                        }}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {day.notes && (
                              <div className="mt-2 text-sm text-gray-600 italic">
                                Note: {day.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={saveWorkSchedule}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Schedule</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {selectedEmployees.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p>Please select at least one employee to manage their work schedule.</p>
        </div>
      )}

      {/* Information Panel */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Work Schedule Information</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong>Bulk Assign:</strong> Use templates to quickly set up common schedule patterns</p>
              <p>• <strong>Manual Edit:</strong> Click the edit button on any day to customize times and location</p>
              <p>• <strong>Store Assignment:</strong> Defaults to employee's primary store, can be changed per day</p>
              <p>• <strong>Hours Calculation:</strong> Automatically includes lunch deduction for shifts over 6 hours</p>
              <p>• <strong>Copy Week:</strong> Duplicate current schedule to next week (coming soon)</p>
              <p>• <strong>Clear Week:</strong> Remove all scheduled days for the selected week</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkSchedule;