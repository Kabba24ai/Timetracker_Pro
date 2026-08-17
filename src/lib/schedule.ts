// TimeTracker V2 — Work Schedule admin API layer.
//
// The canonical schedule is a DATED operational calendar: ONE ROW = ONE EMPLOYEE
// AT ONE STORE. Store View and Employee View both read the same segment data;
// the server owns resolution, overlap validation, store-hours defaults, and
// tenant-timezone interpretation. This layer only shuttles data.

import { api, ApiEnvelope } from './api';

export type ScheduleView = 'this_week' | 'next_week' | 'month';

export interface ScheduleRangeInfo {
  from: string;
  to: string;
  view: string;
  label: string;
  timezone: string;
}

export interface ScheduleDate {
  date: string; // YYYY-MM-DD
  day_of_week: number; // 0=Sun … 6=Sat
  weekday_label: string; // 'Mon'
  day_label: string; // 'Mon, Sep 14'
}

export interface StoreDayHours {
  start: string | null; // 'HH:MM'
  end: string | null;
  closed: boolean;
}

export interface StoreMeta {
  id: number;
  name: string;
  color: string; // hex
  hours: Record<number, StoreDayHours>; // keyed by day_of_week
}

export interface ScheduleSegmentCell {
  segment_id: number | null; // null when projected from a recurring rule
  store_id: number;
  start: string; // 'HH:MM' tenant wall clock
  end: string;
  overnight: boolean;
  editable: boolean;
}

export type Cells = Record<string, ScheduleSegmentCell[]>; // date → segments

export interface StoreViewSection {
  store_id: number;
  rows: { employee: { id: number; full_name: string }; cells: Cells }[];
}

export interface StoreView {
  range: ScheduleRangeInfo;
  dates: ScheduleDate[];
  stores: StoreMeta[];
  employees: { id: number; full_name: string }[];
  store_view: StoreViewSection[];
}

export interface EmployeeView {
  range: ScheduleRangeInfo;
  employee: { id: number; full_name: string };
  dates: ScheduleDate[];
  stores: StoreMeta[];
  employee_view: { store_id: number; cells: Cells }[];
  day_offs: string[];
}

interface ViewParams {
  view?: ScheduleView;
  anchor?: string;
  from?: string;
  to?: string;
}

function qs(params: ViewParams): string {
  const p = new URLSearchParams();
  if (params.from && params.to) {
    p.set('from', params.from);
    p.set('to', params.to);
  } else {
    if (params.view) p.set('view', params.view);
    if (params.anchor) p.set('anchor', params.anchor);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function fetchStoreView(params: ViewParams): Promise<StoreView> {
  const res = (await api.get(`/admin/schedule/store-view${qs(params)}`)) as ApiEnvelope & StoreView;
  return {
    range: res.range,
    dates: res.dates ?? [],
    stores: res.stores ?? [],
    employees: res.employees ?? [],
    store_view: res.store_view ?? [],
  };
}

export async function fetchEmployeeView(userId: number, params: ViewParams): Promise<EmployeeView> {
  const res = (await api.get(`/admin/schedule/employee-view/${userId}${qs(params)}`)) as ApiEnvelope & EmployeeView;
  return {
    range: res.range,
    employee: res.employee,
    dates: res.dates ?? [],
    stores: res.stores ?? [],
    employee_view: res.employee_view ?? [],
    day_offs: res.day_offs ?? [],
  };
}

export interface SegmentInput {
  user_id: number;
  store_id: number;
  date: string;
  start_time?: string; // 'HH:MM'; omitted → store hours default
  end_time?: string;
}

export async function createSegment(input: SegmentInput): Promise<void> {
  await api.post('/admin/schedule/segments', input);
}

export async function updateSegment(id: number, times: { start_time: string; end_time: string; store_id?: number }): Promise<void> {
  await api.put(`/admin/schedule/segments/${id}`, times);
}

export async function deleteSegment(id: number): Promise<void> {
  await api.del(`/admin/schedule/segments/${id}`);
}

// ── Rapid scheduling: assign / remove / groups ────────────────────────────
//
// "Add Employee" and "Add Group" are real scheduling actions: the server fills
// each open store day with the store's operating hours (a default, never a
// clamp) and returns a created / already-scheduled / conflicts summary. The
// range is the one currently displayed (same view the grid was loaded with) so
// the scope always matches what the admin sees.

export interface RangeBody {
  view?: ScheduleView;
  anchor?: string;
  from?: string;
  to?: string;
}

export interface AssignmentConflict {
  employee: string;
  date: string;
  message: string; // 'Gary Jezorski — Tue Sep 15 overlaps Waverly 7:00–12:00'
}

export interface AssignmentResult {
  created: number;
  already_scheduled: number;
  day_off_skipped: number;
  days_off: { employee: string; date: string }[];
  conflict_count: number;
  conflicts: AssignmentConflict[];
}

/** Schedule one employee at a store for the displayed range (store hours default). */
export async function assignEmployee(input: { user_id: number; store_id: number } & RangeBody): Promise<AssignmentResult> {
  const res = (await api.post('/admin/schedule/assign', input)) as ApiEnvelope & { result: AssignmentResult };
  return res.result;
}

/** Remove an employee from ONE store's schedule for the displayed range only. Returns removed count. */
export async function removeFromStore(input: { user_id: number; store_id: number } & RangeBody): Promise<number> {
  const res = (await api.post('/admin/schedule/remove-from-store', input)) as ApiEnvelope & { removed: number };
  return res.removed ?? 0;
}

export interface ScheduleGroup {
  id: number;
  name: string;
  store_id: number | null;
  active: boolean;
  members: { id: number; full_name: string }[];
}

export async function fetchGroups(): Promise<ScheduleGroup[]> {
  const res = (await api.get('/admin/schedule/groups')) as ApiEnvelope & { groups: ScheduleGroup[] };
  return res.groups ?? [];
}

export async function createGroup(input: { name: string; store_id?: number | null; member_ids: number[] }): Promise<ScheduleGroup> {
  const res = (await api.post('/admin/schedule/groups', input)) as ApiEnvelope & { group: ScheduleGroup };
  return res.group;
}

export async function updateGroup(id: number, input: { name?: string; store_id?: number | null; active?: boolean; member_ids?: number[] }): Promise<ScheduleGroup> {
  const res = (await api.put(`/admin/schedule/groups/${id}`, input)) as ApiEnvelope & { group: ScheduleGroup };
  return res.group;
}

export async function deleteGroup(id: number): Promise<void> {
  await api.del(`/admin/schedule/groups/${id}`);
}

/** Apply a group to a store across the displayed range. */
export async function applyGroup(id: number, input: { store_id: number } & RangeBody): Promise<AssignmentResult> {
  const res = (await api.post(`/admin/schedule/groups/${id}/apply`, input)) as ApiEnvelope & { result: AssignmentResult };
  return res.result;
}

/** Format 'HH:MM' (24h) as a 12-hour label, e.g. '7:00 AM'. */
export function formatWall(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Compact range label, e.g. '7:00 AM – 5:00 PM'. */
export function formatRange(seg: ScheduleSegmentCell): string {
  return `${formatWall(seg.start)} – ${formatWall(seg.end)}${seg.overnight ? ' (+1)' : ''}`;
}
