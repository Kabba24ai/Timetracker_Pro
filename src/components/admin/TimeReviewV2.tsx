import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileClock, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { ClockShift } from '../../lib/timeclock';
import {
  AdminEmployee,
  ClockEventRow,
  CorrectableKind,
  CorrectionPayload,
  applyCorrection,
  downloadCsv,
  fetchEmployeeEvents,
  fetchEmployeeShifts,
  fetchEmployees,
  formatDuration,
  shiftsToCsv,
  summarize,
} from '../../lib/admin';
import { formatClock, formatDate, formatInstant, tenantToday } from '../../lib/tz';
import CorrectionModal, { CorrectionDraft } from './CorrectionModal';

const SOURCE_BADGE: Record<string, string> = {
  employee: 'bg-gray-100 text-gray-700',
  admin: 'bg-blue-100 text-blue-700',
  system: 'bg-purple-100 text-purple-700',
};

const CORRECTION_BADGE: Record<string, string> = {
  adjust: 'bg-amber-100 text-amber-800',
  void: 'bg-red-100 text-red-700',
  insert: 'bg-green-100 text-green-700',
};

interface TimeReviewProps {
  // Drill-down seed from the pay-period grid (employee + period range).
  initialUserId?: number | null;
  initialFrom?: string;
  initialTo?: string;
}

