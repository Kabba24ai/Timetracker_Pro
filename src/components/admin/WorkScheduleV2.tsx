import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarPlus, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { AdminEmployee, fetchEmployees } from '../../lib/admin';
import {
  AssignmentResult,
  Cells,
  DayStatusCell,
  EmployeeView,
  Holiday,
  HolidayMarker,
  ScheduleGroup,
  ScheduleSegmentCell,
  ScheduleView,
  StoreMeta,
  StoreView,
  TimeOffCell,
  applyGroup,
  assignEmployee,
  fetchEmployeeView,
  fetchGroups,
  fetchHolidays,
  fetchStoreView,
  formatRange,
  removeFromStore,
} from '../../lib/schedule';
import ScheduleCellModal, { CellDraft } from './ScheduleCellModal';
import ScheduleHolidayModal from './ScheduleHolidayModal';
import ScheduleGroupsModal from './ScheduleGroupsModal';
import ScheduleStatusBadge from '../schedule/ScheduleStatusBadge';

type Mode = 'store' | 'employee';

const VIEWS: { id: ScheduleView; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'next_week', label: 'Next Week' },
  { id: 'month', label: 'Month' },
];

// Light tint of a hex color for backgrounds (keeps the store name readable).
const tint = (hex: string) => `${hex}14`; // ~8% alpha
const chip = (hex: string): React.CSSProperties => ({ backgroundColor: `${hex}1f`, color: hex, borderColor: `${hex}55` });

// The result of an assign / apply-group action, tagged with a human label.
type ActionResult = { title: string; result: AssignmentResult };

