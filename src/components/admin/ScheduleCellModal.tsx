import React, { useState } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  DAY_STATUS_OPTIONS,
  DayStatusCell,
  DayStatusSelection,
  StoreMeta,
  clearDayStatus,
  createSegment,
  dayStatusLabel,
  deleteSegment,
  isFullDayStatus,
  setDayStatus,
  updateSegment,
} from '../../lib/schedule';
import { formatShortCalendarDate } from '../../lib/tz';
import TimeField, { Clock, parse24, to24 } from './TimeField';

// The employee and date are fixed by the clicked cell; the editor edits Start/End
// (time-only, reusing the shared TimeField) AND the Store. Changing the Store
// moves this one dated segment to the destination store — one atomic server
// update (never delete-then-add). Store hours seed the defaults but are never a
// hard limit; overlap/validity is the server's call and its 422 is surfaced
// inline, leaving the original segment untouched.
export interface CellDraft {
  userId: number;
  employeeName: string;
  storeId: number;
  storeName: string;
  storeColor: string;
  date: string; // YYYY-MM-DD
  segmentId: number | null; // existing dated segment → edit/remove; null → create
  start24: string; // seeded 'HH:MM'
  end24: string;
}

interface Props {
  draft: CellDraft;
  stores: StoreMeta[]; // active stores for the destination dropdown (canonical grid source)
  /**
   * The employee's existing DISPLAY status for this date, when there is one.
   * Schedule-owned and display-only: it says what the manager expects, never
   * what anyone is paid.
   */
  dayStatus?: DayStatusCell | null;
  onClose: () => void;
  onSaved: () => void;
}

const ScheduleCellModal: React.FC<Props> = ({ draft, stores, dayStatus, onClose, onSaved }) => {
  const [start, setStart] = useState<Clock>(() => parse24(draft.start24));
  const [end, setEnd] = useState<Clock>(() => parse24(draft.end24));
  const [storeId, setStoreId] = useState<number>(draft.storeId);
  // 'working' = no status row; the normal dated segment speaks for itself. Admin
  // payloads carry a real editable code; anything else (e.g. the employee-facing
  // privacy projection) is not an admin choice, so it falls back to Working.
  const [status, setStatus] = useState<DayStatusSelection>(() =>
    DAY_STATUS_OPTIONS.some((o) => o.value === dayStatus?.status) ? (dayStatus?.status as DayStatusSelection) : 'working',
  );
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The dropdown always includes the segment's current store (even if the list
  // is briefly empty), with the destination color reflecting the selection.
  const options = stores.length ? stores : [{ id: draft.storeId, name: draft.storeName, color: draft.storeColor } as StoreMeta];
  const storeColor = options.find((s) => s.id === storeId)?.color ?? draft.storeColor;

  const fullDay = isFullDayStatus(status);
  const statusLabel = dayStatusLabel(status);
  // Adding a Holiday marker on a blank cell: only send hours if the admin is
  // actually scheduling work alongside it (the segment already exists, or they
  // changed the seeded default). Keeps "just mark the holiday" a single write.
  const hasHolidayHours = to24(start) !== draft.start24 || to24(end) !== draft.end24;

  const run = async (fn: () => Promise<void>, setBusy: (b: boolean) => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The schedule change could not be saved.');
      setBusy(false);
    }
  };

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    const start_time = to24(start);
    const end_time = to24(end);
    const segment = () =>
      draft.segmentId
        ? updateSegment(draft.segmentId, { start_time, end_time, store_id: storeId })
        : createSegment({ user_id: draft.userId, store_id: storeId, date: draft.date, start_time, end_time });

    run(async () => {
      if (status === 'working') {
        // Leaving a status behind: clear it first, then write the work hours.
        if (dayStatus) {
          await clearDayStatus({ user_id: draft.userId, date: draft.date });
        }
        await segment();
        return;
      }

      // The SERVER owns the Working → absence transition: saving a full-day
      // status atomically removes this employee's work segments for the date.
      // Never delete-then-create from here.
      await setDayStatus({ user_id: draft.userId, date: draft.date, status });

      // Holiday coexists with work, so hours entered alongside it are kept.
      if (status === 'holiday' && (draft.segmentId || hasHolidayHours)) {
        await segment();
      }
    }, setSaving);
  };

  const remove = () => {
    // With a status selected, the destructive action is "remove the status" —
    // the date simply returns to blank/unscheduled, never to invented hours.
    if (dayStatus) {
      run(() => clearDayStatus({ user_id: draft.userId, date: draft.date }), setRemoving);

      return;
    }
    if (!draft.segmentId) return;
    run(() => deleteSegment(draft.segmentId as number), setRemoving);
  };

  const ro = 'text-sm font-medium text-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{draft.segmentId ? 'Edit schedule' : 'Add schedule'}</h3>
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

        {/* Read-only context. */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Employee</p>
            <p className={ro}>{draft.employeeName}</p>
          </div>
          <div className={fullDay ? 'hidden' : undefined}>
            <label htmlFor="segment-store" className="block text-xs text-gray-500 mb-0.5">Store</label>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: storeColor }} />
              <select
                id="segment-store"
                aria-label="Store"
                value={storeId}
                onChange={(e) => setStoreId(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {options.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Date</p>
            <p className={ro}>{formatShortCalendarDate(draft.date)}</p>
          </div>
        </div>

        {/* Day status — the scheduling manager's expectation for this date.
            Display only: it never pays anyone and never spends a balance. */}
        <div className="mb-5">
          <label htmlFor="day-status" className="block text-xs font-medium text-gray-600 mb-1">
            Day Status
          </label>
          <select
            id="day-status"
            aria-label="Day Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as DayStatusSelection)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DAY_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {fullDay ? (
          <div className="mb-5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-sm text-gray-700">{statusLabel} applies to the whole day, so there are no hours to set.</p>
            <p className="mt-1 text-xs text-gray-500">
              Scheduling only. This does not pay {statusLabel.toLowerCase()} hours or use a balance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
              <TimeField value={start} onChange={setStart} label="Start" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
              <TimeField value={end} onChange={setEnd} label="End" />
            </div>
          </div>
        )}

        {/* A full-day status owns the date: the server clears the work hours. */}
        {fullDay && (draft.segmentId !== null) && (
          <div className="mb-5 flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span className="text-sm">
              {`Saving ${statusLabel} will remove this employee's scheduled work hours for this date.`}
            </span>
          </div>
        )}

        {status === 'holiday' && (
          <p className="mb-5 text-xs text-gray-500">
            A Holiday marker leaves scheduled work in place — employees who work the holiday keep their hours.
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div>
            {(dayStatus || draft.segmentId) && (
              <button type="button" onClick={remove} disabled={removing || saving} className="flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50">
                <Trash2 className="h-4 w-4" />{' '}
                {removing ? 'Removing…' : dayStatus ? 'Remove status' : 'Remove schedule'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || removing} className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ScheduleCellModal;
