import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, Check, Moon, Plus, Save, Trash2 } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { AdminEmployee, fetchEmployees } from '../../lib/admin';
import {
  DAY_LABELS,
  ScheduleOverrideRow,
  ScheduleRuleRow,
  deleteScheduleOverride,
  fetchEmployeeSchedule,
  isOvernight,
  saveEmployeeSchedule,
  saveScheduleOverride,
} from '../../lib/schedule';

function emptyWeek(): ScheduleRuleRow[] {
  return Array.from({ length: 7 }, (_, dow) => ({
    day_of_week: dow,
    is_working_day: false,
    start_time: null,
    end_time: null,
    crosses_midnight: false,
    store_id: null,
  }));
}

const WorkScheduleV2: React.FC = () => {
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [rules, setRules] = useState<ScheduleRuleRow[]>(emptyWeek());
  const [overrides, setOverrides] = useState<ScheduleOverrideRow[]>([]);
  const [timezone, setTimezone] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-override form.
  const [ovDate, setOvDate] = useState('');
  const [ovWorking, setOvWorking] = useState(false);
  const [ovStart, setOvStart] = useState('09:00');
  const [ovEnd, setOvEnd] = useState('17:00');
  const [ovReason, setOvReason] = useState('');

  useEffect(() => {
    fetchEmployees()
      .then(setEmployees)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load employees.'));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const sched = await fetchEmployeeSchedule(userId);
      const week = emptyWeek();
      for (const r of sched.rules) week[r.day_of_week] = { ...week[r.day_of_week], ...r };
      setRules(week);
      setOverrides(sched.overrides);
      setTimezone(sched.timezone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  const setRule = (dow: number, patch: Partial<ScheduleRuleRow>) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.day_of_week !== dow) return r;
        const next = { ...r, ...patch };
        next.crosses_midnight = next.is_working_day ? isOvernight(next.start_time, next.end_time) : false;
        return next;
      }),
    );
  };

  const toggleWorking = (dow: number, working: boolean) => {
    setRule(dow, working
      ? { is_working_day: true, start_time: rules[dow].start_time ?? '09:00', end_time: rules[dow].end_time ?? '17:00' }
      : { is_working_day: false, start_time: null, end_time: null });
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await saveEmployeeSchedule(userId, rules);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not save the schedule.');
    } finally {
      setSaving(false);
    }
  };

  const addOverride = async () => {
    if (!userId || !ovDate) return;
    setError(null);
    try {
      await saveScheduleOverride(userId, {
        date: ovDate,
        is_working_day: ovWorking,
        start_time: ovWorking ? ovStart : null,
        end_time: ovWorking ? ovEnd : null,
        reason: ovReason.trim() || null,
      });
      setOvDate('');
      setOvReason('');
      setOvWorking(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not save the override.');
    }
  };

  const removeOverride = async (id: number) => {
    if (!userId) return;
    try {
      await deleteScheduleOverride(userId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the override.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <CalendarDays className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Work Schedule</h2>
          <p className="text-sm text-gray-500">
            Recurring weekly schedule + date overrides{timezone ? ` · times in ${timezone}` : ''}
          </p>
        </div>
        <select
          value={userId ?? ''}
          onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem]"
        >
          <option value="">Select an employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!userId ? (
        <p className="text-gray-500 text-center py-12">Select an employee to edit their schedule.</p>
      ) : loading ? (
        <p className="text-gray-400 text-center py-12">Loading…</p>
      ) : (
        <>
          {/* Recurring weekly grid */}
          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Day</th>
                  <th className="text-left px-4 py-2 font-medium">Scheduled</th>
                  <th className="text-left px-4 py-2 font-medium">Start</th>
                  <th className="text-left px-4 py-2 font-medium">End</th>
                  <th className="text-left px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.day_of_week} className={r.is_working_day ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 font-medium text-gray-900">{DAY_LABELS[r.day_of_week]}</td>
                    <td className="px-4 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.is_working_day}
                          onChange={(e) => toggleWorking(r.day_of_week, e.target.checked)}
                          aria-label={`${DAY_LABELS[r.day_of_week]} scheduled`}
                        />
                        <span className={r.is_working_day ? 'text-green-700' : 'text-gray-400'}>
                          {r.is_working_day ? 'Working' : 'Day off'}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={r.start_time ?? ''}
                        disabled={!r.is_working_day}
                        onChange={(e) => setRule(r.day_of_week, { start_time: e.target.value || null })}
                        className="px-2 py-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={r.end_time ?? ''}
                        disabled={!r.is_working_day}
                        onChange={(e) => setRule(r.day_of_week, { end_time: e.target.value || null })}
                        className="px-2 py-1 border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {r.crosses_midnight && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                          <Moon className="h-3 w-3" /> Overnight
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving…' : 'Save weekly schedule'}</span>
            </button>
            {savedFlash && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>

          {/* Date overrides */}
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Date overrides</h3>
          <p className="text-xs text-gray-500 mb-3">
            One-off exceptions (holidays, swaps) for a specific date — these take precedence over the weekly schedule.
          </p>

          {overrides.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {overrides.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">{o.date}</td>
                      <td className="px-4 py-2">
                        {o.is_working_day ? (
                          <span className="text-green-700">
                            Working {o.start_time}–{o.end_time}
                            {o.crosses_midnight ? ' (overnight)' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-500">Day off</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{o.reason}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => removeOverride(o.id)}
                          className="text-red-600 hover:text-red-700"
                          aria-label={`Delete override ${o.date}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 border rounded-lg p-4 bg-gray-50">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                aria-label="Override date"
                value={ovDate}
                onChange={(e) => setOvDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
              <input type="checkbox" checked={ovWorking} onChange={(e) => setOvWorking(e.target.checked)} />
              Working day
            </label>
            {ovWorking && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                  <input type="time" value={ovStart} onChange={(e) => setOvStart(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                  <input type="time" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg" />
                </div>
              </>
            )}
            <div className="flex-1 min-w-[10rem]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={ovReason}
                onChange={(e) => setOvReason(e.target.value)}
                placeholder="e.g. Holiday"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              onClick={addOverride}
              disabled={!ovDate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add override</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkScheduleV2;