const TimeReviewV2: React.FC<TimeReviewProps> = ({ initialUserId, initialFrom, initialTo }) => {
  // The canonical tenant TimeTracker timezone drives ALL wall-clock handling.
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [userId, setUserId] = useState<number | null>(initialUserId ?? null);
  const [from, setFrom] = useState<string>(() => initialFrom ?? tenantToday(tz, 14));
  const [to, setTo] = useState<string>(() => initialTo ?? tenantToday(tz, 0));

  // When a new drill-down target arrives, retarget this screen (auto-loads).
  useEffect(() => {
    if (initialUserId != null) setUserId(initialUserId);
    if (initialFrom) setFrom(initialFrom);
    if (initialTo) setTo(initialTo);
  }, [initialUserId, initialFrom, initialTo]);

  const [shifts, setShifts] = useState<ClockShift[]>([]);
  const [events, setEvents] = useState<ClockEventRow[]>([]);
  const [showLedger, setShowLedger] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correction, setCorrection] = useState<CorrectionDraft | null>(null);

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
      const [s, e] = await Promise.all([
        fetchEmployeeShifts(userId, from, to),
        fetchEmployeeEvents(userId, from, to),
      ]);
      setShifts(s);
      setEvents(e);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load time data.');
    } finally {
      setLoading(false);
    }
  }, [userId, from, to]);

  // Auto-load whenever the selection changes.
  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, from, to]);

  const summary = useMemo(() => summarize(shifts), [shifts]);
  const supersededIds = useMemo(
    () => new Set(events.map((e) => e.corrects_event_id).filter((v): v is number => v != null)),
    [events],
  );
  const employeeName = employees.find((e) => e.id === userId)?.full_name ?? '';

  const submitCorrection = async (payload: CorrectionPayload) => {
    setError(null);
    try {
      await applyCorrection(payload);
      setCorrection(null);
      await load(); // re-fetch both projection + ledger for a consistent view
    } catch (err) {
      // Surface the server's validation message (e.g. impossible sequence).
      throw err instanceof ApiError ? err : new ApiError('The correction could not be applied.', 0);
    }
  };

  const exportCsv = () => {
    if (!shifts.length) return;
    downloadCsv(`time-review_${employeeName || userId}_${from}_${to}.csv`, shiftsToCsv(employeeName, shifts, tz));
  };

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
          <select
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem]"
          >
            <option value="">Select an employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={load}
          disabled={!userId || loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => userId && setCorrection({ mode: 'insert', userId })}
            disabled={!userId}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Insert punch</span>
          </button>
          <button
            onClick={exportCsv}
            disabled={!shifts.length}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!userId ? (
        <p className="text-gray-500 text-center py-12">Select an employee to review their time.</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Worked" value={formatDuration(summary.workedSeconds)} accent="text-blue-600" />
            <SummaryCard label="Shifts" value={String(summary.shiftCount)} sub={summary.openShifts ? `${summary.openShifts} open` : undefined} />
            <SummaryCard label="Lunch" value={formatDuration(summary.lunchSeconds)} />
            <SummaryCard label="Other breaks" value={formatDuration(summary.otherSeconds)} />
          </div>

          {/* Shifts */}
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Shifts</h3>
          {shifts.length === 0 ? (
            <p className="text-gray-500 text-sm py-6">No shifts in this range.</p>
          ) : (
            <div className="space-y-3 mb-2">
              {shifts.map((s) => (
                <ShiftRow key={s.id} shift={s} tz={tz} />
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mb-8">All times shown in {tz} (tenant timezone).</p>

          {/* Ledger */}
          <button
            onClick={() => setShowLedger((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 hover:text-blue-600"
          >
            <FileClock className="h-4 w-4" />
            {showLedger ? 'Hide' : 'Show'} event ledger ({events.length})
          </button>
          {showLedger && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Kind</th>
                    <th className="text-left px-3 py-2 font-medium">Effective</th>
                    <th className="text-left px-3 py-2 font-medium">Raw</th>
                    <th className="text-left px-3 py-2 font-medium">Source</th>
                    <th className="text-left px-3 py-2 font-medium">Reason</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((ev) => {
                    const superseded = supersededIds.has(ev.id);
                    return (
                      <tr key={ev.id} className={superseded ? 'bg-gray-50 text-gray-400' : ''}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {ev.kind_label}
                          {ev.correction_type && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${CORRECTION_BADGE[ev.correction_type] ?? 'bg-gray-100'}`}>
                              {ev.correction_type}
                            </span>
                          )}
                          {superseded && <span className="ml-2 text-xs italic">superseded</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">{formatInstant(ev.effective_at, tz)}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-400">{formatInstant(ev.raw_at, tz)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${SOURCE_BADGE[ev.source] ?? 'bg-gray-100'}`}>
                            {ev.source}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-[16rem] truncate" title={ev.reason ?? ''}>
                          {ev.reason ?? ''}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {!superseded && ev.correction_type !== 'void' && (
                            <>
                              <button
                                onClick={() => setCorrection({ mode: 'adjust', eventId: ev.id, kindLabel: ev.kind_label, effectiveAt: ev.effective_at })}
                                className="text-blue-600 hover:underline mr-3"
                              >
                                Adjust
                              </button>
                              <button
                                onClick={() => setCorrection({ mode: 'void', eventId: ev.id, kindLabel: ev.kind_label })}
                                className="text-red-600 hover:underline"
                              >
                                Void
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {correction && (
        <CorrectionModal
          draft={correction}
          tz={tz}
          onClose={() => setCorrection(null)}
          onSubmit={submitCorrection}
        />
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; sub?: string; accent?: string }> = ({
  label,
  value,
  sub,
  accent,
}) => (
  <div className="bg-gray-50 border rounded-lg p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-2xl font-semibold ${accent ?? 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-amber-600 mt-0.5">{sub}</p>}
  </div>
);

const ShiftRow: React.FC<{ shift: ClockShift; tz: string }> = ({ shift, tz }) => {
  const open = shift.status === 'open';
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50">
        <div className="text-sm">
          <span className="font-medium text-gray-900">{formatClock(shift.clock_in_at, tz)}</span>
          <span className="text-gray-400 mx-1">→</span>
          {open ? (
            <span className="text-green-600 font-medium">In progress</span>
          ) : (
            <span className="text-gray-900">{formatClock(shift.clock_out_at, tz)}</span>
          )}
          <span className="text-gray-400 ml-2">{formatDate(shift.clock_in_at, tz)}</span>
        </div>
        <div className="text-right">
          <span className="font-mono text-gray-900">{formatDuration(shift.worked_seconds)}</span>
          <span className="text-xs text-gray-500 ml-1">worked</span>
        </div>
      </div>
      {shift.breaks.length > 0 && (
        <div className="divide-y divide-gray-100">
          {shift.breaks.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-1.5 text-sm text-gray-600">
              <span>{b.type === 'lunch' ? 'Lunch' : 'Break'} · {formatClock(b.start_at, tz)}–{b.end_at ? formatClock(b.end_at, tz) : 'ongoing'}</span>
              <span className="font-mono">{formatDuration(b.duration_seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export type { CorrectableKind };
export default TimeReviewV2;
