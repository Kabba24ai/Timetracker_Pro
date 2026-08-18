import React, { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import {
  EmployeeBalances,
  OverlapException,
  TimeOffRequest,
  TimeOffStatus,
  TimeOffType,
  TIME_OFF_STATUS_STYLE,
  VacationAccrualRow,
  adminApprove,
  adminBalances,
  adminDeny,
  adminGrant,
  adminListRequests,
  fetchOverlapExceptions,
  fetchTimeOffTypes,
  fetchVacationAccrual,
  resolveOverlap,
  runVacationAccrual,
  setVacationEntitlement,
} from '../../lib/timeOff';

type Tab = 'requests' | 'balances' | 'accrual' | 'overlaps';

/**
 * Admin time-off management on the real V2 API: approve/deny requests, view and
 * grant balances, and resolve worked-during-approved overlap exceptions.
 */
const VacationManagement: React.FC = () => {
  const [tab, setTab] = useState<Tab>('requests');
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<TimeOffStatus | 'all'>('pending');
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [balances, setBalances] = useState<EmployeeBalances[]>([]);
  const [overlaps, setOverlaps] = useState<OverlapException[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);

  const [grant, setGrant] = useState({ employee_id: '', bucket: '', hours: '' });
  const [busy, setBusy] = useState(false);

  const [accrualRows, setAccrualRows] = useState<VacationAccrualRow[]>([]);
  const [companyDefault, setCompanyDefault] = useState(0);
  const [accrualEnabled, setAccrualEnabled] = useState(true);
  const [overrideEdit, setOverrideEdit] = useState<Record<number, string>>({});

  const loadAccrual = async () => {
    try {
      const res = await fetchVacationAccrual();
      setAccrualRows(res.data);
      setCompanyDefault(res.company_default_hours);
      setAccrualEnabled(res.accrual_enabled);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Could not load accrual.');
    }
  };

  const loadRequests = async () => {
    try {
      setRequests(await adminListRequests(statusFilter === 'all' ? {} : { status: statusFilter }));
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Could not load requests.');
    }
  };

  const loadBalances = async () => {
    try {
      setBalances(await adminBalances());
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Could not load balances.');
    }
  };

  const loadOverlaps = async () => {
    try {
      setOverlaps(await fetchOverlapExceptions('open'));
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Could not load overlaps.');
    }
  };

  useEffect(() => {
    void fetchTimeOffTypes().then((t) => {
      setTypes(t);
      const first = t.find((x) => x.is_balance_tracked);
      if (first) setGrant((g) => ({ ...g, bucket: first.balance_bucket ?? first.code }));
    });
  }, []);

  useEffect(() => {
    setError(null);
    if (tab === 'requests') void loadRequests();
    if (tab === 'balances') void loadBalances();
    if (tab === 'accrual') void loadAccrual();
    if (tab === 'overlaps') void loadOverlaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  const act = async (fn: () => Promise<unknown>, reload: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    await act(
      () => adminGrant({ employee_id: Number(grant.employee_id), bucket: grant.bucket, hours: Number(grant.hours), reason: 'Admin grant' }),
      loadBalances,
    );
    setGrant((g) => ({ ...g, employee_id: '', hours: '' }));
  };

  const balanceBuckets = types.filter((t) => t.is_balance_tracked);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        {(['requests', 'balances', 'accrual', 'overlaps'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            {t}
            {t === 'overlaps' && overlaps.length > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs text-red-700">{overlaps.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === 'requests' && (
        <div className="space-y-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TimeOffStatus | 'all')}
            className="rounded-lg border-gray-300 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>

          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">No requests.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Dates</th>
                  <th className="p-2">Hours</th>
                  <th className="p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-2">{r.employee_name}</td>
                    <td className="p-2">{r.type.label}</td>
                    <td className="p-2">
                      {r.start_date}
                      {r.end_date !== r.start_date ? ` – ${r.end_date}` : ''}
                    </td>
                    <td className="p-2">{r.approved_hours ?? r.requested_hours}h</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${TIME_OFF_STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="p-2 text-right">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={busy}
                            onClick={() => act(() => adminApprove(r.id), loadRequests)}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => act(() => adminDeny(r.id, 'Denied'), loadRequests)}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'balances' && (
        <div className="space-y-4">
          <form onSubmit={submitGrant} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-700">Employee ID</span>
              <input value={grant.employee_id} onChange={(e) => setGrant({ ...grant, employee_id: e.target.value })} type="number" className="w-28 rounded border-gray-300" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-700">Bucket</span>
              <select value={grant.bucket} onChange={(e) => setGrant({ ...grant, bucket: e.target.value })} className="rounded border-gray-300">
                {balanceBuckets.map((t) => (
                  <option key={t.code} value={t.balance_bucket ?? t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-700">Hours</span>
              <input value={grant.hours} onChange={(e) => setGrant({ ...grant, hours: e.target.value })} type="number" step="0.25" min="0.25" className="w-24 rounded border-gray-300" required />
            </label>
            <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Grant
            </button>
          </form>

          {balances.length === 0 ? (
            <p className="text-sm text-gray-500">No balances yet. Grant hours above to get started.</p>
          ) : (
            <div className="space-y-3">
              {balances.map((row) => (
                <div key={row.employee.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 font-medium text-gray-900">{row.employee.name}</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {row.balances.map((b) => (
                      <div key={b.bucket} className="text-sm">
                        <span className="text-gray-500">{b.type_label}: </span>
                        <span className="font-semibold">{b.available}h</span>
                        <span className="text-xs text-gray-400"> ({b.used}h used)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'accrual' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              Company default: <span className="font-semibold">{companyDefault}h/yr</span> ·{' '}
              {accrualEnabled ? 'Accrual on' : <span className="text-amber-700">Accrual off</span>}
            </p>
            <button
              disabled={busy || !accrualEnabled}
              onClick={() => act(async () => { const r = await runVacationAccrual(); setError(`Accrual run: ${r.records_written} record(s) written.`); }, loadAccrual)}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Run Accrual (previous period)
            </button>
          </div>

          {accrualRows.length === 0 ? (
            <p className="text-sm text-gray-500">No active employees.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Balance</th>
                  <th className="p-2">Annual Entitlement</th>
                  <th className="p-2">Earned This Year</th>
                  <th className="p-2">Eligibility</th>
                  <th className="p-2">Rate/hr</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {accrualRows.map((row) => (
                  <tr key={row.employee.id} className="border-t border-gray-100">
                    <td className="p-2">{row.employee.name}</td>
                    <td className="p-2 font-semibold">{row.available.toFixed(2)}h</td>
                    <td className="p-2">
                      {row.annual_entitlement_hours}h{' '}
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${row.using_override ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                        {row.using_override ? 'Override' : 'Company default'}
                      </span>
                    </td>
                    <td className="p-2 text-gray-600">
                      {row.accrued_this_year.toFixed(2)}h
                      <span className="text-xs text-gray-400"> ({row.annual_remaining_capacity.toFixed(2)} left)</span>
                    </td>
                    <td className="p-2 text-gray-600">
                      {row.eligibility_date ?? '—'}
                      {row.eligibility_date && !row.is_eligible ? <span className="ml-1 text-xs text-amber-700">(pending)</span> : ''}
                    </td>
                    <td className="p-2 text-gray-600">{row.effective_rate.toFixed(6)}</td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          placeholder={String(companyDefault)}
                          value={overrideEdit[row.employee.id] ?? (row.override_hours ?? '')}
                          onChange={(e) => setOverrideEdit((o) => ({ ...o, [row.employee.id]: e.target.value }))}
                          aria-label={`Override hours for ${row.employee.name}`}
                          className="w-20 rounded border-gray-300 text-sm"
                        />
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              const raw = overrideEdit[row.employee.id];
                              const val = raw === undefined ? row.override_hours : raw.trim() === '' ? null : Number(raw);
                              await setVacationEntitlement(row.employee.id, val ?? null);
                            }, loadAccrual)
                          }
                          className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-800"
                        >
                          Set
                        </button>
                        {row.using_override && (
                          <button
                            disabled={busy}
                            onClick={() => act(() => setVacationEntitlement(row.employee.id, null), loadAccrual)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'overlaps' && (
        <div className="space-y-3">
          {overlaps.length === 0 ? (
            <p className="text-sm text-gray-500">No open overlap exceptions.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {overlaps.map((o) => (
                <li key={o.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {o.employee.name} worked on {o.date}
                    </div>
                    <div className="text-xs text-gray-500">
                      {o.pto_hours}h {o.type} approved · {o.worked_hours}h worked
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => act(() => resolveOverlap(o.id, 'kept_pto'), loadOverlaps)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      Keep PTO
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => act(() => resolveOverlap(o.id, 'cancelled_pto'), loadOverlaps)}
                      className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                    >
                      Cancel PTO
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default VacationManagement;
