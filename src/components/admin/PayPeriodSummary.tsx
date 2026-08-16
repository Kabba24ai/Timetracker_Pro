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
  payPeriodToCsv,
} from '../../lib/admin';
import { tenantToday } from '../../lib/tz';

type Mode = 'current' | 'previous' | 'custom';

const FLAG_STYLE: Record<string, string> = {
  open_shift: 'bg-green-100 text-green-700',
  has_corrections: 'bg-amber-100 text-amber-800',
  auto_clock_out: 'bg-purple-100 text-purple-700',
  mandatory_lunch: 'bg-orange-100 text-orange-700',
  no_activity: 'bg-gray-100 text-gray-500',
};

interface Props {
  onDrillDown: (userId: number, from: string, to: string) => void;
}

const PayPeriodSummaryGrid: React.FC<Props> = ({ onDrillDown }) => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  const [mode, setMode] = useState<Mode>('current');
  const [from, setFrom] = useState<string>(() => tenantToday(tz, 13));
  const [to, setTo] = useState<string>(() => tenantToday(tz, 0));
  const [sort, setSort] = useState<'name' | 'paid_desc'>('name');
  const [flagged, setFlagged] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        mode === 'custom' ? { from, to, sort, flagged } : { period: mode, sort, flagged };
      setSummary(await fetchPayPeriodSummary(params));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the pay-period summary.');
    } finally {
      setLoading(false);
    }
  }, [mode, from, to, sort, flagged]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    if (!summary?.data.length) return;
    const p = summary.period;
    downloadCsv(`pay-period_${p.from}_${p.to}.csv`, payPeriodToCsv(summary));
  };

  const totals = summary?.totals;

  return (
    <div className="p-6">
      {/* Period selector */}
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
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
            Exceptions only
          </label>
          <button
            onClick={() => setSort((s) => (s === 'name' ? 'paid_desc' : 'name'))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Sort: {sort === 'name' ? 'Name' : 'Paid ↓'}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCsv}
            disabled={!summary?.data.length}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
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

      {/* Summary cards — Paid is primary; Unpaid its own aggregate. */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <Total
            label="Paid Hours"
            value={formatDuration(totals.paid_seconds)}
            accent="text-blue-700"
            emphasize
          />
          <Total label="Unpaid Hours" value={formatDuration(totals.unpaid_seconds)} accent="text-orange-600" />
          <Total label="Employees" value={`${totals.employees_with_activity}/${totals.employees}`} sub="active/total" />
          <Total label="Shifts" value={String(totals.shift_count)} />
          <Total label="Corrections" value={String(totals.correction_count)} />
          <Total label="System Events" value={String(totals.system_event_count)} />
        </div>
      )}

      {/* Payroll formula — true because "Worked" is gross elapsed time. */}
      <p className="text-xs text-gray-500 mb-4">
        <span className="font-medium text-gray-600">Paid Hours</span> = Worked Hours −
        (Lunch + Other Unpaid Hours). Pay the <span className="text-blue-700 font-medium">Paid Hours</span> column,
        not Worked.
      </p>

      {/* Grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <Th align="left">Employee</Th>
              <Th sub="Calculated">Paid Hours</Th>
              <Th sub="Total">Unpaid Hours</Th>
              <Th sub="Total">Worked</Th>
              <Th sub="Unpaid">Lunch</Th>
              <Th sub="Unpaid">Other</Th>
              <Th>Shifts</Th>
              <Th align="left">Flags</Th>
              <th className="px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && !summary ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : summary && summary.data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No employees match this view.
                </td>
              </tr>
            ) : (
              summary?.data.map((r) => (
                <tr
                  key={r.employee.id}
                  onClick={() => onDrillDown(r.employee.id, summary.period.from, summary.period.to)}
                  className="hover:bg-blue-50/50 cursor-pointer"
                  title="Open this employee's Time Review for the period"
                >
                  <td className="px-4 py-2 font-medium text-gray-900">{r.employee.full_name}</td>
                  {/* Paid — the primary pay number. */}
                  <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700">
                    {formatDuration(r.paid_seconds)}
                    {r.has_open_shift && (
                      <span
                        className="ml-1 text-amber-500 font-sans"
                        title="Includes an open shift — not final until clock-out"
                      >
                        *
                      </span>
                    )}
                  </td>
                  {/* Unpaid — attention treatment. */}
                  <td className="px-4 py-2 text-right font-mono text-orange-600">
                    {formatDuration(r.unpaid_seconds)}
                  </td>
                  {/* Worked (gross elapsed) — neutral. */}
                  <td className="px-4 py-2 text-right font-mono text-gray-500">{formatDuration(r.gross_seconds)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">{formatDuration(r.lunch_seconds)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">
                    {formatDuration(r.other_break_seconds)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.shift_count}</td>
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
