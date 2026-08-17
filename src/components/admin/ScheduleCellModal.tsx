import React, { useState } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { createSegment, deleteSegment, updateSegment } from '../../lib/schedule';
import { formatCalendarDate } from '../../lib/tz';
import TimeField, { Clock, parse24, to24 } from './TimeField';

// The employee, store, and date are already chosen by the clicked cell, so the
// editor edits only Start/End (time-only, reusing the shared TimeField). Store
// hours seed the defaults but are never a hard limit; overlap/validity is the
// server's call and its 422 is surfaced inline.
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
  onClose: () => void;
  onSaved: () => void;
}

const ScheduleCellModal: React.FC<Props> = ({ draft, onClose, onSaved }) => {
  const [start, setStart] = useState<Clock>(() => parse24(draft.start24));
  const [end, setEnd] = useState<Clock>(() => parse24(draft.end24));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    run(
      () =>
        draft.segmentId
          ? updateSegment(draft.segmentId, { start_time, end_time })
          : createSegment({ user_id: draft.userId, store_id: draft.storeId, date: draft.date, start_time, end_time }),
      setSaving,
    );
  };

  const remove = () => {
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
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Store</p>
            <p className={ro}>
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ backgroundColor: draft.storeColor }} />
              {draft.storeName}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Date</p>
            <p className={ro}>{formatCalendarDate(draft.date)}</p>
          </div>
        </div>

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

        <div className="flex items-center justify-between gap-2">
          <div>
            {draft.segmentId && (
              <button type="button" onClick={remove} disabled={removing || saving} className="flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> {removing ? 'Removing…' : 'Remove schedule'}
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
