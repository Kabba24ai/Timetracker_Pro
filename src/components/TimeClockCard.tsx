import React from 'react';
import { useTimeClock } from '../contexts/TimeClockContext';
import { Clock, Play, StopCircle } from 'lucide-react';

const TimeClockCard: React.FC = () => {
  const {
    currentStatus,
    clockIn,
    clockOut,
  } = useTimeClock();

  const getStatusColor = () => {
    return currentStatus === 'clocked_in'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusText = () => {
    return currentStatus === 'clocked_in' ? 'Clocked In' : 'Clocked Out';
  };

  const getStatusIcon = () => {
    return currentStatus === 'clocked_in'
      ? <Play className="h-5 w-5" />
      : <StopCircle className="h-5 w-5" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Clock className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Time Clock</h2>
      </div>

      <div className="mb-6">
        <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currentStatus === 'clocked_out' ? (
          <button
            onClick={() => clockIn()}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>Clock In</span>
          </button>
        ) : (
          <button
            onClick={() => clockOut()}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <StopCircle className="h-4 w-4" />
            <span>Clock Out</span>
          </button>
        )}

      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>Clock in at the start of your shift and clock out at the end. Break time is tracked when clocking out.</p>
      </div>
    </div>
  );
};

export default TimeClockCard;