import React, { useState, useEffect } from 'react';
import { Settings, Clock, Save, Calendar } from 'lucide-react';

interface SystemSettings {
  default_vacation_allotment: number;
  vacation_accrual_rate: number;
  pay_buffer_minutes: number;
  pay_period_type: 'weekly' | 'biweekly';
  pay_period_start_date: string;
  daily_shifts: {
    monday: { start: string; end: string; enabled: boolean };
    tuesday: { start: string; end: string; enabled: boolean };
    wednesday: { start: string; end: string; enabled: boolean };
    thursday: { start: string; end: string; enabled: boolean };
    friday: { start: string; end: string; enabled: boolean };
    saturday: { start: string; end: string; enabled: boolean };
    sunday: { start: string; end: string; enabled: boolean };
  };
}

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    default_vacation_allotment: 80,
    vacation_accrual_rate: 26,
    pay_buffer_minutes: 15,
    pay_period_type: 'biweekly',
    pay_period_start_date: '2025-01-05',
    daily_shifts: {
      monday: { start: '08:00', end: '17:00', enabled: true },
      tuesday: { start: '08:00', end: '17:00', enabled: true },
      wednesday: { start: '08:00', end: '17:00', enabled: true },
      thursday: { start: '08:00', end: '17:00', enabled: true },
      friday: { start: '08:00', end: '17:00', enabled: true },
      saturday: { start: '08:00', end: '17:00', enabled: false },
      sunday: { start: '08:00', end: '17:00', enabled: false },
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

  const handleDailyShiftChange = (day: keyof SystemSettings['daily_shifts'], field: 'start' | 'end' | 'enabled', value: string | boolean) => {
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
        {/* Vacation Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vacation Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Vacation Allotment (hours)
              </label>
              <input
                type="number"
                value={settings.default_vacation_allotment}
                onChange={(e) => handleInputChange('default_vacation_allotment', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Standard is 80 hours (2 weeks)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vacation Accrual Rate (hours worked per hour earned)
              </label>
              <input
                type="number"
                value={settings.vacation_accrual_rate}
                onChange={(e) => handleInputChange('vacation_accrual_rate', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">1 vacation hour per X hours worked</p>
            </div>
          </div>
        </div>

        {/* Time Tracking Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Tracking Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pay Buffer (minutes)
              </label>
              <input
                type="number"
                value={settings.pay_buffer_minutes}
                onChange={(e) => handleInputChange('pay_buffer_minutes', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Grace period for early/late clock in/out</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Shift Start
              </label>
              <input
                type="time"
                value={settings.default_shift_start}
                onChange={(e) => handleInputChange('default_shift_start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Shift End
              </label>
              <input
                type="time"
                value={settings.default_shift_end}
                onChange={(e) => handleInputChange('default_shift_end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Pay Period Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pay Period Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pay Period Type
              </label>
              <select
                value={settings.pay_period_type}
                onChange={(e) => handleInputChange('pay_period_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly">Weekly (7 days)</option>
                <option value="biweekly">Biweekly (14 days)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">How often employees are paid</p>
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
              <p className="text-xs text-gray-500 mt-1">First day of Pay Period 1</p>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Pay Period Information</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Pay periods are numbered sequentially starting from the start date</p>
                  <p>• {settings.pay_period_type === 'weekly' ? 'Weekly periods run for 7 days' : 'Biweekly periods run for 14 days'}</p>
                  <p>• All time reports will be organized by pay period for easier payroll processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Information Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Clock className="h-6 w-6 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Pay Buffer Information</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Employees can clock in up to {settings.pay_buffer_minutes} minutes early and still be paid from shift start time</p>
                <p>• Employees can clock out up to {settings.pay_buffer_minutes} minutes late and still be paid only until shift end time</p>
                <p>• This prevents time theft while allowing for minor variations in schedule adherence</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;