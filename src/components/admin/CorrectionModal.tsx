import React, { useState } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { BreakKind, CorrectableKind, CORRECTION_REASONS, CorrectionPayload } from '../../lib/admin';
import { formatCalendarDate, tenantWallClockToUtcIso } from '../../lib/tz';
import TimeField, { Clock, parse24, to24 } from './TimeField';

// The correction the admin is composing. The employee, day, and punch are
// already chosen on the grid, so the modal edits only TIME + reason — the date
// is contextual and read-only. Times arrive as 24h 'HH:MM' on `date`.
export type CorrectionDraft =
  | { mode: 'adjust'; eventId: number; kind: CorrectableKind; kindLabel: string; date: string; time24: string }
  | { mode: 'void'; eventId: number; kindLabel: string; date: string }
  | { mode: 'insert'; userId: number; kind: CorrectableKind; kindLabel: string; date: string; time24: string; title?: string }
  | { mode: 'insert_break'; userId: number; breakType: BreakKind; date: string; startTime24: string; endTime24: string; title?: string }
  // ONE atomic edit of an EXISTING lunch/break interval (Edit = both endpoints
  // exist; Complete = one side exists and the other is being repaired in). The
  // event ids identify the existing endpoints; the times are the FINAL interval.
  | { mode: 'edit_break'; breakType: BreakKind; startEventId?: number; endEventId?: number; date: string; startTime24: string; endTime24: string; title: string };

// A delete removes the punch AND its logical dependents from the effective
// record. The server owns the cascade; these labels/messages just tell the admin
// exactly what is about to disappear (the button text doubles as the scope).
type DeleteScope = { label: string; confirm: string };
function deleteScopeFor(kind: CorrectableKind): DeleteScope {
  switch (kind) {
    case 'clock_in':
      return {
        label: 'Delete Clock In',
        confirm: 'Delete this Clock In? This will remove the entire shift, including all Lunch, Break, and Clock Out entries associated with it.',
      };
    case 'clock_out':
      return { label: 'Delete Clock Out', confirm: 'Delete this Clock Out? The shift will remain without a Clock Out until corrected.' };
    case 'lunch_start':
    case 'lunch_end':
      return { label: 'Delete Lunch', confirm: "Delete this Lunch? Lunch Out and Lunch In will both be removed from the employee's effective time record." };
    case 'other_start':
    case 'other_end':
    default:
      return { label: 'Delete Break', confirm: 'Delete this Break? Break Out and Break In will both be removed.' };
  }
}

interface Props {
  draft: CorrectionDraft;
  /** Canonical tenant TimeTracker timezone — times are interpreted in it. */
  tz: string;
  onClose: () => void;
  onSubmit: (payload: CorrectionPayload) => Promise<void>;
}

