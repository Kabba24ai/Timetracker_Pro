import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Plus } from 'lucide-react';
import { ApiError } from '../lib/api';
import { VacationStatus, fetchMyVacationStatus, formatTimeOffDay } from '../lib/timeOff';

/**
 * The accrued Vacation balance (from the canonical ledger — never computed
 * here) and, when accrual has not started yet, when it begins. Shared by the
 * dashboard card and the Time Off page; `action` sits to the right.
 */
export const VacationBalance: React.FC<{
  status: VacationStatus | null;
  loading?: boolean;
  error?: string | null;
  action?: React.ReactNode;
}> = ({ status, loading = false, error = null, action }) => {
  const notEligible = status && status.accrual_enabled && !status.is_eligible && status.eligibility_date;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CalendarClock className="h-4 w-4 text-blue-600" /> Vacation
          </h3>
          {loading ? (
            <div className="mt-1 text-sm text-gray-500">Loading balance…</div>
          ) : error ? (
            <div className="mt-1 text-sm text-red-700">{error}</div>
          ) : (
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {(status?.available ?? 0).toFixed(2)} <span className="text-base font-medium text-gray-500">hours</span>
            </div>
          )}
          {notEligible && (
            <div className="mt-1 text-xs text-gray-500">Accrual begins {formatTimeOffDay(status!.eligibility_date as string)}</div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
};

/**
 * Employee dashboard Vacation card. Compact by design: the balance, its
 * eligibility note and one Request Time Off action, which opens the Time Off
 * page (request form, request history and cancellation). No request history
 * here, and no requests are fetched.
 */
const VacationSummary: React.FC = () => {
  const [status, setStatus] = useState<VacationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyVacationStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? e.firstError() : 'Could not load your vacation balance.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <VacationBalance
      status={status}
      loading={loading}
      error={error}
      action={
        <Link
          to="/time-off"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Request Time Off
        </Link>
      }
    />
  );
};

export default VacationSummary;
