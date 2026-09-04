import React, { useState } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { formatShortCalendarDate } from '../../lib/tz';
import { Holiday, StoreMeta, createHoliday, deleteHoliday, excludeFromHoliday, updateHoliday } from '../../lib/schedule';

// A global, store-scoped HOLIDAY over an inclusive date range.
//
// Display only: a holiday marks context ("this date is Labor Day at these
// stores"). It never pays anyone, never removes scheduled work, and never
// touches the time-off or payroll domain. Employees scheduled to work a holiday
// keep their hours. Client checks are supplemental — the server validates the
// range, the scope and store activity, and its message is shown verbatim.

interface Props {
  stores: StoreMeta[];
  /** Seed date for a new holiday (the clicked column, or today). */
  date: string;
  /** Editing an existing holiday: fields are preloaded and Delete is offered. */
  existing?: Holiday | null;
  /**
   * Set when the editor was opened from an EMPLOYEE CELL. Removal then offers a
   * real choice — hide the holiday for just this person on this date, or delete
   * it for everyone — instead of one ambiguous "Confirm Delete".
   */
  employee?: { id: number; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

const ScheduleHolidayModal: React.FC<Props> = ({ stores, date, existing, employee, onClose, onSaved }) => {
  const [name, setName] = useState(existing?.name ?? '');
  const [startDate, setStartDate] = useState(existing?.start_date ?? date);
  const [endDate, setEndDate] = useState(existing?.end_date ?? date);
  // All active stores are selected by default — a holiday normally applies
  // everywhere; the admin unchecks the exceptions.
  const [storeIds, setStoreIds] = useState<number[]>(existing ? existing.store_ids : stores.map((s) => s.id));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const toggleStore = (id: number) =>
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const validate = (): string | null => {
    if (!name.trim()) return 'Enter a holiday name.';
    if (!startDate || !endDate) return 'Enter a start and end date.';
    if (endDate < startDate) return 'The end date cannot be before the start date.';
    if (storeIds.length === 0) return 'Select at least one store.';
    return null;
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const problem = validate();
    setValidation(problem);
    if (problem) return;

    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), start_date: startDate, end_date: endDate, store_ids: storeIds };
      if (existing) {
        await updateHoliday(existing.id, payload);
      } else {
        await createHoliday(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The holiday could not be saved.');
      setSaving(false);
    }
  };

  const run = async (fn: () => Promise<void>, failure: string) => {
    setRemoving(true);
    setError(null);
    try {
      await fn();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : failure);
      setRemoving(false);
    }
  };

  /** Hide this holiday for THIS employee on THIS date only. */
  const removeForEmployee = () => {
    if (!existing || !employee) return;
    run(
      () => excludeFromHoliday(existing.id, { user_id: employee.id, date: clickedDate }),
      'The holiday could not be removed for this employee.',
    );
  };

  /** Delete the holiday everywhere it is projected. */
  const remove = () => {
    if (!existing) return;
    run(() => deleteHoliday(existing.id), 'The holiday could not be deleted.');
  };

  const busy = saving || removing;
  const title = existing ? 'Edit Holiday' : 'Add Holiday';
  // An exclusion is per DATE — always the cell the admin clicked, never the whole
  // range of a multi-day holiday.
  const clickedDate = date;
  const prettyDate = formatShortCalendarDate(clickedDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="holiday-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="holiday-title" className="text-lg font-semibold text-gray-900">
            {title}
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

        <div className="mb-4">
          <label htmlFor="holiday-name" className="block text-xs font-medium text-gray-600 mb-1">
            Holiday Name
          </label>
          <input
            id="holiday-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Labor Day"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="holiday-start" className="block text-xs font-medium text-gray-600 mb-1">
              Start Date
            </label>
            <input
              id="holiday-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="holiday-end" className="block text-xs font-medium text-gray-600 mb-1">
              End Date
            </label>
            <input
              id="holiday-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <fieldset className="mb-4">
          <legend className="block text-xs font-medium text-gray-600 mb-1">Applies To</legend>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={storeIds.includes(s.id)}
                  onChange={() => toggleStore(s.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-gray-900">{s.name}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            A holiday is display context. It never changes anyone&rsquo;s scheduled hours or pay.
          </p>
        </fieldset>

        {validation && <p className="mb-3 text-sm text-red-600">{validation}</p>}

        {/* Two DIFFERENT destructive meanings, never one ambiguous button. */}
        {confirmingDelete ? (
          <div>
            {employee ? (
              <>
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {`Remove ${name || 'this holiday'} for ${employee.name} on ${prettyDate}?`}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {`${name || 'The holiday'} will remain on everyone else's schedule. ${employee.name}'s scheduled work hours are not affected.`}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={removeForEmployee}
                    disabled={busy}
                    className="w-full px-4 py-2 rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {`Remove for ${employee.name} Only`}
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {`Delete ${name || 'Holiday'} for Everyone`}
                  </button>
                  <p className="text-xs text-gray-500">
                    Deleting for everyone removes the holiday from every employee and store in its scope. Scheduled work
                    hours are not affected.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={busy}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Keep
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span className="text-sm">
                    This removes the Holiday from every employee/store in its scope. Scheduled work hours are not affected.
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removing ? 'Deleting…' : `Delete ${name || 'Holiday'} for Everyone`}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div>
              {existing && (
                <button
                  type="button"
                  onClick={() => { setError(null); setConfirmingDelete(true); }}
                  disabled={busy}
                  className="flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Remove Holiday
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save Holiday'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ScheduleHolidayModal;
