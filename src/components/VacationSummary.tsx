import React, { useEffect, useState } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  TimeOffBalance,
  TimeOffRequest,
  TimeOffType,
  TIME_OFF_STATUS_STYLE,
  cancelMyRequest,
  fetchMyBalance,
  fetchMyRequests,
  fetchTimeOffTypes,
  submitTimeOffRequest,
} from '../lib/timeOff';

/**
 * Employee time-off (PTO) self-service on the real V2 API: balances per bucket,
 * a request form (with optional single-day partial hours), and the employee's
 * own requests with self-cancel where allowed.
 */
const VacationSummary: React.FC = () => {
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [balances, setBalances] = useState<TimeOffBalance[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [typeCode, setTypeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partial, setPartial] = useState(false);
  const [partialHours, setPartialHours] = useState('4');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, b, r] = await Promise.all([fetchTimeOffTypes(), fetchMyBalance(), fetchMyRequests()]);
      setTypes(t);
      setBalances(b);
      setRequests(r);
      if (t.length && !typeCode) setTypeCode(t[0].code);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'Could not load your time off.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const singleDay = Boolean(startDate) && startDate === endDate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const days = partial && singleDay ? { [startDate]: Number(partialHours) } : undefined;
      await submitTimeOffRequest({ type_code: typeCode, start_date: startDate, end_date: endDate, days, notes: notes || undefined });
      setShowForm(false);
      setStartDate('');
      setEndDate('');
      setNotes('');
      setPartial(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.firstError() : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (r: TimeOffRequest) => {
    try {
      await cancelMyRequest(r.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not cancel the request.');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const canCancel = (r: TimeOffRequest) =>
    r.status === 'pending' || (r.status === 'approved' && r.start_date > today);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading time off…</div>;
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Balances */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Calendar className="h-5 w-5 text-blue-600" /> Time Off
          </h3>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Request Time Off
          </button>
        </div>

        {balances.length === 0 ? (
          <p className="text-sm text-gray-500">No balance-tracked time off is set up yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {balances.map((b) => (
              <div key={b.bucket} className="rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-500">{b.type_label}</div>
                <div className="text-2xl font-bold text-gray-900">{b.available}h</div>
                <div className="mt-1 text-xs text-gray-500">
                  {b.reserved}h reserved · {b.used}h used
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request form */}
      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {formError && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Type</span>
              <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} className="w-full rounded-lg border-gray-300">
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                    {t.is_paid ? '' : ' (unpaid)'}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Start</span>
                <input type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border-gray-300" required />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">End</span>
                <input type="date" value={endDate} min={startDate || today} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border-gray-300" required />
              </label>
            </div>
          </div>

          {singleDay && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
              Partial day
              {partial && (
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={partialHours}
                  onChange={(e) => setPartialHours(e.target.value)}
                  className="ml-2 w-20 rounded border-gray-300"
                  aria-label="Partial hours"
                />
              )}
              {partial && <span>hours</span>}
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border-gray-300" />
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* My requests */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">My Requests</h4>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-500">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {r.type.label} · {r.start_date}
                    {r.end_date !== r.start_date ? ` – ${r.end_date}` : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.approved_hours ?? r.requested_hours}h
                    {r.decision_reason ? ` · ${r.decision_reason}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${TIME_OFF_STATUS_STYLE[r.status]}`}>{r.status}</span>
                  {canCancel(r) && (
                    <button onClick={() => cancel(r)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Cancel request">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default VacationSummary;
