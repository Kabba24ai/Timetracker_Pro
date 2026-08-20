import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, History } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  HistorySynopsisDay,
  fetchMyHistorySynopsis,
  formatLunchDuration,
  formatPaidHours,
} from '../../lib/history';
import { formatClock } from '../../lib/tz';

const NAV_BTN =
  'inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors';

/**
 * Dashboard sidebar Work History synopsis: the Work History / Work Schedule
 * navigation buttons plus a compact table of the employee's most recent
 * active/Pending days in the current pay period. Read-only; reuses the canonical
 * synopsis endpoint (no calculation here).
 */
const WorkHistorySynopsis: React.FC = () => {
  const { timezone } = useAuth();
  const tz = timezone ?? 'UTC';

  const [days, setDays] = useState<HistorySynopsisDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyHistorySynopsis()
      .then((r) => {
        if (active) setDays(r.days);
      })
      .catch(() => {
        if (active) setError('Could not load your recent history.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Link to="/history" className={NAV_BTN}>
          <History className="h-4 w-4" />
          <span>Work History</span>
        </Link>
        <Link to="/schedule" className={NAV_BTN}>
          <CalendarDays className="h-4 w-4" />
          <span>Work Schedule</span>
        </Link>
      </div>

      <div className="mt-4">
        {error ? (
          <p className="text-xs text-gray-500">{error}</p>
        ) : days === null ? (
          <p className="text-xs text-gray-400">Loading recent history…</p>
        ) : days.length === 0 ? (
          <p className="text-xs text-gray-500">No recent time activity this pay period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                  <th className="text-left py-1.5 px-2 font-medium">Clock In</th>
                  <th className="text-left py-1.5 px-2 font-medium">Lunch</th>
                  <th className="text-left py-1.5 px-2 font-medium">Clock Out</th>
                  <th className="text-right py-1.5 pl-2 font-medium">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5 pr-2 font-medium text-gray-700 whitespace-nowrap">{d.day_label}</td>
                    <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">
                      {d.clock_in ? formatClock(d.clock_in, tz) : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">
                      {d.lunch_seconds > 0 ? formatLunchDuration(d.lunch_seconds) : '—'}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      {d.clock_out_unverified ? (
                        <span className="text-amber-600 font-medium">Missing</span>
                      ) : d.clock_out ? (
                        <span className="text-gray-600">{formatClock(d.clock_out, tz)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-2 text-right whitespace-nowrap">
                      {d.pending ? (
                        <span className="text-amber-600 font-medium">Pending</span>
                      ) : (
                        <span className="font-mono text-gray-900">{formatPaidHours(d.paid_hours)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkHistorySynopsis;
