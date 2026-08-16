// TimeTracker V2 — time-off (PTO) API layer.
//
// The server is authoritative: it computes the per-scheduled-day allocation from
// the canonical schedule, reserves/uses balance on an append-only ledger, and
// enforces the lifecycle rules. React only presents and issues intents.

import { api, ApiEnvelope } from './api';

export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface TimeOffType {
  code: string;
  label: string;
  is_paid: boolean;
  is_balance_tracked: boolean;
  balance_bucket: string | null;
}

export interface TimeOffBalance {
  bucket: string;
  type_code: string;
  type_label: string;
  available: number;
  reserved: number;
  used: number;
  credited: number;
}

export interface TimeOffDay {
  date: string;
  scheduled_hours: number;
  requested_hours: number;
  approved_hours: number | null;
}

export interface TimeOffRequest {
  id: number;
  employee_id: number;
  employee_name: string | null;
  type: { code: string | null; label: string | null };
  status: TimeOffStatus;
  start_date: string;
  end_date: string;
  requested_hours: number;
  approved_hours: number | null;
  is_paid: boolean;
  is_balance_tracked: boolean;
  balance_bucket: string | null;
  notes: string | null;
  source: string;
  decided_at: string | null;
  decision_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  days: TimeOffDay[];
  created_at: string | null;
}

export interface EmployeeBalances {
  employee: { id: number; name: string | null };
  balances: TimeOffBalance[];
}

export interface OverlapException {
  id: number;
  request_id: number;
  employee: { id: number; name: string | null };
  type: string | null;
  date: string;
  pto_hours: number;
  worked_hours: number;
  status: 'open' | 'resolved';
  resolution: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
}

// ── Employee ────────────────────────────────────────────────────────────────

export async function fetchTimeOffTypes(): Promise<TimeOffType[]> {
  const res = (await api.get('/time-off/types')) as ApiEnvelope<TimeOffType[]>;
  return res.data ?? [];
}

export async function fetchMyBalance(): Promise<TimeOffBalance[]> {
  const res = (await api.get('/time-off/balance')) as ApiEnvelope<TimeOffBalance[]>;
  return res.data ?? [];
}

export async function fetchMyRequests(): Promise<TimeOffRequest[]> {
  const res = (await api.get('/time-off/requests')) as ApiEnvelope<TimeOffRequest[]>;
  return res.data ?? [];
}

export interface SubmitPayload {
  type_code: string;
  start_date: string;
  end_date: string;
  days?: Record<string, number>;
  notes?: string;
}

export async function submitTimeOffRequest(payload: SubmitPayload): Promise<TimeOffRequest> {
  const res = (await api.post('/time-off/requests', payload)) as ApiEnvelope<TimeOffRequest>;
  return res.data as TimeOffRequest;
}

export async function cancelMyRequest(id: number, reason?: string): Promise<TimeOffRequest> {
  const res = (await api.post(`/time-off/requests/${id}/cancel`, { reason })) as ApiEnvelope<TimeOffRequest>;
  return res.data as TimeOffRequest;
}

// ── Admin ─────────────────────────────────────────────────────────────────--

export async function adminListRequests(params: {
  status?: TimeOffStatus;
  employee_id?: number;
  type_code?: string;
  from?: string;
  to?: string;
} = {}): Promise<TimeOffRequest[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = (await api.get(`/admin/time-off/requests${suffix}`)) as ApiEnvelope<TimeOffRequest[]>;
  return res.data ?? [];
}

export async function adminApprove(id: number, days?: Record<string, number>, reason?: string): Promise<TimeOffRequest> {
  const res = (await api.post(`/admin/time-off/requests/${id}/approve`, { days, reason })) as ApiEnvelope<TimeOffRequest>;
  return res.data as TimeOffRequest;
}

export async function adminDeny(id: number, reason?: string): Promise<TimeOffRequest> {
  const res = (await api.post(`/admin/time-off/requests/${id}/deny`, { reason })) as ApiEnvelope<TimeOffRequest>;
  return res.data as TimeOffRequest;
}

export async function adminCancel(id: number, reason?: string): Promise<TimeOffRequest> {
  const res = (await api.post(`/admin/time-off/requests/${id}/cancel`, { reason })) as ApiEnvelope<TimeOffRequest>;
  return res.data as TimeOffRequest;
}

export async function adminBalances(employeeId?: number): Promise<EmployeeBalances[]> {
  const suffix = employeeId ? `?employee_id=${employeeId}` : '';
  const res = (await api.get(`/admin/time-off/balances${suffix}`)) as ApiEnvelope<EmployeeBalances[]>;
  return res.data ?? [];
}

export async function adminGrant(payload: { employee_id: number; bucket: string; hours: number; reason?: string }): Promise<TimeOffBalance> {
  const res = (await api.post('/admin/time-off/balances/grant', payload)) as ApiEnvelope<TimeOffBalance>;
  return res.data as TimeOffBalance;
}

export async function fetchOverlapExceptions(status: 'open' | 'resolved' = 'open'): Promise<OverlapException[]> {
  const res = (await api.get(`/admin/time-off/overlap-exceptions?status=${status}`)) as ApiEnvelope<OverlapException[]>;
  return res.data ?? [];
}

export async function resolveOverlap(id: number, resolution: 'kept_pto' | 'cancelled_pto' | 'adjusted', notes?: string): Promise<void> {
  await api.post(`/admin/time-off/overlap-exceptions/${id}/resolve`, { resolution, notes });
}

export const TIME_OFF_STATUS_STYLE: Record<TimeOffStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
