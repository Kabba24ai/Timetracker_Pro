import React, { useState, useEffect } from 'react';
import { Settings, Clock, Save, Calendar } from 'lucide-react';

interface SystemSettings {
  default_vacation_allotment: number;
  vacation_accrual_rate: number;
  pay_increments: number;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_start_date: string;
  default_lunch_duration_minutes: number;
  limit_start_time_to_shift: boolean;
  limit_end_time_to_shift: boolean;
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
  const [settings, setSettings] = useState<SystemSettings>({
    default_vacation_allotment: 80,
    vacation_accrual_rate: 26,
    pay_increments: 15,
    pay_period_type: 'biweekly',
    pay_period_start_date: '2025-01-05',
    default_lunch_duration_minutes: 60,
    limit_start_time_to_shift: false,
    limit_end_time_to_shift: false,
    daily_shifts: {
      monday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
      tuesday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
      wednesday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
      thursday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
      friday: { start: '08:00', end: '17:00', enabled: true, lunch_required: true },
      saturday: { start: '08:00', end: '17:00', enabled: false, lunch_required: false },
      sunday: { start: '08:00', end: '17:00', enabled: false, lunch_required: false },
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Load settings from localStorage for demo
      const savedSettings = localStorage.getItem('demo_system_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
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

  const getDayLabel = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
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
          
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay Period Type
              </label>
              <select
                value={settings.pay_period_type}
                onChange={(e) => handleInputChange('pay_period_type', e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay Period Start Date
              </label>
              <input
                type="date"
                value={settings.pay_period_start_date}
                onChange={(e) => handleInputChange('pay_period_start_date', e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Vacation Allotment
              </label>
              <input
                type="number"
                value={settings.default_vacation_allotment}
                onChange={(e) => handleInputChange('default_vacation_allotment', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                min="0"
                placeholder="80"
              />
              <p className="text-xs text-gray-500 mt-1">Hours per year</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vacation Accrual Rate
              </label>
              <input
                type="number"
                value={settings.vacation_accrual_rate}
                onChange={(e) => handleInputChange('vacation_accrual_rate', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                min="1"
                placeholder="26"
              />
              <p className="text-xs text-gray-500 mt-1">Hours worked per hour earned</p>
            </div>
          </div>
          
          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay Increments (minutes)
              </label>
              <select
                value={settings.pay_increments}
                onChange={(e) => handleInputChange('pay_increments', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Time rounding</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Lunch Duration
              </label>
              <select
                value={settings.default_lunch_duration_minutes}
                onChange={(e) => handleInputChange('default_lunch_duration_minutes', Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Standard lunch</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limit Start Time to Shift Start
              </label>
              <div className="flex items-center h-10">
                <input
                  type="checkbox"
                  checked={settings.limit_start_time_to_shift}
                  onChange={(e) => handleInputChange('limit_start_time_to_shift', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Cap early clock-ins</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limit End Time to Shift End
              </label>
              <div className="flex items-center h-10">
                <input
                  type="checkbox"
                  checked={settings.limit_end_time_to_shift}
                  onChange={(e) => handleInputChange('limit_end_time_to_shift', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Cap late clock-outs</p>
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
                    <div className="flex items-center justify-center h-10">
                      <input
                        type="checkbox"
                        checked={shift.lunch_required}
                        onChange={(e) => handleDailyShiftChange(day as keyof SystemSettings['daily_shifts'], 'lunch_required', e.target.checked)}
                        disabled={!shift.enabled}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                      />
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
                  <p>• Uncheck days when your business is closed</p>
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