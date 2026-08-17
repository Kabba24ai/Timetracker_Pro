import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { BreakKind, CorrectableKind, CorrectionPayload } from '../../lib/admin';
import { tenantWallClockToUtcIso, toTenantDatetimeLocal } from '../../lib/tz';

// The correction the admin is composing. One shape per mode. `insert` and
// `insert_break` may arrive pre-filled from a clicked day/position so the admin
// lands on the exact punch to add.
export type CorrectionDraft =
  | { mode: 'adjust'; eventId: number; kindLabel: string; effectiveAt: string | null }
  | { mode: 'void'; eventId: number; kindLabel: string }
  | { mode: 'insert'; userId: number; kind?: CorrectableKind; datetimeLocal?: string; label?: string }
  | {
      mode: 'insert_break';
      userId: number;
      breakType: BreakKind;
      startLocal?: string;
      endLocal?: string;
      label?: string;
    };

const KINDS: { value: CorrectableKind; label: string }[] = [
  { value: 'clock_in', label: 'Clock In' },
  { value: 'clock_out', label: 'Clock Out' },
  { value: 'lunch_start', label: 'Lunch Out' },
  { value: 'lunch_end', label: 'Lunch In' },
  { value: 'other_start', label: 'Break Out' },
  { value: 'other_end', label: 'Break In' },
];

interface Props {
  draft: CorrectionDraft;
  /** Canonical tenant TimeTracker timezone — datetime fields are interpreted in it. */
  tz: string;
  onClose: () => void;
  onSubmit: (payload: CorrectionPayload) => Promise<void>;
}

const CorrectionModal: React.FC<Props> = ({ draft, tz, onClose, onSubmit }) => {
  const [effectiveAt, setEffectiveAt] = useState<string>(
    draft.mode === 'adjust'
      ? toTenantDatetimeLocal(draft.effectiveAt, tz)
      : draft.mode === 'insert'
        ? (draft.datetimeLocal ?? toTenantDatetimeLocal(null, tz))
        : toTenantDatetimeLocal(null, tz),
  );
  const [kind, setKind] = useState<CorrectableKind>(
    draft.mode === 'insert' ? (draft.kind ?? 'clock_in') : 'clock_out',
  );
  const [startAt, setStartAt] = useState<string>(
    draft.mode === 'insert_break' ? (draft.startLocal ?? toTenantDatetimeLocal(null, tz)) : '',
  );
  const [endAt, setEndAt] = useState<string>(
    draft.mode === 'insert_break' ? (draft.endLocal ?? toTenantDatetimeLocal(null, tz)) : '',
  );
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    draft.mode === 'adjust'
      ? `Adjust ${draft.kindLabel}`
      : draft.mode === 'void'
        ? `Void ${draft.kindLabel}`
        : draft.mode === 'insert_break'
          ? draft.label ?? (draft.breakType === 'lunch' ? 'Add lunch' : 'Add break')
          : (draft.label ?? 'Add a punch');

  const submit = async () => {
    setSaving(true);
    setError(null);

    // Fields hold wall-clock times in the TENANT timezone; convert to true UTC
    // instants from that zone — never the browser's.
    const iso = (local: string) => tenantWallClockToUtcIso(local, tz);

    let payload: CorrectionPayload;
    if (draft.mode === 'adjust') {
      payload = { type: 'adjust', event_id: draft.eventId, effective_at: iso(effectiveAt) };
    } else if (draft.mode === 'void') {
      payload = { type: 'void', event_id: draft.eventId };
    } else if (draft.mode === 'insert_break') {
      payload = {
        type: 'insert_break',
        user_id: draft.userId,
        break_type: draft.breakType,
        start_at: iso(startAt),
        end_at: iso(endAt),
      };
    } else {
      payload = { type: 'insert', user_id: draft.userId, kind, effective_at: iso(effectiveAt) };
    }
    if (reason.trim()) payload.reason = reason.trim();

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The correction could not be applied.');
      setSaving(false);
    }
  };

  const field =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {draft.mode === 'void' ? (
          <p className="text-sm text-gray-600 mb-4">
            This appends a void correction; the original event is preserved and the projection is
            rebuilt without it. The server rejects it if it would leave an impossible sequence.
          </p>
        ) : draft.mode === 'insert_break' ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {draft.breakType === 'lunch' ? 'Lunch Out' : 'Break Out'} <span className="text-gray-400">({tz})</span>
              </label>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {draft.breakType === 'lunch' ? 'Lunch In' : 'Break In'} <span className="text-gray-400">({tz})</span>
              </label>
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={field} />
            </div>
          </div>
        ) : (
          <>
            {draft.mode === 'insert' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Punch type</label>
                <select value={kind} onChange={(e) => setKind(e.target.value as CorrectableKind)} className={`${field} bg-white`}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Effective time <span className="text-gray-400">({tz})</span>
              </label>
              <input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} className={field} />
            </div>
          </>
        )}

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Employee forgot to clock out"
            className={field}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={
              saving ||
              (draft.mode === 'insert_break' ? !startAt || !endAt : draft.mode !== 'void' && !effectiveAt)
            }
            className={`px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
              draft.mode === 'void' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Applying…' : draft.mode === 'void' ? 'Void event' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CorrectionModal;
