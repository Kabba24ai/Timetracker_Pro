import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Download, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  AdminEmployee,
  CorrectableKind,
  CorrectionPayload,
  DayPosition,
  POSITION_COLUMNS,
  PositionKey,
  TimeReview,
  TimeReviewDay,
  applyCorrection,
  applyLunchOverride,
  downloadCsv,
  fetchEmployees,
  fetchTimeReview,
  formatDuration,
  paidFromAt,
  removeLunchOverride,
  timeReviewToCsv,
} from '../../lib/admin';
import { formatClock, formatInstant, toTenantDatetimeLocal } from '../../lib/tz';
import CorrectionModal, { CorrectionDraft } from './CorrectionModal';
import { LunchOverrideDetailsModal, ResolveMissingLunchModal } from './LunchOverrideModal';

type Mode = 'current' | 'previous' | 'custom';

const DAY_TYPE_STYLE: Record<string, string> = {
  'Working Day': 'bg-blue-50 text-blue-700',
  'Day Off': 'bg-gray-100 text-gray-500',
  Override: 'bg-amber-50 text-amber-700',
  'PTO / Excused': 'bg-green-50 text-green-700',
  Unscheduled: 'bg-gray-50 text-gray-400',
};

const SOURCE_BADGE: Record<string, string> = {
  employee: 'bg-gray-100 text-gray-700',
  admin: 'bg-blue-100 text-blue-700',
  system: 'bg-purple-100 text-purple-700',
};

const CORRECTION_BADGE: Record<string, string> = {
  adjust: 'bg-amber-100 text-amber-800',
  void: 'bg-red-100 text-red-700',
  insert: 'bg-green-100 text-green-700',
};

// Default wall-clock time (tenant tz) pre-filled when inserting a missing punch.
const DEFAULT_TIME: Record<PositionKey, string> = {
  clock_in: '09:00',
  lunch_start: '12:00',
  lunch_end: '12:30',
  other_start: '15:00',
  other_end: '15:15',
  clock_out: '17:00',
};

interface TimeReviewProps {
  initialUserId?: number | null;
  initialFrom?: string;
  initialTo?: string;
}

