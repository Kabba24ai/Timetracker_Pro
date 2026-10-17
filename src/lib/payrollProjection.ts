// TimeTracker V2 — Work Schedule payroll PROJECTION (Phase 3).
//
// A projection prices the SAVED work schedule: scheduled hours × the pay rate in
// effect on each scheduled date, with overtime estimated per fixed workweek. It
// is a forecast of gross wages, never a record of wages earned — actual payroll
// cost comes from recorded time (Kabba → Reports → Operation → Payroll). The
// server performs every calculation; this layer only shuttles the figures.

import { api, ApiEnvelope } from './api';

/** Why a figure is, or is not, a number (mirrors the server's CalculationStatus). */
export type ProjectionStatus = 'calculated' | 'not_set' | 'not_classified' | 'salary' | 'incomplete';

export interface ProjectionFigures {
  scheduled_seconds: number; // elapsed scheduled time, before unpaid lunch
  unpaid_lunch_seconds: number; // configured unpaid lunch removed from it
  paid_seconds: number; // = regular + overtime
  regular_seconds: number;
  overtime_seconds: number;
  regular_cents: number;
  overtime_cents: number;
  total_cents: number;
  regular_display: string; // '$1,234.56' — formatted by the server
  overtime_display: string;
  total_display: string;
  status: ProjectionStatus;
  status_label: string;
  notes: string[];
}

export interface ProjectionCoverage {
  employees: number;
  calculated: number;
  not_set: number;
  not_classified: number;
  salary: number;
  incomplete: number;
}

export interface ProjectionStoreRow extends ProjectionFigures {
  store_id: number | null; // null = Unallocated
  store_name: string;
  employees: number;
}

export interface ProjectionEmployeeRow extends ProjectionFigures {
  employee_id: number;
  employee: string;
  store_id: number | null;
  store_name: string;
}

export interface ProjectionNotice {
  code: string;
  message: string;
}

export interface PayrollProjection {
  range: { from: string; to: string; label: string; timezone: string };
  /** The complete fixed workweeks used as overtime context (may extend past the range). */
  workweeks: { start: string; end: string }[];
  overtime_multiplier: string;
  summary: ProjectionFigures;
  coverage: ProjectionCoverage;
  notices: ProjectionNotice[];
  stores: ProjectionStoreRow[];
  employees: ProjectionEmployeeRow[];
}

export interface ProjectionParams {
  from: string; // YYYY-MM-DD, tenant calendar
  to: string;
  store_id?: number | null;
  user_id?: number | null;
}

/** The permission a user needs to see projected wages (Master Admins always may). */
export const PAYROLL_COST_PERMISSION = 'payroll_cost.view';

export async function fetchPayrollProjection(params: ProjectionParams): Promise<PayrollProjection> {
  const p = new URLSearchParams({ from: params.from, to: params.to });
  if (params.store_id) p.set('store_id', String(params.store_id));
  if (params.user_id) p.set('user_id', String(params.user_id));
  const res = (await api.get(`/admin/schedule/payroll-projection?${p.toString()}`)) as ApiEnvelope & PayrollProjection;
  return {
    range: res.range,
    workweeks: res.workweeks ?? [],
    overtime_multiplier: res.overtime_multiplier,
    summary: res.summary,
    coverage: res.coverage,
    notices: res.notices ?? [],
    stores: res.stores ?? [],
    employees: res.employees ?? [],
  };
}

/** Seconds as 'H:MM' (the schedule's own hours notation). */
export function formatProjectedHours(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
