import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  PayrollProjection,
  ProjectionFigures,
  ProjectionStatus,
  fetchPayrollProjection,
  formatProjectedHours,
} from '../../lib/payrollProjection';

// Calculate Payroll — a compact, read-only forecast of the schedule being viewed.
//
// Every figure comes from the server (scheduled hours × the pay rate in effect
// on each date, overtime per fixed workweek, configured unpaid lunch removed).
// The modal re-reads the SAVED schedule each time it calculates: there is no
// client-side draft state on the schedule grid, so what it prices is exactly
// what the server has stored. Nothing here can change a schedule, a punch, a
// rate or a payroll record.

export interface ProjectionScope {
  from: string; // YYYY-MM-DD tenant calendar — the range the grid shows
  to: string;
  label: string; // the grid's own range label
  /** Employee View: only this employee. Store View: everyone scheduled. */
  userId?: number | null;
  employeeName?: string;
}

interface Props {
  scope: ProjectionScope;
  onClose: () => void;
}

const STATUS_LABEL: Record<ProjectionStatus, string> = {
  calculated: 'Calculated',
  not_set: 'No pay rate',
  not_classified: 'Overtime not classified',
  salary: 'Salary — not calculated',
  incomplete: 'Incomplete',
};

const StatusBadge: React.FC<{ status: ProjectionStatus; label?: string; notes?: string[] }> = ({ status, label, notes }) => {
  if (status === 'calculated') return null;
  const tone = status === 'salary' ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-amber-50 text-amber-800 border-amber-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${tone}`} title={notes?.join(' ') || undefined}>
      {label ?? STATUS_LABEL[status]}
    </span>
  );
};

const Tile: React.FC<{ label: string; value: string; emphasis?: boolean; children?: React.ReactNode }> = ({ label, value, emphasis, children }) => (
  <div className={`rounded-lg p-3 border ${emphasis ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`font-mono ${emphasis ? 'text-xl font-semibold text-blue-900' : 'text-lg font-medium text-gray-900'}`}>{value}</p>
    {children}
  </div>
);

const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-2 py-1.5 font-medium whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);

const Num: React.FC<{ children: React.ReactNode }> = ({ children }) => <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{children}</td>;

const FigureCells: React.FC<{ f: ProjectionFigures }> = ({ f }) => (
  <>
    <Num>{formatProjectedHours(f.scheduled_seconds)}</Num>
    <Num>{f.unpaid_lunch_seconds > 0 ? formatProjectedHours(f.unpaid_lunch_seconds) : '—'}</Num>
    <Num>{formatProjectedHours(f.regular_seconds)}</Num>
    <Num>{f.overtime_seconds > 0 ? formatProjectedHours(f.overtime_seconds) : '—'}</Num>
    {/* The server formats every wage figure and sends "—" where nothing could be priced. */}
    <Num>{f.regular_display}</Num>
    <Num>{f.overtime_seconds > 0 ? f.overtime_display : '—'}</Num>
    <Num>
      <span className="font-semibold">{f.total_display}</span>
    </Num>
  </>
);