const TimeReviewV2: React.FC<TimeReviewProps> = ({ initialUserId, initialFrom, initialTo }) => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [userId, setUserId] = useState<number | null>(initialUserId ?? null);
  // A drill-down carries an explicit range → custom mode; otherwise the current period.
  const [mode, setMode] = useState<Mode>(initialFrom ? 'custom' : 'current');
  const [from, setFrom] = useState<string>(initialFrom ?? '');
  const [to, setTo] = useState<string>(initialTo ?? '');

  useEffect(() => {
    if (initialUserId != null) setUserId(initialUserId);
    if (initialFrom) {
      setMode('custom');
      setFrom(initialFrom);
    }
    if (initialTo) setTo(initialTo);
  }, [initialUserId, initialFrom, initialTo]);

  const [review, setReview] = useState<TimeReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correction, setCorrection] = useState<CorrectionDraft | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Missing Lunch / Pending → Resolve Missing Lunch (Add Lunch | Override);
  // Lunch Override badge → details + reversal.
  const [lunchResolve, setLunchResolve] = useState<TimeReviewDay | null>(null);
  const [lunchOverrideView, setLunchOverrideView] = useState<TimeReviewDay | null>(null);

  useEffect(() => {
    fetchEmployees()
      .then(setEmployees)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load employees.'));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const params = mode === 'custom' && from && to ? { from, to } : { period: mode === 'previous' ? 'previous' : 'current' };
      const data = await fetchTimeReview(userId, params as { period?: 'current' | 'previous'; from?: string; to?: string });
      setReview(data);
      // Keep custom inputs in sync with the resolved period (for current/previous).
      if (mode !== 'custom') {
        setFrom(data.period.from);
        setTo(data.period.to);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the time review.');
    } finally {
      setLoading(false);
    }
  }, [userId, mode, from, to]);

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  const submitCorrection = async (payload: CorrectionPayload) => {
    setError(null);
    try {
      await applyCorrection(payload);
      setCorrection(null);
      await load(); // authoritative refresh: day, cards, and totals
    } catch (err) {
      throw err instanceof ApiError ? err : new ApiError('The correction could not be applied.', 0);
    }
  };

  const exportCsv = () => {
    if (!review?.days.length || !userId) return;
    const name = employees.find((e) => e.id === userId)?.full_name ?? String(userId);
    downloadCsv(`time-review_${name}_${review.period.from}_${review.period.to}.csv`, timeReviewToCsv(review, tz));
  };

  // The employee/day/punch are already chosen on the grid; the modal edits TIME
  // only (the date is read-only context). Clock in/out: filled → adjust, empty →
  // insert. Lunch/break: the interval is ONE logical unit — clicking either
  // endpoint opens the same Edit (pair exists) / Complete (one side exists) /
  // Add (nothing exists) modal, never two competing correction flows.
  const time24Of = (iso: string | null | undefined, fallback: string) =>
    iso ? toTenantDatetimeLocal(iso, tz).split('T')[1] : fallback;

  // Wall-clock 'HH:MM' ± minutes, clamped to the same calendar day.
  const shiftTime24 = (t: string, delta: number) => {
    const [h, m] = t.split(':').map(Number);
    const total = Math.min(Math.max(h * 60 + m + delta, 0), 23 * 60 + 59);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const editPosition = (day: TimeReviewDay, key: PositionKey, label: string) => {
    if (key !== 'clock_in' && key !== 'clock_out') {
      const breakType = key === 'lunch_start' || key === 'lunch_end' ? 'lunch' : 'other';
      const [startKey, endKey]: [PositionKey, PositionKey] =
        breakType === 'lunch' ? ['lunch_start', 'lunch_end'] : ['other_start', 'other_end'];
      const startPos = day.positions[startKey];
      const endPos = day.positions[endKey];
      const breakLabel = breakType === 'lunch' ? 'Lunch' : 'Break';

      // Any part of the interval already exists → the unified Edit/Complete
      // modal for the WHOLE interval. An existing endpoint is prefilled from its
      // own event (and preserved untouched by the server unless edited); a
      // missing endpoint is derived from the existing one — never the generic
      // Add defaults, which is what used to create impossible-sequence errors.
      if (startPos?.at || endPos?.at) {
        const anchor = (startPos?.at ?? endPos?.at)!;
        const date = toTenantDatetimeLocal(anchor, tz).split('T')[0];
        const startTime24 = startPos?.at
          ? toTenantDatetimeLocal(startPos.at, tz).split('T')[1]
          : shiftTime24(toTenantDatetimeLocal(endPos!.at!, tz).split('T')[1], -30);
        const endTime24 = endPos?.at
          ? toTenantDatetimeLocal(endPos.at, tz).split('T')[1]
          : shiftTime24(startTime24, 30);
        const complete = !(startPos?.at && endPos?.at);
        setCorrection({
          mode: 'edit_break',
          breakType,
          startEventId: startPos?.at ? startPos.event_id : undefined,
          endEventId: endPos?.at ? endPos.event_id : undefined,
          date,
          startTime24,
          endTime24,
          title: `${complete ? 'Complete' : 'Edit'} ${breakLabel} · ${day.day_label}`,
        });
        return;
      }

      // No interval on this day at all → Add a brand-new pair.
      if (!userId) return;
      setCorrection({
        mode: 'insert_break',
        userId,
        breakType,
        date: day.date,
        startTime24: DEFAULT_TIME[startKey],
        endTime24: DEFAULT_TIME[endKey],
        title: `Add ${breakType === 'lunch' ? 'lunch' : 'break'} · ${day.day_label}`,
      });
      return;
    }

    // Missing / Pending clock-out: the verified time RESOLVES the PendingClose
    // marker (supersedes it) — never ordinary Add Clock Out, which the state
    // machine rightly rejects once the marker has returned the employee to OFF.
    if (key === 'clock_out' && day.clock_out_unverified) {
      const marker = day.events.find((e) => e.kind === 'pending_close' && !e.superseded && e.correction_type !== 'void');
      if (marker) {
        setCorrection({
          mode: 'resolve_pending',
          eventId: marker.id,
          date: day.date,
          time24: time24Of(day.schedule?.end_at, DEFAULT_TIME.clock_out),
          title: `Resolve Missing Clock Out · ${day.day_label}`,
        });
        return;
      }
    }

    const pos = day.positions[key];
    if (pos && pos.at) {
      // Use the event's OWN tenant date (an overnight clock-out belongs to the next day).
      const [date, time24] = toTenantDatetimeLocal(pos.at, tz).split('T');
      // The position key IS the event kind — it tells the modal the delete cascade.
      setCorrection({ mode: 'adjust', eventId: pos.event_id, kind: key as CorrectableKind, kindLabel: label, date, time24 });
      return;
    }
    if (!userId) return;
    const iso = key === 'clock_in' ? day.schedule?.start_at : day.schedule?.end_at;
    setCorrection({ mode: 'insert', userId, kind: key, kindLabel: label, date: day.date, time24: time24Of(iso, DEFAULT_TIME[key]), title: `Add ${label} · ${day.day_label}` });
  };

  const addTimeForDay = (day: TimeReviewDay) => {
    if (!userId) return;
    setCorrection({
      mode: 'insert',
      userId,
      kind: 'clock_in',
      kindLabel: 'Clock In',
      date: day.date,
      time24: time24Of(day.schedule?.start_at, DEFAULT_TIME.clock_in),
      title: `Add time · ${day.day_label}`,
    });
  };

  // Option A of Resolve Missing Lunch: the REAL lunch — reuse the existing
  // unified lunch editor (Add lunch = insert_break), never a second editor.
  const addLunchFor = (day: TimeReviewDay) => {
    if (!userId) return;
    setLunchResolve(null);
    setCorrection({
      mode: 'insert_break',
      userId,
      breakType: 'lunch',
      date: day.date,
      startTime24: DEFAULT_TIME.lunch_start,
      endTime24: DEFAULT_TIME.lunch_end,
      title: `Add lunch · ${day.day_label}`,
    });
  };

  // Option B: explicit administrator override for THIS employee on THIS logical
  // shift only — anchored to the row's (primary shift's) Clock In event, never
  // the date. The server re-derives Pending; we refetch the authoritative grid.
  const overrideLunchFor = async (day: TimeReviewDay, reason: { reason_code?: string; reason?: string }) => {
    if (!userId) return;
    const clockIn = day.positions.clock_in;
    if (!clockIn) {
      throw new ApiError('This day has no Clock In to anchor the override to.', 0);
    }
    await applyLunchOverride({ user_id: userId, clock_in_event_id: clockIn.event_id, ...reason });
    setLunchResolve(null);
    await load();
  };

  const removeOverrideFor = async (day: TimeReviewDay, reason: { reason_code?: string; reason?: string }) => {
    if (!day.lunch_override) return;
    await removeLunchOverride(day.lunch_override.id, reason);
    setLunchOverrideView(null);
    await load();
  };

  // The Lunch area renders ONE spanning indicator when there is no lunch
  // interval and the day is either Missing Lunch / Pending or Lunch-Overridden.
  const lunchIndicator = (day: TimeReviewDay): 'missing' | 'override' | null => {
    if (day.positions.lunch_start || day.positions.lunch_end) return null;
    if (day.lunch_missing) return 'missing';
    if (day.lunch_override) return 'override';
    return null;
  };

  const totals = review?.totals;

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
          <select
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem]"
          >
            <option value="">Select an employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(['current', 'previous', 'custom'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'custom' ? 'Custom' : `${m} period`}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        )}

        <button
          onClick={load}
          disabled={!userId || loading || (mode === 'custom' && (!from || !to))}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            disabled={!review?.days.length}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {review && (
        <p className="text-sm text-gray-500 mb-3">
          {review.period.label ?? `${review.period.from} – ${review.period.to}`}
          <span className="text-gray-400"> · {review.employee.full_name}</span>
        </p>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!userId ? (
        <p className="text-gray-500 text-center py-12">Select an employee to review their time.</p>
      ) : (
        <>
          {/* Summary cards — Paid → Unpaid → Total Worked, then Shifts / Lunch / Other. */}
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <Card label="Paid" value={formatDuration(totals.paid_seconds)} accent="text-blue-700" emphasize />
              <Card label="Unpaid" value={formatDuration(totals.unpaid_seconds)} accent="text-orange-600" />
              <Card label="Total Worked" value={formatDuration(totals.gross_seconds)} accent="text-gray-900" />
              <Card label="Shifts" value={String(totals.shift_count)} sub={totals.open_shift_count ? `${totals.open_shift_count} open` : undefined} />
              <Card label="Lunch" value={formatDuration(totals.lunch_seconds)} />
              <Card label="Other Breaks" value={formatDuration(totals.other_break_seconds)} />
            </div>
          )}

          <p className="text-xs text-gray-500 mb-1">
            Click any time to edit. Click <span className="font-medium">Add time</span> on days with no entries to add
            time for that day. Pay the <span className="text-blue-700 font-medium">Paid</span> column.
          </p>
          <p className="text-xs text-gray-400 mb-4">All times shown in {tz} (tenant timezone).</p>

          {/* Daily grid — one row per calendar day, recorded or not. */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Day</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Day Type</th>
                  {POSITION_COLUMNS.map((c) => (
                    <th key={c.key} className="text-center px-2 py-2 font-medium whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-medium text-blue-700">Paid</th>
                  <th className="text-right px-3 py-2 font-medium text-orange-600">Unpaid</th>
                  <th className="text-right px-3 py-2 font-medium">Total Worked</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !review ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  review?.days.map((d) => {
                    const empty = d.event_count === 0;
                    return (
                      <React.Fragment key={d.date}>
                        <tr className="hover:bg-gray-50/60">
                          <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{d.weekday_label}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.date.slice(5)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${DAY_TYPE_STYLE[d.day_type] ?? 'bg-gray-100 text-gray-500'}`}>
                              {d.day_type}
                            </span>
                          </td>
                          {POSITION_COLUMNS.map((c) => {
                            const lunch = lunchIndicator(d);
                            if (lunch && c.key === 'lunch_end') return null;
                            if (lunch && c.key === 'lunch_start') {
                              return (
                                <td key="lunch" colSpan={2} className="px-2 py-2 text-center">
                                  {lunch === 'missing' ? (
                                    <button
                                      onClick={() => setLunchResolve(d)}
                                      className="px-2 py-1 rounded text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                                      title="A lunch is required for this shift but none was recorded — click to resolve"
                                    >
                                      Missing Lunch / Pending
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setLunchOverrideView(d)}
                                      className="px-2 py-1 rounded text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                      title="No lunch was required for this shift (administrator override) — click for details"
                                    >
                                      Lunch Override
                                    </button>
                                  )}
                                </td>
                              );
                            }
                            // Restrict Paid Time to Shift Start: the Clock In cell keeps
                            // the REAL punch; a small note names where paid time began
                            // when the server clamped it to the scheduled start.
                            const paidFrom = c.key === 'clock_in' ? paidFromAt(d) : null;
                            return (
                              <td key={c.key} className="px-2 py-2 text-center">
                                <PunchCell
                                  pos={d.positions[c.key]}
                                  unverified={c.key === 'clock_out' && d.clock_out_unverified}
                                  tz={tz}
                                  onClick={() => editPosition(d, c.key, c.label)}
                                />
                                {paidFrom && (
                                  <div
                                    className="mt-0.5 text-[11px] leading-tight text-gray-500 whitespace-nowrap"
                                    title="Early clock-in: paid time begins at the scheduled shift start (Restrict Paid Time to Shift Start). The actual Clock In is kept on record."
                                  >
                                    Paid from {formatClock(paidFrom, tz)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700 whitespace-nowrap">
                            {formatDuration(d.paid_seconds)}
                            {d.has_open_shift && (
                              <span className="ml-1 text-amber-500 font-sans" title="Includes an open shift — not final until clock-out">
                                *
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-orange-600">{formatDuration(d.unpaid_seconds)}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">{formatDuration(d.gross_seconds)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {empty ? (
                              <button onClick={() => addTimeForDay(d)} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                <Plus className="h-3.5 w-3.5" /> Add time
                              </button>
                            ) : (
                              <button
                                onClick={() => setExpanded((s) => ({ ...s, [d.date]: !s[d.date] }))}
                                className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600"
                                title="View the immutable event ledger for this day"
                              >
                                {expanded[d.date] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                Ledger ({d.event_count})
                                {d.has_extra_events && <span className="ml-1 text-[10px] px-1 rounded bg-amber-100 text-amber-700">extra</span>}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded[d.date] && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={13} className="px-4 py-3">
                              <DayLedger
                                day={d}
                                tz={tz}
                                onAdjust={(eventId, kind, kindLabel, at) => {
                                  const [date, time24] = (at ? toTenantDatetimeLocal(at, tz) : `${d.date}T12:00`).split('T');
                                  setCorrection({ mode: 'adjust', eventId, kind, kindLabel, date, time24 });
                                }}
                                onVoid={(eventId, kindLabel, at) => setCorrection({ mode: 'void', eventId, kindLabel, date: at ? toTenantDatetimeLocal(at, tz).split('T')[0] : d.date })}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td colSpan={9} className="px-3 py-3 text-gray-700">
                      Pay Period Total
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-blue-700">{formatDuration(totals.paid_seconds)}</td>
                    <td className="px-3 py-3 text-right font-mono text-orange-600">{formatDuration(totals.unpaid_seconds)}</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">{formatDuration(totals.gross_seconds)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {correction && <CorrectionModal draft={correction} tz={tz} onClose={() => setCorrection(null)} onSubmit={submitCorrection} />}
      {lunchResolve && (
        <ResolveMissingLunchModal
          day={lunchResolve}
          onAddLunch={() => addLunchFor(lunchResolve)}
          onOverride={(reason) => overrideLunchFor(lunchResolve, reason)}
          onClose={() => setLunchResolve(null)}
        />
      )}
      {lunchOverrideView?.lunch_override && (
        <LunchOverrideDetailsModal
          day={lunchOverrideView}
          override={lunchOverrideView.lunch_override}
          tz={tz}
          onRemove={(reason) => removeOverrideFor(lunchOverrideView, reason)}
          onClose={() => setLunchOverrideView(null)}
        />
      )}
    </div>
  );
};

const PunchCell: React.FC<{ pos: DayPosition | null; unverified?: boolean; tz: string; onClick: () => void }> = ({ pos, unverified, tz, onClick }) => {
  // A Missing-Clock-Out Pending shift has NO clock-out (no time was ever
  // fabricated): show the Clock Out cell as "Missing / Pending" (needs admin
  // review). The Pending reason is carried on the day; the cell click opens the
  // correction workflow to insert the verified Clock Out.
  if (unverified || pos?.unverified) {
    return (
      <button
        onClick={onClick}
        className="px-2 py-1 rounded text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
        title="No Clock Out recorded — insert the verified Clock Out time"
      >
        Missing / Pending
      </button>
    );
  }

  return pos ? (
    <button onClick={onClick} className="font-mono text-gray-900 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Click to edit">
      {formatClock(pos.at, tz)}
    </button>
  ) : (
    <button onClick={onClick} className="font-mono text-gray-300 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Click to add">
      --:--
    </button>
  );
};

const Card: React.FC<{ label: string; value: string; sub?: string; accent?: string; emphasize?: boolean }> = ({ label, value, sub, accent, emphasize }) => (
  <div className={`rounded-lg p-4 border ${emphasize ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`${emphasize ? 'text-2xl' : 'text-xl'} font-semibold ${accent ?? 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-amber-600 mt-0.5">{sub}</p>}
  </div>
);

const DayLedger: React.FC<{
  day: TimeReviewDay;
  tz: string;
  onAdjust: (eventId: number, kind: CorrectableKind, kindLabel: string, at: string | null) => void;
  onVoid: (eventId: number, kindLabel: string, at: string | null) => void;
}> = ({ day, tz, onAdjust, onVoid }) => (
  <div>
    <p className="text-xs font-semibold text-gray-600 mb-2">Event ledger — {day.day_label} (immutable audit truth)</p>
    <table className="min-w-full text-xs">
      <thead className="text-gray-500">
        <tr>
          <th className="text-left px-2 py-1 font-medium">Kind</th>
          <th className="text-left px-2 py-1 font-medium">Effective</th>
          <th className="text-left px-2 py-1 font-medium">Source</th>
          <th className="text-left px-2 py-1 font-medium">Reason</th>
          <th className="text-right px-2 py-1 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {day.events.map((ev) => (
          <tr key={ev.id} className={ev.superseded ? 'text-gray-400' : ''}>
            <td className="px-2 py-1 whitespace-nowrap">
              {ev.kind_label}
              {ev.correction_type && <span className={`ml-2 px-1.5 py-0.5 rounded ${CORRECTION_BADGE[ev.correction_type] ?? 'bg-gray-100'}`}>{ev.correction_type}</span>}
              {ev.superseded && <span className="ml-2 italic">superseded</span>}
            </td>
            <td className="px-2 py-1 whitespace-nowrap font-mono">{formatInstant(ev.effective_at, tz)}</td>
            <td className="px-2 py-1">
              <span className={`px-2 py-0.5 rounded-full ${SOURCE_BADGE[ev.source] ?? 'bg-gray-100'}`}>{ev.source}</span>
            </td>
            <td className="px-2 py-1 text-gray-600 max-w-[14rem] truncate" title={ev.reason ?? ''}>
              {ev.reason ?? ''}
            </td>
            <td className="px-2 py-1 text-right whitespace-nowrap">
              {!ev.superseded && ev.correction_type !== 'void' && (
                <>
                  <button onClick={() => onAdjust(ev.id, ev.kind, ev.kind_label, ev.effective_at)} className="text-blue-600 hover:underline mr-3">
                    Adjust
                  </button>
                  <button onClick={() => onVoid(ev.id, ev.kind_label, ev.effective_at)} className="text-red-600 hover:underline">
                    Void
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default TimeReviewV2;
