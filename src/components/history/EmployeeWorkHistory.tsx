import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  DayPosition,
  HistoryDay,
  HistoryReview,
  POSITION_COLUMNS,
  fetchMyHistory,
  formatDuration,
} from '../../lib/history';
import { formatClock } from '../../lib/tz';
import PeriodControls, { PeriodMode } from './PeriodControls';

const DAY_TYPE_STYLE: Record<string, string> = {
  'Working Day': 'bg-blue-50 text-blue-700',
  'Day Off': 'bg-gray-100 text-gray-500',
  Override: 'bg-amber-50 text-amber-700',
  'PTO / Excused': 'bg-green-50 text-green-700',
  Unscheduled: 'bg-gray-50 text-gray-400',
};

/**
 * Employee READ-ONLY Work History — the same per-day pay-period detail the Admin
 * Time Review shows for this employee, with ZERO mutation surface: no employee
 * picker, no Add/Edit/Delete, no correction controls, no raw audit ledger. The
 * server derives the employee from the token and owns all payroll math.
 */
const EmployeeWorkHistory: React.FC = () => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  const [mode, setMode] = useState<PeriodMode>('current');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [review, setReview] = useState<HistoryReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        mode === 'custom' && from && to
          ? { from, to }
          : { period: mode === 'previous' ? 'previous' : 'current' };
      const data = await fetchMyHistory(params as { period?: 'current' | 'previous'; from?: string; to?: string });
      setReview(data);
      // Keep the custom inputs in sync with the resolved current/previous period.
      if (mode !== 'custom') {
        setFrom(data.period.from);
        setTo(data.period.to);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your work history.');
    } finally {
      setLoading(false);
    }
  }, [mode, from, to]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const totals = review?.totals;

  return (
    <div>
      <div className="mb-5">
        <PeriodControls
          mode={mode}
          onModeChange={setMode}
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onRefresh={load}
          loading={loading}
        />
      </div>

      {review && (
        <p className="text-sm text-gray-500 mb-3">
          {review.period.label ?? `${review.period.from} – ${review.period.to}`}
        </p>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Summary cards — Paid → Unpaid → Total Worked, then Shifts / Lunch / Other. */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <Card label="Paid" value={formatDuration(totals.paid_seconds)} accent="text-blue-700" emphasize />
          <Card label="Unpaid" value={formatDuration(totals.unpaid_seconds)} accent="text-orange-600" />
          <Card label="Total Worked" value={formatDuration(totals.gross_seconds)} accent="text-gray-900" />
          <Card
            label="Shifts"
            value={String(totals.shift_count)}
            sub={totals.open_shift_count ? `${totals.open_shift_count} open` : undefined}
          />
          <Card label="Lunch" value={formatDuration(totals.lunch_seconds)} />
          <Card label="Other Breaks" value={formatDuration(totals.other_break_seconds)} />
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">All times shown in {tz} (tenant timezone).</p>

      {/* Daily grid — one row per calendar day, recorded or not. Read-only. */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Day</th>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Day Type</th>
              {POSITION_COLUMNS.map((c) => (
                <th key={c.key} className="text-center px-2 py-2 font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-medium text-blue-700">Paid</th>
              <th className="text-right px-3 py-2 font-medium text-orange-600">Unpaid</th>
              <th className="text-right px-3 py-2 font-medium">Total Worked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !review ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : (
              review?.days.map((d) => (
                <tr key={d.date} className="hover:bg-gray-50/60">
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{d.weekday_label}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.date.slice(5)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {d.pending ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700"
                        title={d.pending_reasons.join(' · ')}
                      >
                        Pending — {d.pending_reasons.join(' · ')}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${DAY_TYPE_STYLE[d.day_type] ?? 'bg-gray-100 text-gray-500'}`}>
                        {d.day_type}
                      </span>
                    )}
                  </td>
                  {POSITION_COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-center">
                      <PunchCell
                        pos={d.positions[c.key]}
                        unverified={c.key === 'clock_out' && d.clock_out_unverified}
                        tz={tz}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700 whitespace-nowrap">
                    {d.pending ? (
                      <span className="font-sans text-amber-600 font-medium">Pending</span>
                    ) : (
                      <>
                        {formatDuration(d.paid_seconds)}
                        {d.has_open_shift && (
                          <span
                            className="ml-1 text-amber-500 font-sans"
                            title="Includes an open shift — not final until clock-out"
                          >
                            *
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-orange-600">
                    {d.pending ? '—' : formatDuration(d.unpaid_seconds)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">
                    {d.pending ? '—' : formatDuration(d.gross_seconds)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td colSpan={9} className="px-3 py-3 text-gray-700">
                  Pay Period Total
                </td>
                <td className="px-3 py-3 text-right font-mono text-blue-700">{formatDuration(totals.paid_seconds)}</td>
                <td className="px-3 py-3 text-right font-mono text-orange-600">{formatDuration(totals.unpaid_seconds)}</td>
                <td className="px-3 py-3 text-right font-mono text-gray-900">{formatDuration(totals.gross_seconds)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// Read-only punch cell — a Missing-Clock-Out Pending day shows "Missing /
// Pending" (needs admin review); otherwise the tenant-time punch or an em dash.
const PunchCell: React.FC<{ pos: DayPosition | null; unverified?: boolean; tz: string }> = ({
  pos,
  unverified,
  tz,
}) => {
  if (unverified || pos?.unverified) {
    return <span className="px-2 py-1 rounded text-xs font-semibold text-amber-700 bg-amber-50">Missing / Pending</span>;
  }

  return pos ? (
    <span className="font-mono text-gray-900">{formatClock(pos.at, tz)}</span>
  ) : (
    <span className="font-mono text-gray-300">--:--</span>
  );
};

const Card: React.FC<{ label: string; value: string; sub?: string; accent?: string; emphasize?: boolean }> = ({
  label,
  value,
  sub,
  accent,
  emphasize,
}) => (
  <div className={`rounded-lg p-4 border ${emphasize ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`${emphasize ? 'text-2xl' : 'text-xl'} font-semibold ${accent ?? 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-amber-600 mt-0.5">{sub}</p>}
  </div>
);

export default EmployeeWorkHistory;
