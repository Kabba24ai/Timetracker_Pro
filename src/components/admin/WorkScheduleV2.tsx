import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { AdminEmployee, fetchEmployees } from '../../lib/admin';
import {
  Cells,
  EmployeeView,
  ScheduleSegmentCell,
  ScheduleView,
  StoreMeta,
  StoreView,
  fetchEmployeeView,
  fetchStoreView,
  formatRange,
} from '../../lib/schedule';
import ScheduleCellModal, { CellDraft } from './ScheduleCellModal';

type Mode = 'store' | 'employee';

const VIEWS: { id: ScheduleView; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'next_week', label: 'Next Week' },
  { id: 'month', label: 'Month' },
];

// Light tint of a hex color for backgrounds (keeps the store name readable).
const tint = (hex: string) => `${hex}14`; // ~8% alpha
const chip = (hex: string): React.CSSProperties => ({ backgroundColor: `${hex}1f`, color: hex, borderColor: `${hex}55` });

const WorkScheduleV2: React.FC = () => {
  const [mode, setMode] = useState<Mode>('store');
  const [view, setView] = useState<ScheduleView>('this_week');
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [userId, setUserId] = useState<number | null>(null);

  const [store, setStore] = useState<StoreView | null>(null);
  const [emp, setEmp] = useState<EmployeeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CellDraft | null>(null);
  const [extraRows, setExtraRows] = useState<Record<number, number[]>>({}); // storeId → [userId] added locally

  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => {});
  }, []);

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

  const storesById = useMemo(() => {
    const src = mode === 'store' ? store?.stores : emp?.stores;
    return new Map((src ?? []).map((s) => [s.id, s]));
  }, [mode, store, emp]);

  const dates = (mode === 'store' ? store?.dates : emp?.dates) ?? [];
  const empName = (id: number) => employees.find((e) => e.id === id)?.full_name ?? `#${id}`;

  const defaultTimes = (s: StoreMeta, dow: number): [string, string] => {
    const h = s.hours[dow];
    return h && !h.closed && h.start && h.end ? [h.start, h.end] : ['09:00', '17:00'];
  };

  const openCell = (s: StoreMeta, uid: number, name: string, date: string, dow: number, seg?: ScheduleSegmentCell) => {
    const [ds, de] = defaultTimes(s, dow);
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
    load();
  };

  const Cell: React.FC<{ s: StoreMeta; uid: number; name: string; date: string; dow: number; segs: ScheduleSegmentCell[] }> = ({ s, uid, name, date, dow, segs }) => (
    <td className="px-1 py-1 align-top border-l border-gray-100 min-w-[7.5rem]">
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
      <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-medium min-w-[11rem]">Employee</th>
      {dates.map((d) => (
        <th key={d.date} className="px-2 py-2 font-medium border-l border-gray-100 min-w-[7.5rem] whitespace-nowrap">
          {d.weekday_label}
          <span className="block text-[10px] font-normal text-gray-400">{d.date.slice(5)}</span>
        </th>
      ))}
    </tr>
  );

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

        <button onClick={load} className="ml-auto flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {(store || emp) && (
        <p className="text-sm text-gray-500 mb-1">{(mode === 'store' ? store?.range.label : emp?.range.label) ?? ''}</p>
      )}
      <p className="text-xs text-gray-400 mb-4">
        Click a time to edit, or a blank cell to schedule. All times in {(mode === 'store' ? store?.range.timezone : emp?.range.timezone) ?? 'tenant tz'} (tenant timezone). Weeks begin Monday.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Store View — one section per store. */}
      {mode === 'store' && store && (
        <div className="space-y-6">
          {store.stores.map((s) => {
            const section = store.store_view.find((v) => v.store_id === s.id);
            const rows = section?.rows ?? [];
            const inSection = new Set(rows.map((r) => r.employee.id));
            const extras = (extraRows[s.id] ?? []).filter((id) => !inSection.has(id));
            const addable = store.employees.filter((e) => !inSection.has(e.id) && !extras.includes(e.id));

            return (
              <div key={s.id} className="border rounded-lg overflow-hidden" style={{ borderLeft: `4px solid ${s.color}` }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: tint(s.color) }}>
                  <h3 className="text-base font-semibold" style={{ color: s.color }}>{s.name}</h3>
                  {addable.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Plus className="h-4 w-4" />
                      <select
                        value=""
                        onChange={(e) => e.target.value && setExtraRows((prev) => ({ ...prev, [s.id]: [...(prev[s.id] ?? []), Number(e.target.value)] }))}
                        className="border border-gray-300 rounded px-2 py-1 bg-white text-sm"
                        aria-label={`Add employee to ${s.name}`}
                      >
                        <option value="">Add employee…</option>
                        {addable.map((e) => (
                          <option key={e.id} value={e.id}>{e.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead className="bg-gray-50">{HeaderRow}</thead>
                    <tbody className="divide-y divide-gray-100">
                      {[...rows, ...extras.map((id) => ({ employee: { id, full_name: empName(id) }, cells: {} as Cells }))].map((r) => (
                        <tr key={r.employee.id} className="hover:bg-gray-50/40">
                          <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.employee.full_name}</td>
                          {dates.map((d) => (
                            <Cell key={d.date} s={s} uid={r.employee.id} name={r.employee.full_name} date={d.date} dow={d.day_of_week} segs={r.cells[d.date] ?? []} />
                          ))}
                        </tr>
                      ))}
                      {rows.length === 0 && extras.length === 0 && (
                        <tr>
                          <td colSpan={dates.length + 1} className="px-4 py-6 text-center text-gray-400 text-sm">No one scheduled at {s.name} this range. Use “Add employee”.</td>
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
                          <Cell key={d.date} s={s} uid={emp.employee.id} name={emp.employee.full_name} date={d.date} dow={d.day_of_week} segs={row?.cells[d.date] ?? []} />
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

      {draft && <ScheduleCellModal draft={draft} onClose={() => setDraft(null)} onSaved={onSaved} />}
    </div>
  );
};

export default WorkScheduleV2;
