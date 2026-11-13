import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
  formatTimeOffRange,
  submitTimeOffRequest,
} from '../lib/timeOff';
import { tenantToday } from '../lib/tz';
import DatePicker from './DatePicker';
import { VacationBalance } from './VacationSummary';

/**
 * Employee Time Off self-service (the /time-off page): the Vacation balance,
 * the Request Time Off form, and the employee's requests with their statuses
 * and cancellation. The server is authoritative for allocation, balances and
 * lifecycle rules. Exactly two request types are exposed: Vacation and Unpaid
 * Time Off.
 */
const TimeOffManager: React.FC = () => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';
  const [status, setStatus] = useState<VacationStatus | null>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeCode, setTypeCode] = useState<string>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
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
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      await submitTimeOffRequest({ type_code: typeCode, start_date: startDate, end_date: endDate || startDate, notes: notes || undefined });
      setStartDate('');
      setEndDate('');
      setNotes('');
      setTypeCode('vacation');
      setNotice('Time off request submitted.');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.firstError() : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (r: TimeOffRequest) => {
    setNotice(null);
    try {
      await cancelMyRequest(r.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not cancel the request.');
    }
  };

  // The tenant's calendar date — the same "today" the server uses to decide
  // whether approved time off has started (never the UTC or device date).
  const today = tenantToday(tz);
  const canCancel = (r: TimeOffRequest) => r.status === 'pending' || (r.status === 'approved' && r.start_date > today);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading time off…</div>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && (
        <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <VacationBalance status={status} />

          {/* Request form */}
          <form onSubmit={submit} aria-labelledby="request-time-off-heading" className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h2 id="request-time-off-heading" className="text-sm font-semibold text-gray-700">
              Request Time Off
            </h2>
            {formError && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{formError}</div>}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Type</span>
              <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} aria-label="Type" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <button type="submit" disabled={submitting || !startDate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* Request history and cancellation */}
        <section aria-labelledby="my-requests-heading" className="rounded-lg border border-gray-200">
          <h2 id="my-requests-heading" className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-700">
            My Requests
          </h2>
          {requests.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">You have no time off requests.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-gray-800">
                    {r.type.label} · {formatTimeOffRange(r.start_date, r.end_date)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${TIME_OFF_STATUS_STYLE[r.status]}`}>{r.status}</span>
                    {canCancel(r) && (
                      <button onClick={() => cancel(r)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Cancel request" title="Cancel request">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default TimeOffManager;
