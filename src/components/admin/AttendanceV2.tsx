import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, RotateCcw, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  ATTENDANCE_STATUS_STYLE,
  AttendanceDayRow,
  AttendanceSummary,
  fetchAttendanceSummary,
  fetchEmployeeAttendance,
  rebuildAttendance,
} from '../../lib/attendance';
import { formatClock, formatInstant, tenantToday } from '../../lib/tz';

type Mode = 'current' | 'previous' | 'custom';

const AttendanceV2: React.FC = () => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  const [mode, setMode] = useState<Mode>('current');
  const [from, setFrom] = useState(() => tenantToday(tz, 13));
  const [to, setTo] = useState(() => tenantToday(tz, 0));

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drill, setDrill] = useState<{ id: number; name: string } | null>(null);
  const [drillDays, setDrillDays] = useState<AttendanceDayRow[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = mode === 'custom' ? { from, to } : { period: mode };
      setSummary(await fetchAttendanceSummary(params));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }, [mode, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const rebuild = async () => {
    if (!summary) return;
    setRebuilding(true);
    setError(null);
    try {
      await rebuildAttendance({ from: summary.period.from, to: summary.period.to });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not rebuild attendance.');
    } finally {
      setRebuilding(false);
    }
  };

  const openDrill = async (id: number, name: string) => {
    if (!summary) return;
    setDrill({ id, name });
    setDrillDays(null);
    try {
      const emp = await fetchEmployeeAttendance(id, { from: summary.period.from, to: summary.period.to });
      setDrillDays(emp.data);
    } catch {
      setDrillDays([]);
    }
  };

  const totals = summary?.totals;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(['current', 'previous', 'custom'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'custom' ? 'Custom' : `${m} period`}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={rebuild}
            disabled={rebuilding || !summary}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="Re-derive attendance for this period from schedules + shifts"
          >
            <RotateCcw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
            <span>{rebuilding ? 'Rebuilding…' : 'Rebuild'}</span>
          </button>
        </div>
      </div>

      {summary && (
        <p className="text-sm text-gray-500 mb-4">
          {summary.period.label ?? `${summary.period.from} – ${summary.period.to}`}
          <span className="text-gray-400"> · times in {summary.period.timezone}</span>
        </p>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <Total label="Present" value={totals.present} accent="text-green-600" />
          <Total label="Late" value={totals.late} accent="text-amber-600" />
          <Total label="Absent" value={totals.absent} accent="text-red-600" />
          <Total label="Excused" value={totals.excused} accent="text-blue-600" />
          <Total label="Mins late" value={totals.minutes_late} />
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Employee</th>
              <th className="text-right px-3 py-2 font-medium">Present</th>
              <th className="text-right px-3 py-2 font-medium">Late</th>
              <th className="text-right px-3 py-2 font-medium">Absent</th>
              <th className="text-right px-3 py-2 font-medium">Excused</th>
              <th className="text-right px-3 py-2 font-medium">Mins late</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !summary ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : summary && summary.data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No employees.</td></tr>
            ) : (
              summary?.data.map((r) => (
                <tr
                  key={r.employee.id}
                  onClick={() => openDrill(r.employee.id, r.employee.full_name)}
                  className="hover:bg-blue-50/50 cursor-pointer"
                  title="View day-by-day attendance"
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{r.employee.full_name}</td>
                  <td className="px-3 py-2 text-right text-green-700">{r.present}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{r.late}</td>
                  <td className="px-3 py-2 text-right text-red-700">{r.absent}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{r.excused}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{r.minutes_late}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrill(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{drill.name} — attendance</h3>
              <button onClick={() => setDrill(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {drillDays === null ? (
              <p className="text-gray-400 py-6 text-center">Loading…</p>
            ) : drillDays.length === 0 ? (
              <p className="text-gray-400 py-6 text-center">No days in range.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Date</th>
                    <th className="text-left px-2 py-1 font-medium">Status</th>
                    <th className="text-left px-2 py-1 font-medium">Scheduled</th>
                    <th className="text-left px-2 py-1 font-medium">Worked</th>
                    <th className="text-right px-2 py-1 font-medium">Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drillDays.map((d) => (
                    <tr key={d.date}>
                      <td className="px-2 py-1.5 text-gray-900">{d.date}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ATTENDANCE_STATUS_STYLE[d.status] ?? 'bg-gray-100'}`}>
                          {d.status_label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">
                        {d.scheduled && d.scheduled_start
                          ? `${formatClock(d.scheduled_start, tz)}–${formatClock(d.scheduled_end, tz)}`
                          : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">
                        {d.first_clock_in ? formatInstant(d.first_clock_in, tz, { hour: 'numeric', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-600">{d.minutes_late || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Total: React.FC<{ label: string; value: number; accent?: string }> = ({ label, value, accent }) => (
  <div className="bg-gray-50 border rounded-lg p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-2xl font-semibold ${accent ?? 'text-gray-900'}`}>{value}</p>
  </div>
);

export default AttendanceV2;
