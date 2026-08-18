import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimeClock } from '../contexts/TimeClockContext';
import { ClockAction, formatClockTime, formatDuration } from '../lib/timeclock';
import { AlertCircle, CalendarDays, Clock, Coffee, LogIn, LogOut, Pause, Play } from 'lucide-react';

// Presentation for each action the SERVER may offer. We never decide which of
// these to show — `allowed_actions` from the server does. This map only styles
// and labels whatever the server permits.
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
    label: 'Start Break',
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

const TimeClockCard: React.FC = () => {
  const { status, statusLabel, allowedActions, shift, loading, working, error, perform } =
    useTimeClock();

  // A 1s tick so the "on the clock since" elapsed time counts up live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const handle = (action: ClockAction) => {
    // Errors surface via context state; swallow the rejection here.
    perform(action).catch(() => undefined);
  };

  const clockedInSince = shift?.status === 'open' ? shift.clock_in_at : null;
  const elapsedSeconds = clockedInSince
    ? Math.max(0, Math.floor((Date.now() - new Date(clockedInSince).getTime()) / 1000))
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Time Clock</h2>
        </div>
        {/* Every authenticated employee can open the read-only Work Schedule. */}
        <Link
          to="/schedule"
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <CalendarDays className="h-4 w-4" />
          <span>Work Schedule</span>
        </Link>
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
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading && !status ? (
          <p className="text-sm text-gray-400">Loading your clock status…</p>
        ) : allowedActions.length === 0 ? (
          <p className="text-sm text-gray-400">No actions available right now.</p>
        ) : (
          // Render ONLY what the server permits, in the server's order.
          allowedActions.map((action) => {
            const cfg = ACTIONS[action];
            if (!cfg) return null;
            return (
              <button
                key={action}
                onClick={() => handle(action)}
                disabled={working}
                className={`w-full py-3 px-4 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.className}`}
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>
          The server confirms every action and returns your new status — only valid options are
          shown.
        </p>
      </div>
    </div>
  );
};

export default TimeClockCard;
