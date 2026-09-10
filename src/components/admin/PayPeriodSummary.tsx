import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  PayPeriodSummary as Summary,
  downloadCsv,
  fetchPayPeriodSummary,
  flagLabel,
  formatDuration,
  isPending,
  payPeriodCsvFilename,
  payPeriodToCsv,
} from '../../lib/admin';
import { tenantToday } from '../../lib/tz';

type Mode = 'current' | 'previous' | 'custom';

/**
 * Everything that decides WHICH pay period the administrator is looking at, plus
 * the two review controls. Held by the parent so drilling into an employee's
 * Time Review and coming back lands on the SAME period, sort and filter.
 */
export interface PayPeriodView {
  mode: Mode;
  from: string;
  to: string;
  sort: 'name' | 'paid_desc';
  flagged: boolean;
}

// Post-cutover the Flags column shows ONLY Pending (from the canonical Pending
// model); legacy badges are retired. A row with no Pending record renders blank.
const FLAG_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
};

const MODE_LABEL: Record<Mode, string> = {
  current: 'Current Period',
  previous: 'Previous Period',
  custom: 'Custom',
};

interface Props {
  onDrillDown: (userId: number, from: string, to: string) => void;
  /** Controlled period/sort/filter selection (preserved across a drill-down). */
  view?: PayPeriodView;
  onViewChange?: (view: PayPeriodView) => void;
}

export const defaultPayPeriodView = (tz: string): PayPeriodView => ({
  mode: 'current',
  from: tenantToday(tz, 13),
  to: tenantToday(tz, 0),
  sort: 'name',
  flagged: false,
});

