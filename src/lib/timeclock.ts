// TimeTracker V2 clock domain — types + the thin API layer.
//
// The server is the single source of truth. It returns the current `status`,
// the `allowed_actions` valid from that status, and the shift/break projection.
// This module only maps an action name to its endpoint and shuttles the
// authoritative payload back to React — it deliberately contains NO state-machine
// rules (which action is legal from which state lives on the server).

import { api, ApiEnvelope } from './api';

// The four authoritative states (mirror App\Enums\TimeTracker\V2\ClockState).
export type ClockStatus = 'off' | 'on_clock' | 'on_lunch' | 'on_other';

// The action names the server emits in `allowed_actions` (mirror the enum).
export type ClockAction =
  | 'clock_in'
  | 'clock_out'
  | 'lunch_start'
  | 'lunch_end'
  | 'other_start'
  | 'other_end';

export interface ClockBreak {
  id: number;
  type: 'lunch' | 'other';
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number;
}

export interface ClockShift {
  id: number;
  status: 'open' | 'closed';
  clock_in_at: string | null;
  clock_out_at: string | null;
  worked_seconds: number;
  breaks: ClockBreak[];
}

// The presenter payload (App\Services\TimeTracker\V2\ClockStatePresenter::present).
export interface ClockState {
  status: ClockStatus;
  status_label: string;
  allowed_actions: ClockAction[];
  shift: ClockShift | null;
  open_break: ClockBreak | null;
  server_time: string;
  /** Canonical tenant TimeTracker timezone (IANA id) — the ONLY tz the client uses. */
  timezone: string;
  /** Today's canonical scheduled shift start (ISO instant), null when unscheduled. */
  today_shift_start_at: string | null;
  /** Tenant setting: paid time begins at the scheduled shift start. */
  restrict_paid_to_shift_start: boolean;
  /** Canonical minimum lunch duration (minutes) — drives the On-Lunch notice. */
  minimum_lunch_minutes: number;
  today: {
    shifts: ClockShift[];
    worked_seconds: number;
  };
}

// Maps each server action name to its POST endpoint. The keys are the ONLY
// place these action names are enumerated on the client; if the server allows
// an action, we can dispatch it.
const ACTION_ENDPOINTS: Record<ClockAction, string> = {
  clock_in: '/clock/in',
  clock_out: '/clock/out',
  lunch_start: '/clock/lunch/start',
  lunch_end: '/clock/lunch/end',
  other_start: '/clock/other/start',
  other_end: '/clock/other/end',
};

function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** The authoritative current state (GET /clock/state). */
export async function fetchClockState(): Promise<ClockState> {
  const res = (await api.get<ClockState>('/clock/state')) as ApiEnvelope<ClockState>;
  return res.data as ClockState;
}

/**
 * Perform a clock action. The server validates the transition and returns the
 * resulting authoritative state. An idempotency key guards against double-punch
 * from a retried/duplicated request.
 */
export async function performClockAction(action: ClockAction): Promise<ClockState> {
  const endpoint = ACTION_ENDPOINTS[action];
  const res = (await api.post<ClockState>(endpoint, {
    idempotency_key: newIdempotencyKey(),
  })) as ApiEnvelope<ClockState>;
  return res.data as ClockState;
}

/** The employee's own shift history over a date range (GET /clock/history). */
export async function fetchClockHistory(params?: { from?: string; to?: string }): Promise<ClockShift[]> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = (await api.get<ClockShift[]>(`/clock/history${suffix}`)) as ApiEnvelope<ClockShift[]>;
  return res.data ?? [];
}

// ── Display helpers ───────────────────────────────────────────────────────

/** Seconds → "H:MM" (e.g. 27000 → "7:30"). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** ISO timestamp → local "9:00 AM". */
export function formatClockTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
