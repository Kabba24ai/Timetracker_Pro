import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  PayPeriodOption,
  PeriodMode,
  PeriodSelection,
  fetchPayPeriods,
  formatPeriodRange,
} from '../../lib/admin';

const MODE_LABEL: Record<PeriodMode, string> = {
  current: 'Current Period',
  previous: 'Previous Period',
  custom: 'Custom',
};

interface Props {
  /** Prefix for the control ids, so labels stay unique on the page. */
  idPrefix: string;
  value: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
  /** Toolbar items before the period controls (Time Review's Employee picker). */
  leading?: React.ReactNode;
  /** The tab's own toolbar controls, after the period controls. */
  children?: React.ReactNode;
}

/**
 * THE pay-period selector for the admin dashboard — Time Review and Pay Periods
 * both render this, so Current, Previous and the Custom list can never diverge
 * between them.
 *
 * Every pay period comes from the backend payroll calendar: Current and Previous
 * are canonical selectors the server resolves, and Custom is one established
 * period from GET /admin/pay-periods (the same resolver, newest first). There is
 * no date entry and no date arithmetic here. If the list cannot be loaded, Custom
 * shows an error with Retry — never a manual range in its place.
 *
 * Controlled: it owns no selection and no payroll data, only the period list.
 */
const PayPeriodSelector: React.FC<Props> = ({ idPrefix, value, onChange, leading, children }) => {
  // null until the canonical list arrives.
  const [periods, setPeriods] = useState<PayPeriodOption[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setListFailed(false);
    fetchPayPeriods()
      .then((list) => {
        if (live) setPeriods(list);
      })
      .catch(() => {
        if (live) setListFailed(true);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const unavailable = listFailed || periods?.length === 0;

  const selectMode = (mode: PeriodMode) => {
    if (mode !== 'custom') {
      onChange({ mode, from: '', to: '' });
      return;
    }
    if (value.mode === 'custom') return; // keep the period already picked
    // Custom opens on the period the administrator was just looking at, as the
    // server's own list marks it. If that is not available yet, nothing is
    // picked and nothing is queried until a period is chosen.
    const seed = periods?.find((p) => (value.mode === 'current' ? p.is_current : p.is_previous));
    onChange({ mode: 'custom', from: seed?.from ?? '', to: seed?.to ?? '' });
  };

  const selectPeriod = (start: string) => {
    const period = periods?.find((p) => p.from === start);
    if (period) onChange({ mode: 'custom', from: period.from, to: period.to });
  };

  const chosen =
    value.mode === 'custom' ? periods?.find((p) => p.from === value.from && p.to === value.to) : undefined;

  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {leading}

      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
        {(['current', 'previous', 'custom'] as PeriodMode[]).map((m) => (
          <button
            key={m}
            onClick={() => selectMode(m)}
            aria-pressed={value.mode === m}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              value.mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {value.mode === 'custom' &&
        (unavailable ? (
          <div>
            <p className="block text-xs font-medium text-gray-600 mb-1">Pay Period</p>
            <div
              role="alert"
              className="flex items-center gap-2 px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{listFailed ? 'Pay periods could not be loaded.' : 'No pay periods are available.'}</span>
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="font-medium underline hover:text-red-900"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor={`${idPrefix}-pay-period`} className="block text-xs font-medium text-gray-600 mb-1">
              Pay Period
            </label>
            <select
              id={`${idPrefix}-pay-period`}
              value={chosen?.from ?? ''}
              disabled={!periods}
              onChange={(e) => selectPeriod(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            >
              {!periods && <option value="">Loading pay periods…</option>}
              {periods && !chosen && (
                <option value="" disabled>
                  Select a pay period…
                </option>
              )}
              {periods?.map((p) => (
                <option key={p.from} value={p.from}>
                  {formatPeriodRange(p.from, p.to)}
                  {p.is_current ? ' — Current' : p.is_previous ? ' — Previous' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}

      {children}
    </div>
  );
};

export default PayPeriodSelector;