const PayrollProjectionModal: React.FC<Props> = ({ scope, onClose }) => {
  const [data, setData] = useState<PayrollProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPayrollProjection({ from: scope.from, to: scope.to, user_id: scope.userId ?? null }));
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The payroll projection could not be calculated.');
    } finally {
      setLoading(false);
    }
  }, [scope.from, scope.to, scope.userId]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const s = data?.summary;
  const cov = data?.coverage;
  const problems: string[] = [];
  if (cov) {
    if (cov.not_set > 0) problems.push(`${cov.not_set} employee${cov.not_set === 1 ? ' has' : 's have'} no pay rate — their wages are not included.`);
    if (cov.not_classified > 0) problems.push(`${cov.not_classified} employee${cov.not_classified === 1 ? '' : 's'} with scheduled overtime ${cov.not_classified === 1 ? 'has' : 'have'} no overtime pay rule yet — that overtime is not priced.`);
    if (cov.salary > 0) problems.push(`${cov.salary} salaried employee${cov.salary === 1 ? '' : 's'} — scheduled hours shown, salary cost not calculated.`);
    if (cov.incomplete > 0) problems.push(`${cov.incomplete} employee${cov.incomplete === 1 ? '' : 's'} partly priced.`);
  }
  const incomplete = s ? s.status !== 'calculated' : false;
  const weeks = data?.workweeks ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-projection-title"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b">
          <div>
            <h3 id="payroll-projection-title" className="text-lg font-semibold text-gray-900">
              Projected Gross Wages — Based on Scheduled Hours
            </h3>
            <p className="text-sm text-gray-500">
              {scope.label}
              {scope.employeeName ? ` · ${scope.employeeName}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-auto">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="note">
            A forecast from the <span className="font-medium">saved</span> schedule — not a payroll obligation or wages earned. Actual payroll cost
            comes from recorded time (Kabba → Reports → Operation → Payroll). Recalculate after changing the schedule.
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
              <button type="button" onClick={calculate} className="text-sm font-medium underline">
                Retry
              </button>
            </div>
          )}

          {loading && !data && <p className="text-sm text-gray-500 py-6 text-center">Calculating…</p>}

          {data && s && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" data-testid="projection-summary">
                <Tile label="Scheduled Hours" value={formatProjectedHours(s.scheduled_seconds)} />
                <Tile label="Unpaid Lunch" value={s.unpaid_lunch_seconds > 0 ? `−${formatProjectedHours(s.unpaid_lunch_seconds)}` : 'None configured'} />
                <Tile label="Est. Regular Hours" value={formatProjectedHours(s.regular_seconds)} />
                <Tile label="Est. Overtime Hours" value={formatProjectedHours(s.overtime_seconds)} />
                <Tile label="Est. Regular Wages" value={s.regular_display} />
                <Tile label="Est. Overtime Wages" value={s.overtime_display} />
                <div className="col-span-2">
                  <Tile label="Total Projected Gross Wages" value={s.total_display} emphasis>
                    {incomplete && (
                      <div className="mt-1" data-testid="projection-incomplete">
                        <StatusBadge status={s.status === 'calculated' ? 'incomplete' : s.status} label={s.status === 'incomplete' ? 'Incomplete — not all wages included' : s.status_label} />
                      </div>
                    )}
                  </Tile>
                </div>
              </div>

              {(problems.length > 0 || data.notices.length > 0) && (
                <ul className="mb-4 list-disc pl-5 space-y-0.5 text-sm text-amber-800" data-testid="projection-problems">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {data.notices.map((n) => (
                    <li key={n.code}>{n.message}</li>
                  ))}
                </ul>
              )}

              <p className="mb-4 text-xs text-gray-500">
                Overtime is estimated per fixed workweek (over 40 scheduled paid hours, ×{data.overtime_multiplier})
                {weeks.length > 0 && ` using the complete workweek${weeks.length === 1 ? '' : 's'} ${weeks[0].start} – ${weeks[weeks.length - 1].end}`}, so hours
                scheduled just outside this range still count toward the threshold. Rates are the ones in effect on each scheduled date. Pay types and rates are
                never shown here.
              </p>

              {data.stores.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">By Store</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm" data-testid="projection-stores">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <Th>Store</Th>
                          <Th right>People</Th>
                          <Th right>Scheduled</Th>
                          <Th right>Lunch</Th>
                          <Th right>Regular</Th>
                          <Th right>Overtime</Th>
                          <Th right>Reg. Wages</Th>
                          <Th right>OT Wages</Th>
                          <Th right>Projected</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.stores.map((row) => (
                          <tr key={row.store_id ?? 'u'}>
                            <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{row.store_name}</td>
                            <Num>{row.employees}</Num>
                            <FigureCells f={row} />
                            <td className="px-2 py-1.5">
                              <StatusBadge status={row.status} notes={row.notes} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-1">By Employee</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm" data-testid="projection-employees">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <Th>Employee</Th>
                        <Th>Store</Th>
                        <Th right>Scheduled</Th>
                        <Th right>Lunch</Th>
                        <Th right>Regular</Th>
                        <Th right>Overtime</Th>
                        <Th right>Reg. Wages</Th>
                        <Th right>OT Wages</Th>
                        <Th right>Projected</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.employees.map((row) => (
                        <tr key={`${row.employee_id}-${row.store_id ?? 'u'}`} data-employee-id={row.employee_id}>
                          <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{row.employee}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-gray-600">{row.store_name}</td>
                          <FigureCells f={row} />
                          <td className="px-2 py-1.5">
                            <StatusBadge status={row.status} notes={row.notes} />
                          </td>
                        </tr>
                      ))}
                      {data.employees.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-3 py-5 text-center text-gray-400">
                            No one is scheduled in this range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t">
          <button
            type="button"
            onClick={calculate}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Read the saved schedule again and recalculate"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 text-sm transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollProjectionModal;
