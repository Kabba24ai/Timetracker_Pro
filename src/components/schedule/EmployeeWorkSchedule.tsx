import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  Cells,
  EmployeeView,
  ScheduleDate,
  ScheduleSegmentCell,
  ScheduleView,
  StoreMeta,
  StoreView,
  TimeOffCell,
  TimeOffOverlay,
  fetchAllSchedule,
  fetchMyEmployeeSchedule,
  formatRange,
} from '../../lib/schedule';
import ScheduleStatusBadge from './ScheduleStatusBadge';

// The employee READ-ONLY Work Schedule: the Admin Work Schedule, view only.
// "Employee Only" (default) answers "when do I work?"; "All Employees" answers
// "who am I working with?". Approved Vacation / Unpaid Time Off / Time Off and
// explicit Day Off are shown as read-time overlays over the canonical schedule.
// There are NO edit, assign, group, remove, or save controls anywhere here.

type Mode = 'me' | 'all';

const VIEWS: { id: ScheduleView; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'next_week', label: 'Next Week' },
  { id: 'month', label: 'Month' },
];

const chip = (hex: string): React.CSSProperties => ({ backgroundColor: `${hex}1f`, color: hex, borderColor: `${hex}55` });
const tint = (hex: string) => `${hex}14`;

/** Read-only cell content: absence badge (full-day) replaces the shift; a partial
 *  absence keeps the shift plus a partial tag; day-off and blank are distinct. */
const CellContent: React.FC<{
  segs: ScheduleSegmentCell[];
  color: string;
  timeOff?: TimeOffCell;
  dayOff?: boolean;
}> = ({ segs, color, timeOff, dayOff }) => {
  if (timeOff && timeOff.is_full_day) {
    return <ScheduleStatusBadge status={timeOff.status} label={timeOff.label} />;
  }
  if (segs.length > 0) {
    return (
      <div className="space-y-1">
        {segs.map((seg, i) => (
          <span
            key={seg.segment_id ?? `p${i}`}
            style={chip(color)}
            className="block px-2 py-1 rounded border text-xs font-medium whitespace-nowrap"
          >
            {formatRange(seg)}
          </span>
        ))}
        {timeOff && !timeOff.is_full_day && (
          <ScheduleStatusBadge status={timeOff.status} label={timeOff.label} partial className="mt-0.5" />
        )}
      </div>
    );
  }
  if (dayOff) {
    return <ScheduleStatusBadge status="day_off" />;
  }
  return <span className="text-gray-300 text-xs">—</span>;
};

const HeaderCells: React.FC<{ dates: ScheduleDate[]; firstLabel: string }> = ({ dates, firstLabel }) => (
  <tr className="text-gray-500">
    <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-medium min-w-[11rem]">{firstLabel}</th>
    {dates.map((d) => (
      <th key={d.date} className="px-2 py-2 font-medium border-l border-gray-100 min-w-[7.5rem] whitespace-nowrap">
        {d.weekday_label}
        <span className="block text-[10px] font-normal text-gray-400">{d.date.slice(5)}</span>
      </th>
    ))}
  </tr>
);

