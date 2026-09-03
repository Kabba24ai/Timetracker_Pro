import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { CORRECTION_REASONS, LunchOverrideInfo, LunchOverridePayload, TimeReviewDay } from '../../lib/admin';
import { formatCalendarDate, formatInstant } from '../../lib/tz';

// Resolve Missing Lunch — the two LEGITIMATE resolutions of a Pending — Missing
// Lunch shift. Option A routes into the EXISTING unified lunch editor (insert the
// real Lunch Out / Lunch In); Option B is an explicit, case-by-case administrator
// decision that no lunch was required for THIS employee on THIS date only. The
// override is not a punch: no lunch time is added or deducted, and it never
// carries to any other shift, day, or employee.

type Reason = Pick<LunchOverridePayload, 'reason_code' | 'reason'>;

const ReasonPicker: React.FC<{ reasonCode: string; otherText: string; onCode: (c: string) => void; onOther: (t: string) => void }> = ({
  reasonCode,
  otherText,
  onCode,
  onOther,
}) => (
  <div className="mb-5">
    <label className="block text-xs font-medium text-gray-600 mb-1">
      Reason <span className="text-gray-400">(optional)</span>
    </label>
    <select
      aria-label="Reason"
      value={reasonCode}
      onChange={(e) => onCode(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select reason (optional)</option>
      {CORRECTION_REASONS.map((r) => (
        <option key={r.code} value={r.code}>
          {r.label}
        </option>
      ))}
    </select>
    {reasonCode === 'other' && (
      <textarea
        value={otherText}
        onChange={(e) => onOther(e.target.value)}
        rows={2}
        placeholder="Explain the decision…"
        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    )}
  </div>
);

function buildReason(reasonCode: string, otherText: string): Reason {
  if (reasonCode === '') return {};
  const label = CORRECTION_REASONS.find((r) => r.code === reasonCode)?.label ?? reasonCode;
  return { reason_code: reasonCode, reason: reasonCode === 'other' ? otherText.trim() : label };
}

const Shell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const OVERRIDE_CONFIRM_TITLE = 'Override Lunch Requirement?';
export const OVERRIDE_CONFIRM_BODY =
  'This shift normally requires a lunch. Confirm that no lunch was required for this employee on this date. No lunch time will be added or deducted.';

interface ResolveProps {
  day: TimeReviewDay;
  onAddLunch: () => void;
  onOverride: (reason: Reason) => Promise<void>;
  onClose: () => void;
}

export const ResolveMissingLunchModal: React.FC<ResolveProps> = ({ day, onAddLunch, onOverride, onClose }) => {
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [reasonCode, setReasonCode] = useState('');
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonReady = reasonCode !== 'other' || otherText.trim() !== '';

  const confirm = async () => {
    if (saving || !reasonReady) return;
    setSaving(true);
    setError(null);
    try {
      await onOverride(buildReason(reasonCode, otherText));
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The lunch override could not be applied.');
      setSaving(false);
    }
  };

  if (step === 'confirm') {
    return (
      <Shell title={OVERRIDE_CONFIRM_TITLE} onClose={onClose}>
        {error && (
          <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        <div className="mb-4">
          <p className="block text-xs font-medium text-gray-600 mb-1">Date</p>
          <p className="text-sm font-medium text-gray-900">{formatCalendarDate(day.date)}</p>
        </div>
        <p className="text-sm text-gray-700 mb-4">{OVERRIDE_CONFIRM_BODY}</p>
        <ReasonPicker reasonCode={reasonCode} otherText={otherText} onCode={setReasonCode} onOther={setOtherText} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || !reasonReady}
            className="px-4 py-2 rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Applying…' : 'Override Lunch'}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={`Resolve Missing Lunch · ${day.day_label}`} onClose={onClose}>
      <p className="text-sm text-gray-700 mb-4">A lunch is required for this shift, but none was recorded.</p>
      <div className="space-y-3 mb-5">
        <button
          type="button"
          onClick={onAddLunch}
          className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
        >
          <p className="font-medium text-gray-900">Add Lunch</p>
          <p className="text-xs text-gray-500 mt-0.5">The employee took lunch but did not record it. Enter Lunch Out and Lunch In.</p>
        </button>
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
        >
          <p className="font-medium text-gray-900">Override Lunch Requirement</p>
          <p className="text-xs text-gray-500 mt-0.5">
            The employee legitimately did not take lunch. Applies to this shift only — no lunch time is added or deducted.
          </p>
        </button>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </Shell>
  );
};

interface DetailsProps {
  day: TimeReviewDay;
  override: LunchOverrideInfo;
  tz: string;
  onRemove: (reason: Reason) => Promise<void>;
  onClose: () => void;
}

// Lunch Override details — explains why a qualifying 5+ hour shift has no lunch
// yet is not Pending, and lets the administrator reverse an erroneous override.
export const LunchOverrideDetailsModal: React.FC<DetailsProps> = ({ day, override, tz, onRemove, onClose }) => {
  const [reasonCode, setReasonCode] = useState('');
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonReady = reasonCode !== 'other' || otherText.trim() !== '';

  const remove = async () => {
    if (saving || !reasonReady) return;
    setSaving(true);
    setError(null);
    try {
      await onRemove(buildReason(reasonCode, otherText));
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The lunch override could not be removed.');
      setSaving(false);
    }
  };

  return (
    <Shell title={`Lunch Override · ${day.day_label}`} onClose={onClose}>
      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <p className="text-sm text-gray-700 mb-3">
        No lunch was required for this shift (administrator override). No lunch time was added or deducted.
      </p>
      <dl className="text-sm mb-4 space-y-1">
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Applied by</dt>
          <dd className="text-gray-900">{override.applied_by?.full_name ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Applied</dt>
          <dd className="text-gray-900 font-mono">{override.applied_at ? formatInstant(override.applied_at, tz) : '—'}</dd>
        </div>
        {override.reason && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Reason</dt>
            <dd className="text-gray-900">{override.reason}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-gray-500 mb-4">
        Removing the override re-checks the lunch requirement. If a lunch is still required and none is recorded, the shift
        returns to Missing Lunch / Pending.
      </p>
      <ReasonPicker reasonCode={reasonCode} otherText={otherText} onCode={setReasonCode} onOther={setOtherText} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          Close
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={saving || !reasonReady}
          className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Removing…' : 'Remove Lunch Override'}
        </button>
      </div>
    </Shell>
  );
};
