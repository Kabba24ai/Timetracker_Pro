import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { CorrectableKind, CorrectionPayload } from '../../lib/admin';
import { tenantWallClockToUtcIso, toTenantDatetimeLocal } from '../../lib/tz';

// The correction the admin is composing. One shape per mode.
export type CorrectionDraft =
  | { mode: 'adjust'; eventId: number; kindLabel: string; effectiveAt: string | null }
  | { mode: 'void'; eventId: number; kindLabel: string }
  | { mode: 'insert'; userId: number };

const KINDS: { value: CorrectableKind; label: string }[] = [
  { value: 'clock_in', label: 'Clock In' },
  { value: 'clock_out', label: 'Clock Out' },
  { value: 'lunch_start', label: 'Lunch Start' },
  { value: 'lunch_end', label: 'Lunch End' },
  { value: 'other_start', label: 'Break Start' },
  { value: 'other_end', label: 'Break End' },
];

interface Props {
  draft: CorrectionDraft;
  /** Canonical tenant TimeTracker timezone — the datetime field is interpreted in it. */
  tz: string;
  onClose: () => void;
  onSubmit: (payload: CorrectionPayload) => Promise<void>;
}

const CorrectionModal: React.FC<Props> = ({ draft, tz, onClose, onSubmit }) => {
  const [effectiveAt, setEffectiveAt] = useState<string>(
    draft.mode === 'adjust' ? toTenantDatetimeLocal(draft.effectiveAt, tz) : toTenantDatetimeLocal(null, tz),
  );
  const [kind, setKind] = useState<CorrectableKind>('clock_out');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    draft.mode === 'adjust'
      ? `Adjust ${draft.kindLabel}`
      : draft.mode === 'void'
        ? `Void ${draft.kindLabel}`
        : 'Insert a missing punch';

  const submit = async () => {
    setSaving(true);
    setError(null);

    // The field holds a wall-clock time in the TENANT timezone; convert to a
    // true UTC instant from that zone — never the browser's.
    const effIso = () => tenantWallClockToUtcIso(effectiveAt, tz);

    let payload: CorrectionPayload;
    if (draft.mode === 'adjust') {
      payload = { type: 'adjust', event_id: draft.eventId, effective_at: effIso() };
    } else if (draft.mode === 'void') {
      payload = { type: 'void', event_id: draft.eventId };
    } else {
      payload = { type: 'insert', user_id: draft.userId, kind, effective_at: effIso() };
    }
    if (reason.trim()) payload.reason = reason.trim();

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The correction could not be applied.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
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
            rebuilt without it. This cannot leave the timeline in an impossible state — the server
            will reject it if it would.
          </p>
        ) : (
          <>
            {draft.mode === 'insert' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Punch type</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as CorrectableKind)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
              <input
                type="datetime-local"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || (draft.mode !== 'void' && !effectiveAt)}
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