const PayPeriodSummaryGrid: React.FC<Props> = ({ onDrillDown, view, onViewChange }) => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  // Controlled when the parent supplies a view (so it survives the drill-down);
  // otherwise the component owns its own selection.
  const [ownView, setOwnView] = useState<PayPeriodView>(() => view ?? defaultPayPeriodView(tz));
  const current = view ?? ownView;
  const { mode, from, to, sort, flagged } = current;

  const setView = (patch: Partial<PayPeriodView>) => {
    const next = { ...current, ...patch };
    setOwnView(next);
    onViewChange?.(next);
  };

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The one place the selection becomes request parameters. `flagged` is a
  // REVIEW filter only — the export deliberately omits it (see exportCsv).
  const periodParams = useCallback(
    () => (mode === 'custom' ? { from, to } : { period: mode as 'current' | 'previous' }),
    [mode, from, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchPayPeriodSummary({ ...periodParams(), sort, flagged }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the pay-period summary.');
    } finally {
      setLoading(false);
    }
  }, [periodParams, sort, flagged]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Export the FULL selected pay period — every employee — no matter what the
   * screen is filtered to. "Exceptions only" is a review tool; a partial payroll
   * file must never leave this page because of it, so the authoritative
   * unfiltered summary is re-read at export time and serialized from the same
   * canonical fields the grid renders.
   */
  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const full = await fetchPayPeriodSummary({ ...periodParams(), sort });
      downloadCsv(payPeriodCsvFilename(full.period), payPeriodToCsv(full));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export the pay period.');
    } finally {
      setExporting(false);
    }
  };

  const totals = summary?.totals;
  const pendingEmployees = summary?.data.filter(isPending).length ?? 0;

  return (
    <div className="p-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(['current', 'previous', 'custom'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setView({ mode: m })}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setView({ from: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setView({ to: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setView({ flagged: e.target.checked })}
            />
            Exceptions only
          </label>
          <button
            onClick={() => setView({ sort: sort === 'name' ? 'paid_desc' : 'name' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Sort: {sort === 'name' ? 'Name' : 'Total Paid ↓'}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCsv}
            disabled={exporting || !summary}
            title="Exports every employee in the selected pay period, ignoring the Exceptions only filter"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>{exporting ? 'Exporting…' : 'Export Full Pay Period'}</span>
          </button>
        </div>
      </div>

      {summary && (
        <p className="text-sm text-gray-500 mb-4">
          {summary.period.label ?? `${summary.period.from} – ${summary.period.to}`}
          <span className="text-gray-400"> · times in {summary.period.timezone}</span>
          {totals && (
            <span className="text-gray-400">
              {' '}
              · {totals.employees} employee{totals.employees === 1 ? '' : 's'}
            </span>
          )}
          {pendingEmployees > 0 && (
            <span className="text-amber-700">
              {' '}
              · {pendingEmployees} employee{pendingEmployees === 1 ? ' has' : 's have'} Pending items
            </span>
          )}
        </p>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Period overview — the accountant buckets. Total Paid is the primary
          figure; the rest are the components it is made of. */}
      {totals && (
        <div data-testid="period-totals" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
          <Total
            label="Total Paid"
            value={formatDuration(totals.total_paid_seconds)}
            accent="text-blue-700"
            emphasize
          />
          <Total label="Regular" value={formatDuration(totals.regular_worked_seconds)} />
          <Total label="Overtime" value={formatDuration(totals.overtime_worked_seconds)} accent="text-orange-600" />
          <Total label="Vacation" value={formatDuration(totals.vacation_seconds)} accent="text-green-700" />
          <Total label="Holiday" value={formatDuration(totals.holiday_seconds)} accent="text-indigo-700" />
          <Total label="Other Paid Leave" value={formatDuration(totals.other_paid_leave_seconds)} />
        </div>
      )}

      {/* The two identities the accountant is paying against. */}
      <p className="text-xs text-gray-500 mb-4">
        <span className="font-medium text-gray-600">Total Worked</span> = Regular + Overtime (paid worked time).{' '}
        <span className="font-medium text-blue-700">Total Paid</span> = Total Worked + Vacation + Holiday + Other Paid
        Leave.
      </p>

      {/* Grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <Th align="left">Employee</Th>
              <Th>Regular</Th>
              <Th>Overtime</Th>
              <Th>Vacation</Th>
              <Th>Holiday</Th>
              <Th>Other Paid Leave</Th>
              <Th sub="Regular + OT">Total Worked</Th>
              <Th sub="+ paid leave">Total Paid</Th>
              <Th align="left">Status</Th>
              <th className="px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !summary ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : summary && summary.data.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  No employees match this view.
                </td>
              </tr>
            ) : (
              summary?.data.map((r) => (
                <tr
                  key={r.employee.id}
                  onClick={() => onDrillDown(r.employee.id, summary.period.from, summary.period.to)}
                  className="hover:bg-blue-50/50 cursor-pointer"
                  title="Open this employee's Time Review for this exact pay period"
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{r.employee.full_name}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-900">
                    {formatDuration(r.regular_worked_seconds)}
                  </td>
                  <Hours seconds={r.overtime_worked_seconds} className="text-orange-600" />
                  <Hours seconds={r.vacation_seconds} className="text-green-700" />
                  <Hours seconds={r.holiday_seconds} className="text-indigo-700" />
                  <Hours seconds={r.other_paid_leave_seconds} className="text-gray-600" />
                  {/* Total Worked = Regular + Overtime — PAID worked time, never
                      the gross elapsed span. */}
                  <td className="px-4 py-2 text-right font-mono text-gray-900">
                    {formatDuration(r.total_worked_seconds)}
                    {r.has_open_shift && (
                      <span
                        className="ml-1 text-amber-500 font-sans"
                        title="Includes an open shift — not final until clock-out"
                      >
                        *
                      </span>
                    )}
                  </td>
                  {/* Total Paid — the primary accountant figure. */}
                  <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700">
                    {formatDuration(r.total_paid_seconds)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.flags.map((f) => (
                        <span key={f} className={`px-2 py-0.5 rounded-full text-xs ${FLAG_STYLE[f] ?? 'bg-gray-100'}`}>
                          {flagLabel(f)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 text-gray-300">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** A leave/overtime cell: an em dash reads better than 0:00 for an empty bucket. */
const Hours: React.FC<{ seconds: number; className: string }> = ({ seconds, className }) => (
  <td className={`px-4 py-2 text-right font-mono ${seconds > 0 ? className : 'text-gray-300'}`}>
    {seconds > 0 ? formatDuration(seconds) : '—'}
  </td>
);

const Th: React.FC<{ children: React.ReactNode; sub?: string; align?: 'left' | 'right' }> = ({
  children,
  sub,
  align = 'right',
}) => (
  <th className={`${align === 'left' ? 'text-left' : 'text-right'} px-4 py-2 font-medium align-bottom`}>
    <span>{children}</span>
    {sub && <span className="block text-[10px] font-normal text-gray-400">({sub})</span>}
  </th>
);

const Total: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  emphasize?: boolean;
}> = ({ label, value, sub, accent, emphasize }) => (
  <div className={`rounded-lg p-4 border ${emphasize ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`${emphasize ? 'text-2xl' : 'text-xl'} font-semibold ${accent ?? 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

export default PayPeriodSummaryGrid;
