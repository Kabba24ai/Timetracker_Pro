import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  DayStatusCell,
  EmployeeView,
  HolidayMarker,
  ScheduleSegmentCell,
  StoreMeta,
  TimeOffCell,
  fetchMyEmployeeSchedule,
  formatRange,
  formatScheduledDuration,
  formatScheduledHoursLabel,
} from '../../lib/schedule';
import { tenantToday } from '../../lib/tz';
import ScheduleStatusBadge from './ScheduleStatusBadge';

/**
 * Dashboard card: the signed-in employee's schedule for THIS week, read-only.
 *
 * A compact view of the same canonical endpoint the full Work Schedule page
 * uses (mode=me, view=this_week): the server derives the employee from the
 * token, owns the Monday–Sunday tenant-timezone range, the privacy-safe
 * statuses and the Total Scheduled Hours. Nothing is calculated here; each
 * date simply shows what the employee's own schedule shows for it.
 *
 * The full Work Schedule page (and its button) is unchanged — this card is an
 * additional at-a-glance view, not a replacement.
 */

// Refresh while the dashboard stays open (a manager may change the schedule),
// and when the employee returns to it after this long away.
const POLL_MS = 5 * 60_000;
const STALE_MS = 60_000;

const neutral = '#94a3b8';

interface Shift {
  seg: ScheduleSegmentCell;
  store: StoreMeta | null;
}

interface DayLine {
  date: string;
  weekday: string;
  dayLabel: string;
  shifts: Shift[];
  status: { status: DayStatusCell['status'] | TimeOffCell['status'] | 'day_off'; label?: string } | null;
  partialTimeOff: TimeOffCell | null;
  holidays: HolidayMarker[];
}

/** One line per date, decided exactly as the employee's Work Schedule page decides a cell. */
function dayLines(view: EmployeeView): DayLine[] {
  const storeById = new Map(view.stores.map((s) => [s.id, s]));
  const dayOffs = new Set(view.day_offs);

  return view.dates.map((d) => {
    const shifts: Shift[] = view.employee_view
      .flatMap((row) => (row.cells[d.date] ?? []).map((seg) => ({ seg, store: storeById.get(row.store_id) ?? storeById.get(seg.store_id) ?? null })))
      .sort((a, b) => a.seg.start.localeCompare(b.seg.start));

    const seen = new Set<number>();
    const holidays = view.employee_view
      .flatMap((row) => row.holidays?.[d.date] ?? [])
      .filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)));

    const dayStatus = view.day_status?.[d.date];
    const timeOff = view.time_off?.[d.date];

    let status: DayLine['status'] = null;
    let partialTimeOff: TimeOffCell | null = null;
    let shown = shifts;
    if (dayStatus) {
      // An explicit schedule status owns the employee-status slot; a full-day
      // one replaces the shift (Holiday is contextual and keeps it).
      if (dayStatus.is_full_day || shifts.length === 0) {
        status = { status: dayStatus.status, label: dayStatus.label };
        shown = [];
      }
    } else if (timeOff?.is_full_day) {
      status = { status: timeOff.status, label: timeOff.label };
      shown = [];
    } else if (timeOff && shifts.length > 0) {
      partialTimeOff = timeOff;
    }
    if (!status && shown.length === 0 && dayOffs.has(d.date)) {
      status = { status: 'day_off' };
    }

    return { date: d.date, weekday: d.weekday_label, dayLabel: d.day_label, shifts: shown, status, partialTimeOff, holidays };
  });
}

const WeeklyScheduleCard: React.FC = () => {
  const [view, setView] = useState<EmployeeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedAt = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const v = await fetchMyEmployeeSchedule({ view: 'this_week' });
      if (!mounted.current) return;
      loadedAt.current = Date.now();
      setView(v);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof ApiError ? err.message : 'Could not load your schedule.');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();

    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > STALE_MS) void load();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);

    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [load]);

  const lines = view ? dayLines(view) : [];
  const today = view ? tenantToday(view.range.timezone) : '';
  const hasAnything = lines.some((l) => l.shifts.length > 0 || l.status || l.holidays.length > 0);
  const total = view?.scheduled_hours;

  return (
    <section className="rounded-lg border border-gray-200 p-4" aria-labelledby="weekly-schedule-heading">
      <h3 id="weekly-schedule-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <CalendarDays className="h-4 w-4 text-blue-600" />
        <span>Work Schedule{view ? `: ${view.range.label}` : ''}</span>
      </h3>

      <div className="mt-3">
        {!view ? (
          error ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void load()} className="shrink-0 text-xs font-medium underline">
                Try again
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Loading your schedule…</p>
          )
        ) : (
          <>
            {error && (
              // A failed refresh keeps the last schedule that loaded.
              <p className="mb-2 text-xs text-amber-700" role="status">Could not refresh your schedule; showing the last one loaded.</p>
            )}
            {!hasAnything ? (
              <p className="py-3 text-sm text-gray-500">No shifts are scheduled for you this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs" aria-label="This week’s work schedule">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left py-1.5 pr-2 font-medium">Day</th>
                      <th className="text-left py-1.5 px-2 font-medium">Scheduled Shift</th>
                      <th className="text-left py-1.5 pl-2 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((l) => {
                      const isToday = l.date === today;
                      return (
                        <tr key={l.date} className={isToday ? 'bg-blue-50/60' : undefined} aria-current={isToday ? 'date' : undefined}>
                          <td className={`py-1.5 pr-2 align-top whitespace-nowrap ${isToday ? 'font-semibold text-blue-700' : 'font-medium text-gray-700'}`} title={l.dayLabel}>
                            {l.weekday}
                          </td>
                          <td className="py-1.5 px-2 align-top">
                            {l.holidays.map((h) => (
                              <ScheduleStatusBadge key={h.id} status="holiday" label={h.name} className="mb-1" />
                            ))}
                            {l.status ? (
                              <ScheduleStatusBadge status={l.status.status} label={l.status.label} />
                            ) : l.shifts.length === 0 ? (
                              <span className="text-gray-400">Not Scheduled</span>
                            ) : (
                              l.shifts.map((s, i) => (
                                <div key={s.seg.segment_id ?? `p${i}`} className="whitespace-nowrap text-gray-900">
                                  {formatRange(s.seg)}
                                </div>
                              ))
                            )}
                            {l.partialTimeOff && (
                              <ScheduleStatusBadge status={l.partialTimeOff.status} label={l.partialTimeOff.label} partial className="mt-0.5" />
                            )}
                          </td>
                          <td className="py-1.5 pl-2 align-top">
                            {l.status || l.shifts.length === 0 ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              l.shifts.map((s, i) => (
                                <div key={s.seg.segment_id ?? `p${i}`} className="flex items-center gap-1.5 whitespace-nowrap text-gray-700">
                                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.store?.color ?? neutral }} aria-hidden="true" />
                                  {s.store?.name ?? '—'}
                                </div>
                              ))
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {total && (
              <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
                <span className="font-medium text-gray-700">Total Scheduled Hours</span>
                <span className="font-mono font-semibold text-gray-900" title={formatScheduledDuration(total.total_seconds)}>
                  {formatScheduledHoursLabel(total.total_seconds)}
                </span>
              </div>
            )}
            {total && (total.overlap_seconds ?? 0) > 0 && (
              <p className="mt-1 text-xs text-amber-700">Some of your scheduled times overlap; overlapping time is counted once.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default WeeklyScheduleCard;
