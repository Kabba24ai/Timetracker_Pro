import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, X } from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  EMPLOYEE_REQUEST_TYPES,
  EMPLOYEE_TYPE_LABEL,
  TIME_OFF_STATUS_STYLE,
  TimeOffRequest,
  VacationStatus,
  cancelMyRequest,
  fetchMyRequests,
  fetchMyVacationStatus,
  submitTimeOffRequest,
} from '../lib/timeOff';
import DatePicker from './DatePicker';

/**
 * Employee Vacation self-service. Concise by design: the accrued Vacation
 * balance (from the canonical ledger — never computed here), one Request Time
 * Off action, and a compact request history that is hidden entirely when empty.
 * Exactly two request types are exposed: Vacation and Unpaid Time Off.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${new Date().getFullYear() === y ? '' : `, ${y}`}`;
};

const fmtRange = (start: string, end: string): string => {
  if (start === end) return fmtDay(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth ? `${fmtDay(start)}–${Number(end.slice(8, 10))}` : `${fmtDay(start)} – ${fmtDay(end)}`;
};

const VacationSummary: React.FC = () => {
  const [status, setStatus] = useState<VacationStatus | null>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [typeCode, setTypeCode] = useState<string>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([fetchMyVacationStatus(), fetchMyRequests()]);
      setStatus(s);
      setRequests(r);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await submitTimeOffRequest({ type_code: typeCode, start_date: startDate, end_date: endDate || startDate, notes: notes || undefined });
      setShowForm(false);
      setStartDate('');
      setEndDate('');
      setNotes('');
      setTypeCode('vacation');
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
  const canCancel = (r: TimeOffRequest) => r.status === 'pending' || (r.status === 'approved' && r.start_date > today);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading time off…</div>;
  }

  const notEligible = status && status.accrual_enabled && !status.is_eligible && status.eligibility_date;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Vacation summary */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <CalendarClock className="h-4 w-4 text-blue-600" /> Vacation
            </h3>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {(status?.available ?? 0).toFixed(2)} <span className="text-base font-medium text-gray-500">hours</span>
            </div>
            {notEligible && (
              <div className="mt-1 text-xs text-gray-500">Accrual begins {fmtDay(status!.eligibility_date as string)}</div>
            )}
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Request Time Off
          </button>
        </div>
      </div>

      {/* Request form */}
      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {formError && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{formError}</div>}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Type</span>
            <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} aria-label="Type" className="w-full rounded-lg border-gray-300">
              {EMPLOYEE_REQUEST_TYPES.map((code) => (
                <option key={code} value={code}>
                  {EMPLOYEE_TYPE_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Start Date</span>
              <DatePicker value={startDate} onChange={setStartDate} min={today} label="Start Date" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">End Date</span>
              <DatePicker value={endDate} onChange={setEndDate} min={startDate || today} label="End Date" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border-gray-300" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !startDate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Request history — rendered only when requests exist. */}
      {requests.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between p-3 text-sm">
              <span className="text-gray-800">
                {r.type.label} · {fmtRange(r.start_date, r.end_date)}
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${TIME_OFF_STATUS_STYLE[r.status]}`}>{r.status}</span>
                {canCancel(r) && (
                  <button onClick={() => cancel(r)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Cancel request">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default VacationSummary;
