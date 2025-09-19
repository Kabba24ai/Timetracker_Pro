import React, { useState, useEffect } from 'react';
import { Settings, Clock, Save, Calendar, Plus, X } from 'lucide-react';

const initialDefaultSettings: SystemSettings = {
  pay_increments: 15,
  pay_period_type: 'biweekly',
  pay_period_start_date: '2025-01-05',
  default_lunch_duration_minutes: 60,
  limit_start_time_to_shift: false,
  limit_end_time_to_shift: false,
  // Automated messaging defaults
  first_clock_in_reminder_minutes: 15,
  second_clock_in_reminder_minutes: 30,
  auto_clock_out_limit_minutes: 60,
  clock_in_message_1: "Reminder: Please clock in for your shift. Reply STOP to opt out.",
  clock_in_message_2: "Final reminder: You haven't clocked in yet. Please clock in now or contact your supervisor.",
  auto_clock_out_message: "You were automatically clocked out at shift end with lunch deducted. Contact HR if incorrect.",
  // Default holidays for current and next year
  holidays: {
    '2025': {
      new_years_day: true,
      memorial_day: true,
      independence_day: true,
      labor_day: true,
      thanksgiving_day: true,
      christmas_day: true,
    },
    '2026': {
      new_years_day: true,
      memorial_day: true,
      independence_day: true,
      labor_day: true,
      thanksgiving_day: true,
      christmas_day: true,
    },
  },
  daily_shifts: {
    monday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
    tuesday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
    wednesday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
    thursday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
    friday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
    saturday: { start: '08:00', end: '17:00', enabled: false, lunch_required: false },
    sunday: { start: '08:00', end: '17:00', enabled: false, lunch_required: false },
  },
};

