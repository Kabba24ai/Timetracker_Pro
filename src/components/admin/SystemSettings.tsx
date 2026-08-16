import React, { useEffect, useState } from 'react';
import { Settings, Save, AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react';
import { fetchSettings, saveSettings, TimeTrackerSettings } from '../../lib/settings';
import { ApiError } from '../../lib/api';

// The canonical V2 admin Settings screen. Presentation/editing only — the server
// owns the key set, validation, defaults, and auditing. This screen exposes ONLY
// the live settings the V2 engine actually consumes; the retired demo's holidays,
// daily-shift grid, and limit-to-shift toggles are gone (no V2 consumer).

type NumericKey =
  | 'pay_increments'
  | 'minimum_lunch_duration_minutes'
  | 'default_lunch_duration_minutes'
  | 'auto_lunch_minutes'
  | 'first_clock_in_reminder_minutes'
  | 'second_clock_in_reminder_minutes'
  | 'missed_clock_out_reminder_minutes'
  | 'auto_clock_out_warning_minutes'
  | 'auto_clock_out_limit_minutes'
  | 'max_shift_hours'
  | 'attendance_grace_minutes';

type MessageKey =
  | 'auto_lunch_message'
  | 'clock_in_message_1'
  | 'clock_in_message_2'
  | 'missed_clock_out_message'
  | 'auto_clock_out_warning_message'
  | 'auto_clock_out_message';

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<TimeTrackerSettings | null>(null);
  const [timezone, setTimezone] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchSettings();
        if (!active) return;
        setSettings(res.settings);
        setTimezone(res.timezone);
      } catch (e) {
        if (active) setError(e instanceof ApiError ? e.firstError() : 'Could not load settings.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setNum = (key: NumericKey, value: string) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value === '' ? 0 : Number(value) } : prev));

  const setMsg = (key: MessageKey, value: string) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await saveSettings(settings);
      setSettings(res.settings);
      setTimezone(res.timezone);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span>{error ?? 'Settings are unavailable.'}</span>
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

  const NumberField: React.FC<{ label: string; k: NumericKey; min?: number; max?: number; hint?: string }> = ({
    label,
    k,
    min = 0,
    max,
    hint,
  }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="number"
        value={settings[k]}
        min={min}
        max={max}
        onChange={(e) => setNum(k, e.target.value)}
        className={inputCls}
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );

  const MessageField: React.FC<{ label: string; k: MessageKey; hint?: string }> = ({ label, k, hint }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        value={settings[k] ?? ''}
        onChange={(e) => setMsg(k, e.target.value)}
        rows={3}
        maxLength={500}
        className={`${inputCls} text-sm resize-none`}
        placeholder="Enter message…"
      />
      <p className="text-xs text-gray-500 mt-1">
        {hint ? `${hint} · ` : ''}Merge tokens: {'{name}'}, {'{time}'}, {'{lunch_minutes}'}
      </p>
    </div>
  );

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving…' : 'Save Settings'}</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      {saved && (
        <div className="mb-4 flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm">Settings saved.</span>
        </div>
      )}

      <div className="space-y-6">
        <Section title="Payroll">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Pay Rounding Increment</label>
              <select
                value={settings.pay_increments}
                onChange={(e) => setNum('pay_increments', e.target.value)}
                className={inputCls}
              >
                <option value={0}>No rounding</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Punches round to the nearest increment.</p>
            </div>
            <div>
              <label className={labelCls}>Pay Period Type</label>
              <select
                value={settings.pay_period_type}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, pay_period_type: e.target.value as 'weekly' | 'biweekly' } : prev,
                  )
                }
                className={inputCls}
              >
                <option value="weekly">Weekly (7 days)</option>
                <option value="biweekly">Bi-weekly (14 days)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Pay Period Anchor Date</label>
              <input
                type="date"
                value={settings.pay_period_start_date}
                onChange={(e) =>
                  setSettings((prev) => (prev ? { ...prev, pay_period_start_date: e.target.value } : prev))
                }
                className={inputCls}
              />
              <p className="text-xs text-gray-500 mt-1">Periods are counted from this date.</p>
            </div>
          </div>
        </Section>

        <Section title="Lunch">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <NumberField label="Minimum Lunch (minutes)" k="minimum_lunch_duration_minutes" max={240} hint="Enforced when ending lunch manually." />
            <NumberField label="Mandatory Lunch (minutes)" k="default_lunch_duration_minutes" max={240} hint="Applied by auto lunch remediation." />
            <NumberField label="Missed-Lunch Reminder Lead (minutes)" k="auto_lunch_minutes" max={1440} hint="Before shift end." />
          </div>
          <MessageField label="Missed-Lunch Reminder Message" k="auto_lunch_message" />
        </Section>

        <Section title="Return-from-Lunch Reminders">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <NumberField label="1st Reminder (minutes after lunch start)" k="first_clock_in_reminder_minutes" max={1440} />
            <NumberField label="2nd Reminder (minutes after lunch start)" k="second_clock_in_reminder_minutes" max={1440} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MessageField label="1st Reminder Message" k="clock_in_message_1" />
            <MessageField label="2nd Reminder Message" k="clock_in_message_2" />
          </div>
        </Section>

        <Section title="Missed Clock-Out & Auto Clock-Out">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <NumberField label="Missed Clock-Out Reminder (minutes after shift end)" k="missed_clock_out_reminder_minutes" max={1440} />
            <NumberField label="Auto Clock-Out Warning (minutes before)" k="auto_clock_out_warning_minutes" max={1440} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className={labelCls}>Auto Clock-Out Time</label>
              <input
                type="time"
                value={settings.auto_clock_out_time ?? ''}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, auto_clock_out_time: e.target.value === '' ? null : e.target.value } : prev,
                  )
                }
                className={inputCls}
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {timezone || 'tenant tz'} · blank = store-close fallback
              </p>
            </div>
            <NumberField label="…or Minutes After Store Close" k="auto_clock_out_limit_minutes" max={1440} hint="Used only when no time is set." />
            <NumberField label="Max Open Shift (hours)" k="max_shift_hours" min={1} max={48} hint="Cross-midnight safety cap." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MessageField label="Missed Clock-Out Message" k="missed_clock_out_message" />
            <MessageField label="Auto Clock-Out Warning Message" k="auto_clock_out_warning_message" />
            <MessageField label="Auto Clock-Out Message" k="auto_clock_out_message" />
          </div>
        </Section>

        <Section title="Attendance">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumberField label="Late Grace Period (minutes)" k="attendance_grace_minutes" max={240} hint="After scheduled start before a punch counts late." />
          </div>
        </Section>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-800">
            These settings drive the V2 timekeeping engine directly — rounding, automation reminders, auto
            clock-out, pay periods, and attendance. Changes are validated on the server and every change is audited.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
