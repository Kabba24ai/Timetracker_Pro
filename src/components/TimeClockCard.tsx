import React, { useEffect, useState } from 'react';
import { useTimeClock } from '../contexts/TimeClockContext';
import { ClockAction, formatClockTime, formatDuration } from '../lib/timeclock';
import { formatClock } from '../lib/tz';
import { AlertCircle, Clock, Coffee, Info, LogIn, LogOut, Pause, Play } from 'lucide-react';

// Presentation for each action the SERVER may offer. We never decide which of
// these to show — `allowed_actions` from the server does. This map only styles
// and labels whatever the server permits. "Unpaid Break" is deliberate employee
// terminology (the underlying event remains other_start; breaks stay unpaid).
const ACTIONS: Record<
  ClockAction,
  { label: string; icon: React.ReactNode; className: string }
> = {
  clock_in: {
    label: 'Clock In',
    icon: <LogIn className="h-4 w-4" />,
    className: 'bg-green-600 hover:bg-green-700 text-white',
  },
  clock_out: {
    label: 'Clock Out',
    icon: <LogOut className="h-4 w-4" />,
    className: 'bg-red-600 hover:bg-red-700 text-white',
  },
  // Offered while on lunch/unpaid break — same "Clock Out" affordance, but it
  // routes through a confirmation (the interval start becomes the clock-out).
  clock_out_from_break: {
    label: 'Clock Out',
    icon: <LogOut className="h-4 w-4" />,
    className: 'bg-red-600 hover:bg-red-700 text-white',
  },
  lunch_start: {
    label: 'Start Lunch',
    icon: <Coffee className="h-4 w-4" />,
    className: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  lunch_end: {
    label: 'End Lunch',
    icon: <Play className="h-4 w-4" />,
    className: 'bg-orange-600 hover:bg-orange-700 text-white',
  },
  other_start: {
    label: 'Unpaid Break',
    icon: <Pause className="h-4 w-4" />,
    className: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  other_end: {
    label: 'End Break',
    icon: <Play className="h-4 w-4" />,
    className: 'bg-purple-700 hover:bg-purple-800 text-white',
  },
};

// Status pill styling per authoritative state.
const STATUS_STYLES: Record<string, string> = {
  off: 'bg-gray-100 text-gray-700 border-gray-200',
  on_clock: 'bg-green-100 text-green-800 border-green-200',
  on_lunch: 'bg-orange-100 text-orange-800 border-orange-200',
  on_other: 'bg-purple-100 text-purple-800 border-purple-200',
};

// ── Restrict Paid Time to Shift Start — employee-facing policy copy ──────────
// Shown only while the tenant setting is ON, the employee has a scheduled start
// today, and that start has not arrived yet. Never shown when the setting is
// OFF or there is no schedule (paid time then begins at the actual punch).
//
// Before clocking in: the standing policy.
export const EARLY_CLOCK_IN_POLICY_NOTICE =
  'Early clock-ins do not start paid time. If you clock in before your scheduled shift, do not begin working until your scheduled start time.';
// After an early clock-in: the specific instruction, with the scheduled time.
export const earlyClockInNotice = (scheduledStart: string): string =>
  `Your shift starts at ${scheduledStart}. Your clock-in was recorded, but paid time begins at ${scheduledStart}. Please do not begin working until then.`;

const TimeClockCard: React.FC = () => {
  const { state, status, statusLabel, allowedActions, shift, openBreak, loading, working, error, perform } =
    useTimeClock();

  // A 1s tick so the elapsed time counts up live AND the pre-shift notice
  // disappears on its own the moment the scheduled start arrives.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Clock Out while on lunch/unpaid break is explicit: confirm before it fires.
  const [confirmBreakOut, setConfirmBreakOut] = useState(false);

  const handle = (action: ClockAction) => {
    if (action === 'clock_out_from_break') {
      setConfirmBreakOut(true); // require explicit confirmation
      return;
    }
    // Errors surface via context state; swallow the rejection here.
    perform(action).catch(() => undefined);
  };

  const confirmClockOutFromBreak = () => {
    setConfirmBreakOut(false);
    perform('clock_out_from_break').catch(() => undefined);
  };

  const clockedInSince = shift?.status === 'open' ? shift.clock_in_at : null;
  const elapsedSeconds = clockedInSince
    ? Math.max(0, Math.floor((Date.now() - new Date(clockedInSince).getTime()) / 1000))
    : 0;

  // ── The one employee-facing notice (priority: Lunch → pre-shift → nothing) ──
  // Pre-shift copy exists only while the paid-time restriction is ON and today's
  // canonical scheduled start (server-resolved, tenant timezone) is still ahead:
  //   OFF the clock  → the standing policy (early clock-ins do not start paid time)
  //   ON the clock   → the specific instruction naming the scheduled start
  // Both vanish on their own at the scheduled start (1s tick above). Instants are
  // compared as instants — never as browser-local wall clocks.
  const tz = state?.timezone ?? 'UTC';
  const shiftStartAt = state?.today_shift_start_at ?? null;
  const restrictPaid = !!state?.restrict_paid_to_shift_start;
  const beforeShiftStart = !!shiftStartAt && Date.now() < new Date(shiftStartAt).getTime();
  let notice: string | null = null;
  if (status === 'on_lunch') {
    notice = `Standard minimum lunch is ${state?.minimum_lunch_minutes ?? 30} minutes.`;
  } else if (restrictPaid && beforeShiftStart) {
    if (status === 'off') {
      notice = EARLY_CLOCK_IN_POLICY_NOTICE;
    } else if (status === 'on_clock' || status === 'on_other') {
      notice = earlyClockInNotice(formatClock(shiftStartAt, tz));
    }
  }

  // "Paid from": the server's canonical paid start for the OPEN shift when it is
  // later than the real punch (early clock-in under the restriction). The punch
  // stays the Clock In shown to the employee; this only names where pay begins.
  const paidFromAt =
    shift?.status === 'open' &&
    shift.paid_start_at &&
    clockedInSince &&
    new Date(shift.paid_start_at).getTime() > new Date(clockedInSince).getTime()
      ? shift.paid_start_at
      : null;

  // ── Primary progression (visual hierarchy ONLY — the server's allowed_actions
  // still decide what exists). The next NORMAL step is largest:
  //   off → Clock In · on-clock pre-lunch → Start Lunch · on lunch/break → end it
  //   on-clock after lunch → Clock Out. Unpaid Break is never the primary step.
  const lunchCompleted = !!shift?.breaks?.some((b) => b.type === 'lunch' && b.end_at);
  let primary: ClockAction | null = null;
  if (status === 'off') primary = 'clock_in';
  else if (status === 'on_lunch') primary = 'lunch_end';
  else if (status === 'on_other') primary = 'other_end';
  else if (status === 'on_clock') primary = !lunchCompleted && allowedActions.includes('lunch_start') ? 'lunch_start' : 'clock_out';
  if (primary && !allowedActions.includes(primary)) primary = null;
  const secondary = allowedActions.filter((a) => a !== primary);

  const renderButton = (action: ClockAction, isPrimary: boolean) => {
    const cfg = ACTIONS[action];
    if (!cfg) return null;
    return (
      <button
        key={action}
        onClick={() => handle(action)}
        disabled={working}
        className={`rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          isPrimary ? 'w-full py-4 px-6 text-lg font-semibold' : 'py-2.5 px-4 text-sm font-medium'
        } ${cfg.className}`}
      >
        {cfg.icon}
        <span>{cfg.label}</span>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Time Clock</h2>
        </div>
        {/* Work Schedule / Work History navigation lives in the right sidebar. */}
      </div>

      {error && (
        <div className="mb-4 flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border ${
            STATUS_STYLES[status ?? 'off'] ?? STATUS_STYLES.off
          }`}
        >
          <span className="font-medium">{statusLabel || 'Clocked Out'}</span>
        </div>

        {clockedInSince && (
          <div className="text-sm text-gray-500">
            On the clock since{' '}
            <span className="font-medium text-gray-700">{formatClockTime(clockedInSince)}</span>
            <span className="ml-2 font-mono text-gray-700">({formatDuration(elapsedSeconds)})</span>
            {paidFromAt && (
              <span
                className="ml-2 whitespace-nowrap"
                title="Your clock-in is recorded as shown. Paid time begins at your scheduled shift start."
              >
                · Paid from <span className="font-medium text-gray-700">{formatClock(paidFromAt, tz)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {loading && !status ? (
        <p className="text-sm text-gray-400">Loading your clock status…</p>
      ) : allowedActions.length === 0 ? (
        <p className="text-sm text-gray-400">No actions available right now.</p>
      ) : (
        // The next normal progression is the single large primary action; every
        // other server-permitted action renders smaller beneath it.
        <div className="space-y-3">
          {primary && renderButton(primary, true)}
          {secondary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {secondary.map((action) => renderButton(action, false))}
            </div>
          )}
        </div>
      )}

      {/* One concise employee notice — never stacked technical copy. */}
      {notice && (
        <div className="mt-4 flex items-start gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Clock Out while on lunch / unpaid break — the interval start becomes the
          official clock-out. The employee must explicitly confirm. */}
      {confirmBreakOut && openBreak && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clock-out-break-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="clock-out-break-title" className="text-lg font-semibold text-gray-900">
              {openBreak.type === 'lunch' ? 'Clock Out While on Lunch?' : 'Clock Out While on Unpaid Break?'}
            </h3>
            <p className="mt-3 text-sm text-gray-600">
              {openBreak.type === 'lunch'
                ? `You are currently on lunch. Your lunch started at ${formatClock(openBreak.start_at, tz)}. If you clock out now, ${formatClock(openBreak.start_at, tz)} will be used as your official clock-out time.`
                : `You are currently on an unpaid break. Your break started at ${formatClock(openBreak.start_at, tz)}. If you clock out now, ${formatClock(openBreak.start_at, tz)} will be used as your official clock-out time.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmBreakOut(false)}
                disabled={working}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClockOutFromBreak}
                disabled={working}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Clock Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeClockCard;