const WorkScheduleV2: React.FC = () => {
  const [mode, setMode] = useState<Mode>('store');
  const [view, setView] = useState<ScheduleView>('this_week');
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [userId, setUserId] = useState<number | null>(null);

  const [store, setStore] = useState<StoreView | null>(null);
  const [emp, setEmp] = useState<EmployeeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionResult | null>(null);
  const [draft, setDraft] = useState<CellDraft | null>(null);
  const [cellStatus, setCellStatus] = useState<DayStatusCell | null>(null);
  const [manageGroups, setManageGroups] = useState(false);
  // The global-holiday editor. `null` = closed; `{existing: null}` = add.
  // `employee`/`date` are set when it was opened from an employee CELL, so the
  // removal step can offer "just this person" as well as "everyone".
  const [holidayDraft, setHolidayDraft] = useState<{
    existing: Holiday | null;
    employee?: { id: number; name: string } | null;
    date?: string;
  } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ storeId: number; userId: number; employeeName: string; storeName: string } | null>(null);

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => {});
  }, []);

  const loadGroups = useCallback(() => {
    fetchGroups().then(setGroups).catch(() => {});
  }, []);
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'store') {
        setStore(await fetchStoreView({ view }));
      } else if (userId) {
        setEmp(await fetchEmployeeView(userId, { view }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }, [mode, view, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const rangeLabel = (mode === 'store' ? store?.range.label : emp?.range.label) ?? '';

  const run = async (title: string, fn: () => Promise<AssignmentResult>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      setAction({ title, result });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'The scheduling action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const addEmployee = (s: StoreMeta, uid: number) => {
    const name = employees.find((e) => e.id === uid)?.full_name ?? `#${uid}`;
    run(`Scheduled ${name} at ${s.name}`, () => assignEmployee({ user_id: uid, store_id: s.id, view }));
  };

  const addGroup = (s: StoreMeta, groupId: number) => {
    const g = groups.find((x) => x.id === groupId);
    run(`Applied ${g?.name ?? 'group'} to ${s.name}`, () => applyGroup(groupId, { store_id: s.id, view }));
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const { storeId, userId: uid, employeeName, storeName } = removeTarget;
    setRemoveTarget(null);
    setBusy(true);
    setError(null);
    try {
      const removed = await removeFromStore({ user_id: uid, store_id: storeId, view });
      setAction({ title: `Removed ${employeeName} from ${storeName}`, result: { created: 0, already_scheduled: 0, day_off_skipped: 0, days_off: [], conflict_count: 0, conflicts: [], removed } as AssignmentResult & { removed: number } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not remove the employee from the schedule.');
    } finally {
      setBusy(false);
    }
  };

  const dates = (mode === 'store' ? store?.dates : emp?.dates) ?? [];
  const empName = (id: number) => employees.find((e) => e.id === id)?.full_name ?? `#${id}`;

  const defaultTimes = (s: StoreMeta, dow: number): [string, string] => {
    const h = s.hours[dow];
    return h && !h.closed && h.start && h.end ? [h.start, h.end] : ['09:00', '17:00'];
  };

  const openCell = (s: StoreMeta, uid: number, name: string, date: string, dow: number, seg?: ScheduleSegmentCell, dayStatus?: DayStatusCell) => {
    const [ds, de] = defaultTimes(s, dow);
    setCellStatus(dayStatus ?? null);
    setDraft({
      userId: uid,
      employeeName: name,
      storeId: s.id,
      storeName: s.name,
      storeColor: s.color,
      date,
      segmentId: seg?.segment_id ?? null,
      start24: seg?.start ?? ds,
      end24: seg?.end ?? de,
    });
  };

  const onSaved = () => {
    setDraft(null);
    setCellStatus(null);
    load();
  };

  const onHolidaySaved = () => {
    setHolidayDraft(null);
    load();
  };

  // Editing a projected holiday badge: fetch the canonical row (name + full
  // range + store scope) so the editor never guesses from one projected date.
  const openHoliday = async (id: number, employee?: { id: number; name: string }, date?: string) => {
    const from = store?.range.from ?? emp?.range.from;
    const to = store?.range.to ?? emp?.range.to;
    if (!from || !to) return;
    try {
      const found = (await fetchHolidays({ from, to })).find((h) => h.id === id) ?? null;
      setHolidayDraft({ existing: found, employee: employee ?? null, date });
    } catch {
      setHolidayDraft({ existing: null, employee: employee ?? null, date });
    }
  };

  // Admin cells stay editable; an approved absence is shown as a small display-
  // only tag so a scheduling manager sees it without losing the edit affordance.
  // (Vacation Management remains the only place to change time off.)
  //
  // Three display layers stack ABOVE the schedule chip, never replacing it:
  //   holidays  — global/store context; coexists with everything, click to edit
  //   dayStatus — the manager's explicit expectation; when present it OWNS the
  //               employee-status slot, so the approved-time-off tag steps aside
  //               and the same absence is never badged twice
  //   timeOff   — the pre-existing approved-time-off overlay
  const Cell: React.FC<{
    s: StoreMeta;
    uid: number;
    name: string;
    date: string;
    dow: number;
    segs: ScheduleSegmentCell[];
    timeOff?: TimeOffCell;
    dayStatus?: DayStatusCell;
    holidays?: HolidayMarker[];
  }> = ({ s, uid, name, date, dow, segs, timeOff, dayStatus, holidays }) => (
    <td className="px-1 py-1 align-top border-l border-gray-100 min-w-[7.5rem]">
      {(holidays ?? []).map((h) => (
        <div key={h.id} className="mb-1">
          <button
            type="button"
            onClick={() => void openHoliday(h.id, { id: uid, name }, date)}
            className="w-full text-left"
            title="Holiday — click to edit or remove"
          >
            <ScheduleStatusBadge status="holiday" label={h.name} className="w-full justify-center" />
          </button>
        </div>
      ))}
      {dayStatus ? (
        <div className="mb-1">
          <button
            type="button"
            onClick={() => openCell(s, uid, name, date, dow, undefined, dayStatus)}
            className="w-full text-left"
            title="Schedule status — click to change or remove"
          >
            <ScheduleStatusBadge status={dayStatus.status} label={dayStatus.label} className="w-full justify-center" />
          </button>
        </div>
      ) : (
        timeOff && (
          <div className="mb-1">
            <ScheduleStatusBadge status={timeOff.status} label={timeOff.label} partial={!timeOff.is_full_day} />
          </div>
        )
      )}
      {segs.length === 0 ? (
        <button
          onClick={() => openCell(s, uid, name, date, dow)}
          className="w-full h-9 rounded border border-dashed border-gray-200 text-gray-300 hover:text-blue-500 hover:border-blue-300 text-xs transition-colors"
          title="Add schedule"
          aria-label={`Add ${name} ${s.name} ${date}`}
        >
          +
        </button>
      ) : (
        <div className="space-y-1">
          {segs.map((seg, i) => (
            <button
              key={seg.segment_id ?? `p${i}`}
              onClick={() => openCell(s, uid, name, date, dow, seg)}
              style={chip(s.color)}
              className="w-full px-2 py-1 rounded border text-xs font-medium whitespace-nowrap hover:brightness-95 transition"
              title="Edit schedule"
            >
              {formatRange(seg)}
            </button>
          ))}
        </div>
      )}
    </td>
  );

  const HeaderRow = (
    <tr className="text-gray-500">
      <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-medium min-w-[13rem]">Employee</th>
      {dates.map((d) => (
        <th key={d.date} className="px-2 py-2 font-medium border-l border-gray-100 min-w-[7.5rem] whitespace-nowrap">
          {d.weekday_label}
          <span className="block text-[10px] font-normal text-gray-400">{d.date.slice(5)}</span>
        </th>
      ))}
    </tr>
  );

  const removedCount = (r: AssignmentResult) => (r as AssignmentResult & { removed?: number }).removed;

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(['store', 'employee'] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {m === 'store' ? 'Store View' : 'Employee View'}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-4 py-2 text-sm font-medium transition-colors ${view === v.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {v.label}
            </button>
          ))}
        </div>

        {mode === 'employee' && (
          <select
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem]"
          >
            <option value="">Select an employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        )}

        {mode === 'store' && (
          <button onClick={() => setManageGroups(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Users className="h-4 w-4" />
            <span>Manage Groups</span>
          </button>
        )}

        {mode === 'store' && (
          <button
            onClick={() => setHolidayDraft({ existing: null })}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Mark a store-wide holiday (display only — it never changes anyone's hours)"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>+ Holiday</span>
          </button>
        )}

        <button onClick={load} className="ml-auto flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading || busy ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {(store || emp) && <p className="text-sm text-gray-500 mb-1">{rangeLabel}</p>}
      <p className="text-xs text-gray-400 mb-4">
        Adding an employee or group schedules them for the store’s hours across this range (a default you can then edit). All times in {(mode === 'store' ? store?.range.timezone : emp?.range.timezone) ?? 'tenant tz'} (tenant timezone). Weeks begin Monday.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Result / conflict banner. */}
      {action && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3" role="status">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{action.title}.</span>{' '}
              {removedCount(action.result) !== undefined ? (
                <span>Removed {removedCount(action.result)} scheduled day{removedCount(action.result) === 1 ? '' : 's'}.</span>
              ) : (
                <span>
                  Created {action.result.created} schedule segment{action.result.created === 1 ? '' : 's'};{' '}
                  {action.result.already_scheduled} already scheduled;{' '}
                  {action.result.day_off_skipped} day{action.result.day_off_skipped === 1 ? '' : 's'} off skipped;{' '}
                  {action.result.conflict_count} conflict{action.result.conflict_count === 1 ? '' : 's'}.
                </span>
              )}
              {action.result.conflicts.length > 0 && (
                <ul className="mt-2 list-disc pl-5 space-y-0.5 text-amber-700">
                  {action.result.conflicts.map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setAction(null)} className="text-blue-400 hover:text-blue-600 text-sm shrink-0" aria-label="Dismiss">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Store View — one section per store. */}
      {mode === 'store' && store && (
        <div className="space-y-6">
          {store.stores.map((s) => {
            const section = store.store_view.find((v) => v.store_id === s.id);
            const rows = section?.rows ?? [];
            const inSection = new Set(rows.map((r) => r.employee.id));
            const addable = store.employees.filter((e) => !inSection.has(e.id));

            return (
              <div key={s.id} className="border rounded-lg overflow-hidden" style={{ borderLeft: `4px solid ${s.color}` }}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2" style={{ backgroundColor: tint(s.color) }}>
                  <h3 className="text-base font-semibold" style={{ color: s.color }}>{s.name}</h3>
                  <div className="flex items-center gap-2">
                    {addable.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Plus className="h-4 w-4" />
                        <select
                          value=""
                          disabled={busy}
                          onChange={(e) => e.target.value && addEmployee(s, Number(e.target.value))}
                          className="border border-gray-300 rounded px-2 py-1 bg-white text-sm disabled:opacity-50"
                          aria-label={`Add employee to ${s.name}`}
                        >
                          <option value="">Add employee…</option>
                          {addable.map((e) => (
                            <option key={e.id} value={e.id}>{e.full_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Plus className="h-4 w-4" />
                      <select
                        value=""
                        disabled={busy || groups.length === 0}
                        onChange={(e) => e.target.value && addGroup(s, Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 bg-white text-sm disabled:opacity-50"
                        aria-label={`Add group to ${s.name}`}
                      >
                        <option value="">{groups.length === 0 ? 'No groups' : 'Add group…'}</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead className="bg-gray-50">{HeaderRow}</thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.employee.id} className="hover:bg-gray-50/40">
                          <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <span>{r.employee.full_name}</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setRemoveTarget({ storeId: s.id, userId: r.employee.id, employeeName: r.employee.full_name, storeName: s.name })}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                                aria-label={`Remove ${r.employee.full_name} from ${s.name}`}
                                title={`Remove ${r.employee.full_name} from ${s.name} for this range`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Remove</span>
                              </button>
                            </div>
                          </td>
                          {dates.map((d) => (
                            <Cell key={d.date} s={s} uid={r.employee.id} name={r.employee.full_name} date={d.date} dow={d.day_of_week} segs={r.cells[d.date] ?? []} timeOff={r.time_off?.[d.date]} dayStatus={r.day_status?.[d.date]} holidays={r.holidays?.[d.date]} />
                          ))}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={dates.length + 1} className="px-4 py-6 text-center text-gray-400 text-sm">No one scheduled at {s.name} this range. Use “Add employee” or “Add group”.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Employee View — one row per store. */}
      {mode === 'employee' && (
        !userId ? (
          <p className="text-gray-500 text-center py-12">Select an employee to see their schedule across all stores.</p>
        ) : emp ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500">
                    <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-medium min-w-[11rem]">Store</th>
                    {dates.map((d) => (
                      <th key={d.date} className="px-2 py-2 font-medium border-l border-gray-100 min-w-[7.5rem] whitespace-nowrap">
                        {d.weekday_label}
                        <span className="block text-[10px] font-normal text-gray-400">{d.date.slice(5)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {emp.stores.map((s) => {
                    const row = emp.employee_view.find((v) => v.store_id === s.id);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/40">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium whitespace-nowrap" style={{ color: s.color }}>
                          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </td>
                        {dates.map((d) => (
                          <Cell key={d.date} s={s} uid={emp.employee.id} name={emp.employee.full_name} date={d.date} dow={d.day_of_week} segs={row?.cells[d.date] ?? []} timeOff={emp.time_off?.[d.date]} dayStatus={emp.day_status?.[d.date]} holidays={row?.holidays?.[d.date]} />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null
      )}

      {draft && (
        <ScheduleCellModal
          draft={draft}
          stores={(mode === 'store' ? store?.stores : emp?.stores) ?? []}
          dayStatus={cellStatus}
          onClose={() => setDraft(null)}
          onSaved={onSaved}
        />
      )}
      {holidayDraft && (
        <ScheduleHolidayModal
          stores={(mode === 'store' ? store?.stores : emp?.stores) ?? []}
          date={holidayDraft.date ?? dates[0]?.date ?? (store?.range.from ?? emp?.range.from ?? '')}
          existing={holidayDraft.existing}
          employee={holidayDraft.employee}
          onClose={() => setHolidayDraft(null)}
          onSaved={onHolidaySaved}
        />
      )}
      {manageGroups && <ScheduleGroupsModal employees={store?.employees ?? employees.map((e) => ({ id: e.id, full_name: e.full_name }))} onClose={() => setManageGroups(false)} onChanged={loadGroups} />}

      {/* Remove-from-schedule confirmation. */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRemoveTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove from schedule</h3>
            <p className="text-sm text-gray-600 mb-5">
              Remove <span className="font-medium">{removeTarget.employeeName}</span> from <span className="font-medium">{removeTarget.storeName}</span> for {rangeLabel}? This removes only this store’s scheduled days in the current range.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRemoveTarget(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={confirmRemove} className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 text-sm">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkScheduleV2;
