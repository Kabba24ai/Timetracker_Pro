import React from 'react';
import { useTimeClock } from '../contexts/TimeClockContext';
import { ClockShift, formatClockTime, formatDuration } from '../lib/timeclock';
import { Clock, Coffee, LogIn, LogOut, Pause } from 'lucide-react';

const ShiftRow: React.FC<{ shift: ClockShift; index: number }> = ({ shift, index }) => {
  const open = shift.status === 'open';
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gray-50">
        <div className="flex items-center space-x-3">
          <LogIn className="h-4 w-4 text-green-600" />
          <div>
            <p className="font-medium text-gray-900">Shift #{index + 1}</p>
            <p className="text-sm text-gray-500">
              {formatClockTime(shift.clock_in_at)} —{' '}
              {open ? (
                <span className="text-green-600 font-medium">In progress</span>
              ) : (
                formatClockTime(shift.clock_out_at)
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg text-gray-900">{formatDuration(shift.worked_seconds)}</p>
          <p className="text-xs text-gray-500">worked</p>
        </div>
      </div>

      {shift.breaks.length > 0 && (
        <div className="divide-y divide-gray-100">
          {shift.breaks.map((br) => {
            const isLunch = br.type === 'lunch';
            return (
              <div key={br.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  {isLunch ? (
                    <Coffee className="h-4 w-4 text-orange-500" />
                  ) : (
                    <Pause className="h-4 w-4 text-purple-600" />
                  )}
                  <span>{isLunch ? 'Lunch' : 'Break'}</span>
                  <span className="text-gray-400">
                    {formatClockTime(br.start_at)}
                    {br.end_at ? ` – ${formatClockTime(br.end_at)}` : ' – ongoing'}
                  </span>
                </div>
                <span className="font-mono text-gray-700">{formatDuration(br.duration_seconds)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TodayTimeEntries: React.FC = () => {
  const { state } = useTimeClock();
  const shifts = state?.today.shifts ?? [];
  const workedToday = state?.today.worked_seconds ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Today's Time Entries</h2>
        </div>
        {workedToday > 0 && (
          <div className="text-right">
            <p className="font-mono text-lg text-gray-900">{formatDuration(workedToday)}</p>
            <p className="text-xs text-gray-500">total today</p>
          </div>
        )}
      </div>

      {shifts.length === 0 ? (
        <div className="text-center py-8">
          <LogOut className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No time entries for today yet.</p>
          <p className="text-sm text-gray-400 mt-1">Clock in to start tracking your time!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift, index) => (
            <ShiftRow key={shift.id} shift={shift} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TodayTimeEntries;
