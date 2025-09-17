import React from 'react';
import { useTimeClock } from '../contexts/TimeClockContext';
import { Clock, Coffee, Pause, Play, StopCircle } from 'lucide-react';

const TodayTimeEntries: React.FC = () => {
  const { todayEntries } = useTimeClock();

  const getEntryIcon = (entryType: string) => {
    switch (entryType) {
      case 'clock_in':
        return <Play className="h-4 w-4 text-green-600" />;
      case 'clock_out':
        return <StopCircle className="h-4 w-4 text-red-600" />;
      case 'lunch_out':
      case 'lunch_in':
        return <Coffee className="h-4 w-4 text-orange-600" />;
      case 'unpaid_out':
      case 'unpaid_in':
        return <Pause className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEntryLabel = (entryType: string) => {
    const labels: { [key: string]: string } = {
      clock_in: 'Clock In',
      clock_out: 'Clock Out',
      lunch_out: 'Lunch Start',
      lunch_in: 'Lunch End',
      unpaid_out: 'Unpaid Start',
      unpaid_in: 'Unpaid End',
    };
    return labels[entryType] || entryType;
  };

  const getEntryColor = (entryType: string) => {
    switch (entryType) {
      case 'clock_in':
        return 'bg-green-50 border-green-200';
      case 'clock_out':
        return 'bg-red-50 border-red-200';
      case 'lunch_out':
      case 'lunch_in':
        return 'bg-orange-50 border-orange-200';
      case 'unpaid_out':
      case 'unpaid_in':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Clock className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Today's Time Entries</h2>
      </div>

      {todayEntries.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No time entries for today yet.</p>
          <p className="text-sm text-gray-400 mt-1">Clock in to start tracking your time!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todayEntries.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${getEntryColor(
                entry.entry_type
              )}`}
            >
              <div className="flex items-center space-x-3">
                {getEntryIcon(entry.entry_type)}
                <div>
                  <p className="font-medium text-gray-900">{getEntryLabel(entry.entry_type)}</p>
                  <p className="text-sm text-gray-500">Entry #{index + 1}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg text-gray-900">{formatTime(entry.timestamp)}</p>
                <p className="text-xs text-gray-500">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodayTimeEntries;