import React, { useState } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import type { LeaveType } from '../../lib/admin';
import { formatCalendarDate } from '../../lib/tz';

// ONE focused editor for manual paid leave on a Time Review day, reused for both
// types. Holiday: 0 < hours ≤ 8.00. Vacation: additionally ≤ the employee's
// canonical available balance (shown from the authoritative API). Client checks
// are supplemental — the server enforces every rule and its message is shown
// verbatim. Leave is NOT a punch: nothing here creates Clock In / Clock Out.

export const MAX_LEAVE_HOURS = 8;
export const DEFAULT_LEAVE_HOURS = 8;

const LABEL: Record<LeaveType, string> = { holiday: 'Holiday', vacation: 'Vacation' };

interface Props {
  type: LeaveType;
  employeeName: string;
  /** Tenant calendar date (YYYY-MM-DD) of the Time Review row. */
  date: string;
  /** Editing an existing entry (its hours are preloaded and Delete is offered). */
  existing?: { id: number; hours: number } | null;
  /** Vacation only: canonical available balance in hours; null/undefined while loading. */
  availableBalance?: number | null;
  onClose: () => void;
  onSubmit: (hours: number) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const LeaveHoursModal: React.FC<Props> = ({ type, employeeName, date, existing, availableBalance, onClose, onSubmit, onDelete }) => {
  const [text, setText] = useState<string>((existing?.hours ?? DEFAULT_LEAVE_HOURS).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const label = LABEL[type];
  const hours = Number.parseFloat(text);
  const isVacation = type === 'vacation';
  // While editing, the entry's current hours are already consumed, so the amount
  // that can be re-applied is available + existing (the server computes it the
  // same way: reverse, then re-apply under the balance guard).
  const effectiveAvailable =
    isVacation && availableBalance != null ? Number(availableBalance) + (existing?.hours ?? 0) : null;

  let validation: string | null = null;
  if (!Number.isFinite(hours) || hours <= 0) {
    validation = 'Enter hours greater than zero.';
  } else if (hours > MAX_LEAVE_HOURS) {
    validation = `${label} hours cannot exceed ${MAX_LEAVE_HOURS.toFixed(2)} per day.`;
  } else if (effectiveAvailable != null && hours > effectiveAvailable + 1e-9) {
    validation = `This amount exceeds the available vacation balance (${Number(availableBalance).toFixed(2)} hours).`;
  }
  const canApply = validation === null && !saving && (isVacation ? availableBalance != null : true);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canApply) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(Math.round(hours * 100) / 100);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : `The ${label.toLowerCase()} hours could not be saved.`);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!onDelete || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : `The ${label.toLowerCase()} entry could not be deleted.`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-hours-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="leave-hours-title" className="text-lg font-semibold text-gray-900">
            {label} Hours
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-xs font-medium text-gray-600 self-center">Employee</dt>
          <dd className="font-medium text-gray-900">{employeeName}</dd>
          <dt className="text-xs font-medium text-gray-600 self-center">Date</dt>
          <dd className="font-medium text-gray-900">{formatCalendarDate(date)}</dd>
        </dl>

        {isVacation && (
          <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            {availableBalance != null ? `Available Vacation: ${Number(availableBalance).toFixed(2)} hours` : 'Available Vacation: loading…'}
          </p>
        )}

        <div className="mb-2">
          <label htmlFor="leave-hours" className="block text-xs font-medium text-gray-600 mb-1">
            Hours
          </label>
          <input
            id="leave-hours"
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            max={MAX_LEAVE_HOURS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">
            Paid at regular rate. Not worked time — never counts toward overtime. Maximum {MAX_LEAVE_HOURS.toFixed(2)} per day.
          </p>
        </div>

        {validation && <p className="mb-3 text-sm text-red-600">{validation}</p>}

        {confirmingDelete && (
          <div className="mb-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span className="text-sm">
              Delete this {label.toLowerCase()} entry? {isVacation ? 'The hours return to the employee’s available vacation balance.' : 'The holiday hours are removed from payroll.'}
            </span>
          </div>
        )}

        {confirmingDelete ? (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              Keep
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {saving ? 'Deleting…' : 'Confirm Delete'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {existing && onDelete && (
              <button
                type="button"
                onClick={() => { setError(null); setConfirmingDelete(true); }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                Delete {label}
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ml-auto">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canApply}
              className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Applying…' : 'Apply'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default LeaveHoursModal;