const EmployeeWorkSchedule: React.FC = () => {
  const [mode, setMode] = useState<Mode>('me');
  const [view, setView] = useState<ScheduleView>('this_week');
  const [emp, setEmp] = useState<EmployeeView | null>(null);
  const [all, setAll] = useState<StoreView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'me') {
        setEmp(await fetchMyEmployeeSchedule({ view }));
      } else {
        setAll(await fetchAllSchedule({ view }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }, [mode, view]);

  useEffect(() => {
    load();
  }, [load]);

  const active = mode === 'me' ? emp : all;
  const dates = active?.dates ?? [];
  const rangeLabel = active?.range.label ?? '';
  const timezone = active?.range.timezone ?? '';
  const storeById = useMemo(() => {
    const m = new Map<number, StoreMeta>();
    (active?.stores ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [active]);

  // ── Employee Only: one row per store, whole-day states shown across rows ──
  const empRows = useMemo(() => {
    if (!emp) return [] as { store: StoreMeta | null; cells: Cells }[];
    const rows = emp.employee_view.map((r) => ({ store: storeById.get(r.store_id) ?? null, cells: r.cells }));
    // If there are no scheduled segments but there ARE whole-day states (day off /
    // approved time off), still show a single row so they are visible.
    if (rows.length === 0 && (emp.day_offs.length > 0 || Object.keys(emp.time_off ?? {}).length > 0)) {
      return [{ store: emp.stores[0] ?? null, cells: {} as Cells }];
    }
    return rows;
  }, [emp, storeById]);

  const empDayOffs = useMemo(() => new Set(emp?.day_offs ?? []), [emp]);
  const empTimeOff: TimeOffOverlay = emp?.time_off ?? {};

  const hasEmpContent = empRows.length > 0;
  const hasAllContent = (all?.store_view ?? []).some((s) => s.rows.length > 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Schedule scope">
          <button
            onClick={() => setMode('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            All Employees
          </button>
          <button
            onClick={() => setMode('me')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'me' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Employee Only
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Date range">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === v.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button onClick={load} className="ml-auto flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {rangeLabel && <p className="text-sm text-gray-500 mb-1">{rangeLabel}</p>}
      <p className="text-xs text-gray-400 mb-4">
        {mode === 'me' ? 'Your schedule across every store.' : 'Everyone’s schedule by store.'} All times in {timezone || 'tenant tz'} (tenant timezone). Weeks begin Monday.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Employee Only */}
      {mode === 'me' && emp && (
        hasEmpContent ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <HeaderCells dates={dates} firstLabel="Store" />
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {empRows.map((row, ri) => {
                    const color = row.store?.color ?? '#94a3b8';
                    return (
                      <tr key={row.store?.id ?? `r${ri}`} className="hover:bg-gray-50/40">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium whitespace-nowrap" style={{ color }}>
                          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: color }} />
                          {row.store?.name ?? 'Schedule'}
                        </td>
                        {dates.map((d) => (
                          <td key={d.date} className="px-1 py-1 align-top border-l border-gray-100 min-w-[7.5rem]">
                            <CellContent
                              segs={row.cells[d.date] ?? []}
                              color={color}
                              timeOff={empTimeOff[d.date]}
                              dayOff={empDayOffs.has(d.date)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-12 text-sm">No scheduled shifts for this period.</p>
        )
      )}

      {/* All Employees — read-only Store View */}
      {mode === 'all' && all && (
        hasAllContent ? (
          <div className="space-y-6">
            {all.stores.map((s) => {
              const section = all.store_view.find((v) => v.store_id === s.id);
              const rows = section?.rows ?? [];
              if (rows.length === 0) return null;
              return (
                <div key={s.id} className="border rounded-lg overflow-hidden" style={{ borderLeft: `4px solid ${s.color}` }}>
                  <div className="px-4 py-2" style={{ backgroundColor: tint(s.color) }}>
                    <h3 className="text-base font-semibold" style={{ color: s.color }}>{s.name}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border-collapse">
                      <thead className="bg-gray-50">
                        <HeaderCells dates={dates} firstLabel="Employee" />
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r) => (
                          <tr key={r.employee.id} className="hover:bg-gray-50/40">
                            <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                              {r.employee.full_name}
                            </td>
                            {dates.map((d) => (
                              <td key={d.date} className="px-1 py-1 align-top border-l border-gray-100 min-w-[7.5rem]">
                                <CellContent segs={r.cells[d.date] ?? []} color={s.color} timeOff={r.time_off?.[d.date]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-12 text-sm">No scheduled shifts for this period.</p>
        )
      )}
    </div>
  );
};

export default EmployeeWorkSchedule;