interface SystemSettings {
  pay_increments: number;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_start_date: string;
  default_lunch_duration_minutes: number;
  limit_start_time_to_shift: boolean;
  limit_end_time_to_shift: boolean;
  // Automated messaging settings
  first_clock_in_reminder_minutes: number;
  second_clock_in_reminder_minutes: number;
  auto_clock_out_limit_minutes: number;
  clock_in_message_1: string;
  clock_in_message_2: string;
  auto_clock_out_message: string;
  // Holiday settings
  holidays: {
    [year: string]: {
      new_years_day: boolean;
      memorial_day: boolean;
      independence_day: boolean;
      labor_day: boolean;
      thanksgiving_day: boolean;
      christmas_day: boolean;
      floating_holidays?: { [date: string]: { name: string; enabled: boolean } };
    };
  };
  daily_shifts: {
    monday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    tuesday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    wednesday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    thursday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    friday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    saturday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
    sunday: { start: string; end: string; enabled: boolean; lunch_required: boolean };
  };
}

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(initialDefaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedHolidayYear, setSelectedHolidayYear] = useState('2025');
  const [showAddFloatingHoliday, setShowAddFloatingHoliday] = useState(false);
  const [newFloatingHoliday, setNewFloatingHoliday] = useState({
    date: '',
    name: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Load settings from localStorage for demo
      const savedSettings = localStorage.getItem('demo_system_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({
          ...initialDefaultSettings,
          ...parsedSettings,
          holidays: {
            ...initialDefaultSettings.holidays,
            ...(parsedSettings.holidays || {})
          },
          daily_shifts: {
            ...initialDefaultSettings.daily_shifts,
            ...(parsedSettings.daily_shifts || {})
          }
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save to localStorage for demo
      localStorage.setItem('demo_system_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleDailyShiftChange = (day: keyof SystemSettings['daily_shifts'], field: 'start' | 'end' | 'enabled' | 'lunch_required', value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      daily_shifts: {
        ...prev.daily_shifts,
        [day]: {
          ...prev.daily_shifts[day],
          [field]: value
        }
      }
    }));
  };

  const handleHolidayChange = (year: string, holiday: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      holidays: {
        ...prev.holidays,
        [year]: {
          ...prev.holidays[year],
          [holiday]: enabled
        }
      }
    }));
  };

  const addHolidayYear = (year: string) => {
    if (!settings.holidays[year]) {
      setSettings(prev => ({
        ...prev,
        holidays: {
          ...prev.holidays,
          [year]: {
            new_years_day: true,
            memorial_day: true,
            independence_day: true,
            labor_day: true,
            thanksgiving_day: true,
            christmas_day: true,
            floating_holidays: {}
          }
        }
      }));
    }
  };

  const getHolidayLabel = (holiday: string) => {
    const labels: { [key: string]: string } = {
      new_years_day: "New Year's Day",
      memorial_day: "Memorial Day",
      independence_day: "Independence Day",
      labor_day: "Labor Day",
      thanksgiving_day: "Thanksgiving Day",
      christmas_day: "Christmas Day",
    };
    return labels[holiday] || holiday;
  };

  const getHolidayDate = (year: string, holiday: string) => {
    const yearNum = parseInt(year);
    const dates: { [key: string]: (year: number) => string } = {
      new_years_day: (y) => `January 1, ${y}`,
      memorial_day: (y) => {
        // Last Monday in May
        const may = new Date(y, 4, 31); // May 31
        const lastMonday = new Date(may);
        lastMonday.setDate(31 - (may.getDay() + 6) % 7);
        return lastMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      },
      independence_day: (y) => `July 4, ${y}`,
      labor_day: (y) => {
        // First Monday in September
        const sept = new Date(y, 8, 1); // September 1
        const firstMonday = new Date(sept);
        firstMonday.setDate(1 + (8 - sept.getDay()) % 7);
        return firstMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      },
      thanksgiving_day: (y) => {
        // Fourth Thursday in November
        const nov = new Date(y, 10, 1); // November 1
        const firstThursday = new Date(nov);
        firstThursday.setDate(1 + (11 - nov.getDay()) % 7);
        const fourthThursday = new Date(firstThursday);
        fourthThursday.setDate(firstThursday.getDate() + 21);
        return fourthThursday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      },
      christmas_day: (y) => `December 25, ${y}`,
    };
    return dates[holiday] ? dates[holiday](yearNum) : '';
  };
  const getDayLabel = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  const addFloatingHoliday = () => {
    if (!newFloatingHoliday.date || !newFloatingHoliday.name.trim()) return;
    
    // Validate date is in selected year
    const holidayYear = new Date(newFloatingHoliday.date).getFullYear().toString();
    if (holidayYear !== selectedHolidayYear) {
      alert(`Please select a date in ${selectedHolidayYear}`);
      return;
    }
    
    setSettings(prev => ({
      ...prev,
      holidays: {
        ...prev.holidays,
        [selectedHolidayYear]: {
          ...prev.holidays[selectedHolidayYear],
          floating_holidays: {
            ...prev.holidays[selectedHolidayYear]?.floating_holidays,
            [newFloatingHoliday.date]: {
              name: newFloatingHoliday.name.trim(),
              enabled: true
            }
          }
        }
      }
    }));
    
    setNewFloatingHoliday({ date: '', name: '' });
    setShowAddFloatingHoliday(false);
  };

  const removeFloatingHoliday = (date: string) => {
    setSettings(prev => {
      const updatedFloatingHolidays = { ...prev.holidays[selectedHolidayYear]?.floating_holidays };
      delete updatedFloatingHolidays[date];
      
      return {
        ...prev,
        holidays: {
          ...prev.holidays,
          [selectedHolidayYear]: {
            ...prev.holidays[selectedHolidayYear],
            floating_holidays: updatedFloatingHolidays
          }
        }
      };
    });
  };

  const toggleFloatingHoliday = (date: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      holidays: {
        ...prev.holidays,
        [selectedHolidayYear]: {
          ...prev.holidays[selectedHolidayYear],
          floating_holidays: {
            ...prev.holidays[selectedHolidayYear]?.floating_holidays,
            [date]: {
              ...prev.holidays[selectedHolidayYear]?.floating_holidays?.[date],
              enabled
            }
          }
        }
      }
    }));
  };

  const getAllHolidaysChronological = () => {
    const yearHolidays = settings.holidays[selectedHolidayYear];
    if (!yearHolidays) return [];
    
    const holidays: Array<{
      date: string;
      name: string;
      enabled: boolean;
      type: 'standard' | 'floating';
      key: string;
    }> = [];
    
    // Add standard holidays
    Object.entries(yearHolidays).forEach(([holiday, enabled]) => {
      if (holiday !== 'floating_holidays' && typeof enabled === 'boolean') {
        const date = getHolidayDate(selectedHolidayYear, holiday);
        if (date) {
          // Convert date to sortable format
          const sortableDate = convertToSortableDate(date);
          holidays.push({
            date: sortableDate,
            name: getHolidayLabel(holiday),
            enabled,
            type: 'standard',
            key: holiday
          });
        }
      }
    });
    
    // Add floating holidays
    if (yearHolidays.floating_holidays) {
      Object.entries(yearHolidays.floating_holidays).forEach(([date, holiday]) => {
        holidays.push({
          date,
          name: holiday.name,
          enabled: holiday.enabled,
          type: 'floating',
          key: date
        });
      });
    }
    
    // Sort chronologically
    holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return holidays;
  };

  const convertToSortableDate = (dateString: string) => {
    // Convert "January 1, 2025" to "2025-01-01"
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> Settings are saved locally and will persist during your session.
        </p>
      </div>

      <div className="space-y-6">
        {/* Main Settings Grid */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">System Configuration</h3>
          
          {/* First Row - 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pay Increments (minutes)
              </label>
              <select
                value={settings.pay_increments}
                onChange={(e) => handleInputChange('pay_increments', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={settings.limit_start_time_to_shift}
                    onChange={(e) => handleInputChange('limit_start_time_to_shift', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  Limit Start Time to Shift Start
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pay Period Type
              </label>
              <select
                value={settings.pay_period_type}
                onChange={(e) => handleInputChange('pay_period_type', e.target.value as 'weekly' | 'biweekly')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
              </select>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={settings.limit_end_time_to_shift}
                    onChange={(e) => handleInputChange('limit_end_time_to_shift', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  Limit End Time to Shift End
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pay Period Start Date
              </label>
              <input
                type="date"
                value={settings.pay_period_start_date}
                onChange={(e) => handleInputChange('pay_period_start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Lunch Duration (minutes)
              </label>
              <input
                type="number"
                value={settings.default_lunch_duration_minutes}
                onChange={(e) => handleInputChange('default_lunch_duration_minutes', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
          </div>
          
          {/* Second Row - Clock-in reminders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1st Clock-In Reminder
              </label>
              <select
                value={settings.first_clock_in_reminder_minutes}
                onChange={(e) => handleInputChange('first_clock_in_reminder_minutes', Number(e.target.value))}
                className="w-[260px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 minutes after shift start</option>
                <option value={10}>10 minutes after shift start</option>
                <option value={15}>15 minutes after shift start</option>
                <option value={20}>20 minutes after shift start</option>
                <option value={30}>30 minutes after shift start</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2nd Clock-In Reminder
              </label>
              <select
                value={settings.second_clock_in_reminder_minutes}
                onChange={(e) => handleInputChange('second_clock_in_reminder_minutes', Number(e.target.value))}
                className="w-[260px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15 minutes after shift start</option>
                <option value={20}>20 minutes after shift start</option>
                <option value={30}>30 minutes after shift start</option>
                <option value={45}>45 minutes after shift start</option>
                <option value={60}>60 minutes after shift start</option>
              </select>
            </div>
          </div>
          
          {/* Third Row - Reminder messages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1st Reminder Message
              </label>
              <textarea
                value={settings.clock_in_message_1}
                onChange={(e) => handleInputChange('clock_in_message_1', e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                placeholder="Enter first reminder message..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {160 - settings.clock_in_message_1.length} characters remaining
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2nd Reminder Message
              </label>
              <textarea
                value={settings.clock_in_message_2}
                onChange={(e) => handleInputChange('clock_in_message_2', e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                placeholder="Enter second reminder message..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {160 - settings.clock_in_message_2.length} characters remaining
              </p>
            </div>
          </div>
          
          {/* Fourth Row - Auto clock-out settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto Clock-Out Limit
              </label>
              <select
                value={settings.auto_clock_out_limit_minutes}
                onChange={(e) => handleInputChange('auto_clock_out_limit_minutes', Number(e.target.value))}
                className="w-[260px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>30 minutes after shift end</option>
                <option value={45}>45 minutes after shift end</option>
                <option value={60}>60 minutes after shift end</option>
                <option value={90}>90 minutes after shift end</option>
                <option value={120}>120 minutes after shift end</option>
              </select>
            </div>
          </div>
          
          {/* Fifth Row - Auto clock-out message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto Clock-Out Message
            </label>
            <textarea
              value={settings.auto_clock_out_message}
              onChange={(e) => handleInputChange('auto_clock_out_message', e.target.value)}
              maxLength={160}
              rows={3}
              className="w-[550px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              placeholder="Enter auto clock-out message..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {160 - settings.auto_clock_out_message.length} characters remaining
            </p>
          </div>
        </div>

        {/* Holiday Management */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Holiday Management</h3>
            <button
              onClick={() => setShowAddFloatingHoliday(true)}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Floating Holiday</span>
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center space-x-4">
              <label className="block text-sm font-medium text-gray-700">
                Select Year:
              </label>
              <select
                value={selectedHolidayYear}
                onChange={(e) => {
                  setSelectedHolidayYear(e.target.value);
                  addHolidayYear(e.target.value);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>
          </div>

          {showAddFloatingHoliday && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-green-900 mb-4">Add Floating Holiday</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Holiday Date
                  </label>
                  <input
                    type="date"
                    value={newFloatingHoliday.date}
                    onChange={(e) => setNewFloatingHoliday(prev => ({ ...prev, date: e.target.value }))}
                    min={`${selectedHolidayYear}-01-01`}
                    max={`${selectedHolidayYear}-12-31`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Holiday Name
                  </label>
                  <input
                    type="text"
                    value={newFloatingHoliday.name}
                    onChange={(e) => setNewFloatingHoliday(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Company Picnic Day"
                    maxLength={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {50 - newFloatingHoliday.name.length} characters remaining
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 mt-4">
                <button
                  onClick={addFloatingHoliday}
                  disabled={!newFloatingHoliday.date || !newFloatingHoliday.name.trim()}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  <span>Add Holiday</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddFloatingHoliday(false);
                    setNewFloatingHoliday({ date: '', name: '' });
                  }}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {getAllHolidaysChronological().map((holiday) => (
              <div key={holiday.key} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={holiday.enabled}
                    onChange={(e) => {
                      if (holiday.type === 'standard') {
                        handleHolidayChange(selectedHolidayYear, holiday.key, e.target.checked);
                      } else {
                        toggleFloatingHoliday(holiday.key, e.target.checked);
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-900">
                        {holiday.name}
                      </label>
                      {holiday.type === 'floating' && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Floating
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDisplayDate(holiday.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    holiday.enabled 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {holiday.enabled ? 'Paid Holiday' : 'Work Day'}
                  </span>
                  {holiday.type === 'floating' && (
                    <button
                      onClick={() => removeFloatingHoliday(holiday.key)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Remove floating holiday"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Holiday Information</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>Checked holidays</strong> are paid days off - employees don't work but get paid</p>
                  <p>• <strong>Unchecked holidays</strong> are regular work days - employees work normal hours</p>
                  <p>• <strong>Floating holidays</strong> are custom dates you can add for company-specific events</p>
                  <p>• Holiday dates are automatically calculated each year (Memorial Day, Labor Day, etc.)</p>
                  <p>• These settings affect vacation calculations and payroll reporting</p>
                  <p>• Configure holidays for each year as needed for your business</p>
                  <p>• All holidays are displayed in chronological order throughout the year</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Shift Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Shift Hours</h3>
          <div className="space-y-4">
            {Object.entries(settings.daily_shifts).map(([day, shift]) => (
              <div key={day} className="flex items-center space-x-4 p-4 bg-white rounded-lg border">
                <div className="flex items-center space-x-3 w-28">
                  <input
                    type="checkbox"
                    checked={shift.enabled}
                    onChange={(e) => handleDailyShiftChange(day as keyof SystemSettings['daily_shifts'], 'enabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="text-sm font-medium text-gray-900">
                    {getDayLabel(day)}
                  </label>
                </div>
                
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={shift.start}
                      onChange={(e) => handleDailyShiftChange(day as keyof SystemSettings['daily_shifts'], 'start', e.target.value)}
                      disabled={!shift.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={shift.end}
                      onChange={(e) => handleDailyShiftChange(day as keyof SystemSettings['daily_shifts'], 'end', e.target.value)}
                      disabled={!shift.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Lunch Required</label>
                    <div className="flex items-center space-x-2 h-10">
                      <input
                        type="checkbox"
                        checked={shift.lunch_required}
                        onChange={(e) => handleDailyShiftChange(day as keyof SystemSettings['daily_shifts'], 'lunch_required', e.target.checked)}
                        disabled={!shift.enabled}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-700">Required</span>
                    </div>
                  </div>
                  
                  <div className="w-20 text-right">
                    {shift.enabled && (
                      <div className="text-sm text-gray-600">
                        <span className="text-xs text-gray-500">Hours:</span>
                        <div className="font-medium">
                          {(() => {
                            const start = new Date(`2000-01-01T${shift.start}:00`);
                            const end = new Date(`2000-01-01T${shift.end}:00`);
                            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            return hours > 0 ? hours.toFixed(1) : '0.0';
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Daily Shift Information</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Configure different start and end times for each day of the week</p>
                  <p>• Check "Lunch Required" for days when employees must take a lunch break</p>
                  <p>• Default lunch duration is {settings.default_lunch_duration_minutes} minutes (configurable above)</p>
                  <p>• <strong>Auto Clock-Out:</strong> After {settings.auto_clock_out_limit_minutes} minutes past shift end, employees are automatically clocked out</p>
                  <p>• <strong>Lunch Deduction:</strong> Auto clock-out includes {settings.default_lunch_duration_minutes} minute lunch deduction if lunch is required for that day</p>
                  <p>• These settings help control labor costs while maintaining fair time tracking and ensuring accurate payroll</p>
                  <p>• These settings will be used for scheduling and payroll calculations</p>
                  <p>• Hours shown are the total shift length for each day</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Limits Information Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Clock className="h-6 w-6 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Time Limit Settings</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• <strong>Limit Start Time:</strong> When checked, employees who clock in early will have their start time recorded as the scheduled shift start time</p>
                <p>• <strong>Limit End Time:</strong> When checked, employees who clock out late will have their end time recorded as the scheduled shift end time</p>
                <p>• <strong>Pay Increments:</strong> Time is rounded to the nearest {settings.pay_increments} minute increment for payroll calculations</p>
                <p>• These settings help control labor costs while maintaining fair time tracking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;