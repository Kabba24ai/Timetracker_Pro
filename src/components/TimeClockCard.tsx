import React from 'react';
import { useTimeClock } from '../contexts/TimeClockContext';
import { Clock, Coffee, Pause, Play, StopCircle } from 'lucide-react';

const TimeClockCard: React.FC = () => {
  const {
    currentStatus,
    isOnLunch,
    isOnUnpaidBreak,
    clockIn,
    clockOut,
    startLunch,
    endLunch,
    startUnpaidTime,
    endUnpaidTime,
  } = useTimeClock();

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'clocked_in':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'on_lunch':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'on_unpaid_break':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = () => {
    switch (currentStatus) {
      case 'clocked_in':
        return 'Clocked In';
      case 'on_lunch':
        return 'On Lunch Break';
      case 'on_unpaid_break':
        return 'On Unpaid Break';
      default:
        return 'Clocked Out';
    }
  };

  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'clocked_in':
        return <Play className="h-5 w-5" />;
      case 'on_lunch':
        return <Coffee className="h-5 w-5" />;
      case 'on_unpaid_break':
        return <Pause className="h-5 w-5" />;
      default:
        return <StopCircle className="h-5 w-5" />;
    }
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clock In/Out */}
        <div className="space-y-2">
          {currentStatus === 'clocked_out' ? (
            <button
              onClick={clockIn}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <Play className="h-4 w-4" />
              <span>Clock In</span>
            </button>
          ) : (
            <button
              onClick={clockOut}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center space-x-2"
              disabled={isOnLunch || isOnUnpaidBreak}
            >
              <StopCircle className="h-4 w-4" />
              <span>Clock Out</span>
            </button>
          )}
        </div>

        {/* Lunch */}
        <div className="space-y-2">
          {!isOnLunch ? (
            <button
              onClick={startLunch}
              className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center space-x-2"
              disabled={currentStatus !== 'clocked_in'}
            >
              <Coffee className="h-4 w-4" />
              <span>Start Lunch</span>
            </button>
          ) : (
            <button
              onClick={endLunch}
              className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <Coffee className="h-4 w-4" />
              <span>End Lunch</span>
            </button>
          )}
        </div>

        {/* Unpaid Time */}
        <div className="space-y-2">
          {!isOnUnpaidBreak ? (
            <button
              onClick={startUnpaidTime}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center space-x-2"
              disabled={currentStatus !== 'clocked_in'}
            >
              <Pause className="h-4 w-4" />
              <span>Start Unpaid</span>
            </button>
          ) : (
            <button
              onClick={endUnpaidTime}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <Pause className="h-4 w-4" />
              <span>End Unpaid</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>• Clock in/out to track your work hours</p>
        <p>• Use lunch break once per day (unpaid time)</p>
        <p>• Use unpaid time for breaks as needed</p>
        <p>• Must end all breaks before clocking out</p>
      </div>
    </div>
  );
};

export default TimeClockCard;