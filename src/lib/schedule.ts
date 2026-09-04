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

// Approved-time-off display overlay for one employee/date. Presentation only —
// the underlying schedule is never changed; a cancelled request simply stops
// appearing. Only the two employee-facing types are named; every other approved
// type collapses to the privacy-safe generic "Time Off".
export type TimeOffStatus = 'vacation' | 'unpaid_time_off' | 'time_off';

export interface TimeOffCell {
  status: TimeOffStatus;
  label: string; // 'Vacation' | 'Unpaid Time Off' | 'Time Off'
  is_full_day: boolean;
}

export type TimeOffOverlay = Record<string, TimeOffCell>; // date → overlay

// ── Work Schedule DISPLAY layer (schedule-owned; never payroll) ─────────────
// A day status is the scheduling manager's EXPECTATION for one employee on one
// date. It creates no time-off request, no ledger movement, no balance usage,
// no punch and no shift — the paid side of leave is a separate workflow.
// 'working' is not stored: it means "no status row", i.e. the normal segments.

export type DayStatusCode =
  | 'vacation'
  | 'sick'
  | 'paid_time_off'
  | 'jury_duty'
  | 'bereavement'
  | 'unpaid_time_off'
  | 'holiday';

export type DayStatusSelection = DayStatusCode | 'working';

export interface DayStatusCell {
  // Admin surfaces receive the detailed code. The employee read-only surface
  // receives the server's PRIVACY-SAFE projection, where every sensitive reason
  // (sick, paid_time_off, jury_duty, bereavement) has already been collapsed to
  // 'time_off' server-side — the detail never reaches this client at all.
  status: DayStatusCode | 'time_off';
  label: string;
  // Holiday is contextual and coexists with work; every other status owns the day.
  is_full_day: boolean;
}

export type DayStatusOverlay = Record<string, DayStatusCell>; // date → status

/** The modal's Day Status choices, in the approved order. */
export const DAY_STATUS_OPTIONS: { value: DayStatusSelection; label: string }[] = [
  { value: 'working', label: 'Working' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'paid_time_off', label: 'Paid Time Off' },
  { value: 'jury_duty', label: 'Jury Duty' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'unpaid_time_off', label: 'Unpaid Time Off' },
  { value: 'holiday', label: 'Holiday' },
];

/** Holiday keeps the time controls (people do work holidays); the rest are full-day. */
export function isFullDayStatus(value: DayStatusSelection): boolean {
  return value !== 'working' && value !== 'holiday';
}

export function dayStatusLabel(value: DayStatusSelection): string {
  return DAY_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? 'Working';
}

/** A global store-scoped holiday as projected onto one date. */
export interface HolidayMarker {
  id: number;
  name: string;
}

export type HolidayOverlay = Record<string, HolidayMarker[]>; // date → holidays

export interface Holiday {
  id: number;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // inclusive
  store_ids: number[];
}

export interface StoreViewSection {
  store_id: number;
  // Holidays ride each ROW, not the section: one employee can be excluded from a
  // holiday the rest of the store still observes, and the server has already
  // applied those exclusions.
  rows: {
    employee: { id: number; full_name: string };
    cells: Cells;
    time_off?: TimeOffOverlay;
    day_status?: DayStatusOverlay;
    holidays?: HolidayOverlay;
  }[];
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
  employee_view: { store_id: number; cells: Cells; holidays?: HolidayOverlay }[];
  day_offs: string[];
  time_off?: TimeOffOverlay;
  day_status?: DayStatusOverlay;
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
    time_off: res.time_off ?? {},
    day_status: res.day_status ?? {},
  };
}

// ── Employee READ-ONLY schedule (any authenticated employee) ──────────────────
//
// One canonical endpoint, mode-switched. The logged-in employee is always the
// server-derived user for mode=me (never sent from the client), so there is no
// employee selector and no way to request someone else's scoped view.

/** The authenticated employee's own schedule (one row per store) + approved-time-off overlay. */
export async function fetchMyEmployeeSchedule(params: ViewParams): Promise<EmployeeView> {
  const res = (await api.get(`/schedule?mode=me${qs(params).replace(/^\?/, '&')}`)) as ApiEnvelope & EmployeeView;
  return {
    range: res.range,
    employee: res.employee,
    dates: res.dates ?? [],
    stores: res.stores ?? [],
    employee_view: res.employee_view ?? [],
    day_offs: res.day_offs ?? [],
    time_off: res.time_off ?? {},
    day_status: res.day_status ?? {},
  };
}

/** The read-only roster (Store View) all employees can see, + approved-time-off overlay. */
export async function fetchAllSchedule(params: ViewParams): Promise<StoreView> {
  const res = (await api.get(`/schedule?mode=all${qs(params).replace(/^\?/, '&')}`)) as ApiEnvelope & StoreView;
  return {
    range: res.range,
    dates: res.dates ?? [],
    stores: res.stores ?? [],
    employees: res.employees ?? [],
    store_view: res.store_view ?? [],
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

// ── Day status + holiday writes (schedule display only) ────────────────────

/**
 * Set (or replace) the display status for one employee/date. The SERVER owns the
 * Working → absence transition: saving a full-day status atomically removes that
 * employee's work segments for the date. The client never deletes-then-creates.
 */
export async function setDayStatus(input: { user_id: number; date: string; status: DayStatusCode }): Promise<void> {
  await api.post('/admin/schedule/day-status', input);
}

/** Clear the status — the date returns to the normal blank/unscheduled state. */
export async function clearDayStatus(input: { user_id: number; date: string }): Promise<void> {
  await api.del('/admin/schedule/day-status', input);
}

export async function fetchHolidays(params: { from: string; to: string }): Promise<Holiday[]> {
  const res = (await api.get(`/admin/schedule/holidays?from=${params.from}&to=${params.to}`)) as ApiEnvelope & { holidays?: Holiday[] };
  return res.holidays ?? [];
}

export interface HolidayInput {
  name: string;
  start_date: string;
  end_date: string;
  store_ids: number[];
}

export async function createHoliday(input: HolidayInput): Promise<void> {
  await api.post('/admin/schedule/holidays', input);
}

export async function updateHoliday(id: number, input: HolidayInput): Promise<void> {
  await api.put(`/admin/schedule/holidays/${id}`, input);
}

/**
 * Hide ONE holiday for ONE employee on ONE date. The holiday, its store scope,
 * everyone else's schedule and this employee's work hours are all untouched.
 */
export async function excludeFromHoliday(holidayId: number, input: { user_id: number; date: string }): Promise<void> {
  await api.post(`/admin/schedule/holidays/${holidayId}/exclusions`, input);
}

/** Undo an exclusion — the holiday reappears for that employee/date. */
export async function includeInHoliday(holidayId: number, input: { user_id: number; date: string }): Promise<void> {
  await api.del(`/admin/schedule/holidays/${holidayId}/exclusions`, input);
}

/** Removes ONLY the display marker — work schedules are never touched. */
export async function deleteHoliday(id: number): Promise<void> {
  await api.del(`/admin/schedule/holidays/${id}`);
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