const CorrectionModal: React.FC<Props> = ({ draft, tz, onClose, onSubmit }) => {
  const [time, setTime] = useState<Clock>(() =>
    draft.mode === 'adjust' || draft.mode === 'insert' ? parse24(draft.time24) : { h: 12, m: 0, ampm: 'PM' },
  );
  const [start, setStart] = useState<Clock>(() =>
    draft.mode === 'insert_break' || draft.mode === 'edit_break' ? parse24(draft.startTime24) : { h: 12, m: 0, ampm: 'PM' },
  );
  const [end, setEnd] = useState<Clock>(() =>
    draft.mode === 'insert_break' || draft.mode === 'edit_break' ? parse24(draft.endTime24) : { h: 12, m: 30, ampm: 'PM' },
  );

  const [reasonCode, setReasonCode] = useState('');
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deleting an existing punch is a two-step, in-modal destructive action: the
  // admin clicks "Delete …", then confirms the cascade before anything is sent.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Deleting from the interval modal always removes the WHOLE interval (the
  // approved rule) — regardless of which endpoint cell opened it.
  const del =
    draft.mode === 'adjust'
      ? deleteScopeFor(draft.kind)
      : draft.mode === 'edit_break'
        ? deleteScopeFor(draft.breakType === 'lunch' ? 'lunch_start' : 'other_start')
        : null;

  const isOther = reasonCode === 'other';
  // Reason is OPTIONAL (the established TimeTracker rule) — the only block is
  // choosing Other without an explanation.
  const reasonReady = !isOther || otherText.trim() !== '';

  const title =
    draft.mode === 'adjust'
      ? `Adjust ${draft.kindLabel}`
      : draft.mode === 'void'
        ? `Void ${draft.kindLabel}`
        : draft.mode === 'edit_break'
          ? draft.title
          : draft.mode === 'insert_break'
            ? (draft.title ?? (draft.breakType === 'lunch' ? 'Add lunch' : 'Add break'))
            : (draft.title ?? `Add ${draft.kindLabel}`);

  // Only send reason fields when a standardized reason is actually chosen.
  const buildReason = (): Pick<CorrectionPayload, 'reason_code' | 'reason'> => {
    if (reasonCode === '') return {};
    const label = CORRECTION_REASONS.find((r) => r.code === reasonCode)?.label ?? reasonCode;
    return { reason_code: reasonCode, reason: isOther ? otherText.trim() : label };
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!reasonReady || saving) return;
    setSaving(true);
    setError(null);

    const iso = (c: Clock) => tenantWallClockToUtcIso(`${draft.date}T${to24(c)}`, tz);
    const r = buildReason();

    let payload: CorrectionPayload;
    if (draft.mode === 'adjust') {
      payload = { type: 'adjust', event_id: draft.eventId, effective_at: iso(time), ...r };
    } else if (draft.mode === 'void') {
      payload = { type: 'void', event_id: draft.eventId, ...r };
    } else if (draft.mode === 'edit_break') {
      // The FINAL interval, atomically: the server adjusts a changed endpoint,
      // inserts a missing one, and leaves an unchanged one untouched.
      payload = {
        type: 'edit_break',
        break_type: draft.breakType,
        ...(draft.startEventId ? { start_event_id: draft.startEventId } : {}),
        ...(draft.endEventId ? { end_event_id: draft.endEventId } : {}),
        start_at: iso(start),
        end_at: iso(end),
        ...r,
      };
    } else if (draft.mode === 'insert_break') {
      payload = { type: 'insert_break', user_id: draft.userId, break_type: draft.breakType, start_at: iso(start), end_at: iso(end), ...r };
    } else {
      payload = { type: 'insert', user_id: draft.userId, kind: draft.kind, effective_at: iso(time), ...r };
    }

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The correction could not be applied.');
      setSaving(false);
    }
  };

  // Cascading delete of an existing punch. The server determines the dependent
  // set; the client only names the target event. From the interval modal either
  // existing endpoint identifies the interval — the server voids both sides.
  const submitDelete = async () => {
    const targetId =
      draft.mode === 'adjust' ? draft.eventId : draft.mode === 'edit_break' ? (draft.startEventId ?? draft.endEventId) : undefined;
    if (targetId === undefined || saving || !reasonReady) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ type: 'delete', event_id: targetId, ...buildReason() });
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The correction could not be applied.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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

        {/* Date — contextual, read-only (the row's calendar day). */}
        <div className="mb-4">
          <p className="block text-xs font-medium text-gray-600 mb-1">Date</p>
          <p className="text-sm font-medium text-gray-900">{formatCalendarDate(draft.date)}</p>
        </div>

        {/* Destructive confirmation — explains the exact cascade before anything is sent. */}
        {confirmingDelete && del && (
          <div className="mb-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span className="text-sm">{del.confirm}</span>
          </div>
        )}

        {confirmingDelete ? null : draft.mode === 'void' ? (
          <p className="text-sm text-gray-600 mb-4">
            This appends a void correction; the original event is preserved and the projection is rebuilt without it.
            The server rejects it if it would leave an impossible sequence.
          </p>
        ) : draft.mode === 'insert_break' || draft.mode === 'edit_break' ? (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {draft.breakType === 'lunch' ? 'Lunch Out' : 'Break Out'} <span className="text-gray-400">({tz})</span>
              </label>
              <TimeField value={start} onChange={setStart} autoFocus label={draft.breakType === 'lunch' ? 'Lunch Out' : 'Break Out'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {draft.breakType === 'lunch' ? 'Lunch In' : 'Break In'}
              </label>
              <TimeField value={end} onChange={setEnd} label={draft.breakType === 'lunch' ? 'Lunch In' : 'Break In'} />
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Time <span className="text-gray-400">({tz})</span>
            </label>
            <TimeField value={time} onChange={setTime} autoFocus />
          </div>
        )}

        {/* Reason — required standardized dropdown; Other reveals a required note. */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Reason <span className="text-gray-400">(optional)</span>
          </label>
          <select
            aria-label="Reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select reason (optional)</option>
            {CORRECTION_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          {isOther && (
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              rows={2}
              placeholder="Explain the correction…"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
        </div>

        {confirmingDelete && del ? (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              Keep
            </button>
            <button
              type="button"
              onClick={submitDelete}
              disabled={saving || !reasonReady}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {saving ? 'Deleting…' : del.label}
            </button>
          </div>
        ) : (
        <div className="flex items-center gap-2">
          {/* Destructive action lives INSIDE the edit modal (adjust only), not on every cell. */}
          {del && (
            <button
              type="button"
              onClick={() => { setError(null); setConfirmingDelete(true); }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 mr-auto"
            >
              <Trash2 className="h-4 w-4" />
              {del.label}
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ml-auto">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !reasonReady}
            className={`px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
              draft.mode === 'void' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Applying…' : draft.mode === 'void' ? 'Void event' : 'Apply'}
          </button>
        </div>
        )}
      </form>
    </div>
  );
};

export default CorrectionModal;
