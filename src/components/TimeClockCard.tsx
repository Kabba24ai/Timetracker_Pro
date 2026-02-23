import React from 'react';
import { useTimeClock } from '../contexts/TimeClockContext';
import { Loader2 } from 'lucide-react';

import {
  Clock,
  Play,
  StopCircle,
  Coffee,
  Pause,
} from 'lucide-react';


const TimeClockCard: React.FC = () => {
  const {
    status,
    activeEntry,
    processingAction,
    clockIn,
    clockOut,
    startLunch,
    endLunch,
    startOther,
    endOther,
  } = useTimeClock();


  const isLoading = (action: string) =>
  processingAction === action;

  const statusConfig = {
    clocked_out: {
      label: 'Clocked Out',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
    },
    working: {
      label: 'Working',
      color: 'bg-green-100 text-green-800 border-green-200',
    },
    lunch_break: {
      label: 'Lunch Break',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    other_break: {
      label: 'On Break',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  };




  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Clock className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Time Clock</h2>
      </div>

      {/* STATUS BADGE */}
      <div className="mb-6">
        <div
          className={`inline-flex items-center px-4 py-2 rounded-full border ${statusConfig[status].color}`}
        >
          <span className="font-medium">{statusConfig[status].label}</span>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {status === 'clocked_out' && (
          <button
          onClick={clockIn}
          disabled={isLoading('clock_in')}
          className={`
            bg-green-600 text-white py-3 rounded-lg
            flex items-center justify-center space-x-2
            transition-all duration-200
            ${isLoading('clock_in')
              ? 'opacity-70 cursor-not-allowed'
              : 'hover:bg-green-700 hover:scale-[1.02]'
            }
          `}
        >
          {isLoading('clock_in') ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Clock In</span>
            </>
          )}
        </button>

        )}

        {status === 'working' && (
          <>
            <button
              onClick={startLunch}
              disabled={isLoading('lunch_start')}
              className={`
                bg-yellow-500 text-white py-3 rounded-lg
                flex items-center justify-center space-x-2
                transition-all duration-200
                ${
                  isLoading('lunch_start')
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:bg-yellow-600 hover:scale-[1.02]'
                }
              `}
            >
              {isLoading('lunch_start') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Coffee className="h-4 w-4" />
              )}
              <span>Lunch Start</span>
            </button>



            <button
              onClick={startOther}
              disabled={isLoading('other_start')}
              className={`
                bg-blue-500 text-white py-3 rounded-lg
                flex items-center justify-center space-x-2
                transition-all duration-200
                ${isLoading('other_start')
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:bg-blue-600 hover:scale-[1.02]'
                }
              `}
            >
              {isLoading('other_start') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              <span>Other Start</span>
            </button>


           <button
              onClick={clockOut}
              disabled={isLoading('clock_out')}
              className={`
                bg-red-600 text-white py-3 rounded-lg
                flex items-center justify-center space-x-2
                transition-all duration-200
                ${
                  isLoading('clock_out')
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:bg-red-700 hover:scale-[1.02]'
                }
              `}
            >
              {isLoading('clock_out') ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <StopCircle className="h-4 w-4" />
                  <span>Clock Out</span>
                </>
              )}
            </button>

          </>
        )}

        {status === 'lunch_break' && (
          <button
              onClick={endLunch}
              disabled={isLoading('lunch_end')}
              className={`
                bg-green-600 text-white py-3 rounded-lg
                flex items-center justify-center space-x-2
                transition-all duration-200
                ${
                  isLoading('lunch_end')
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:bg-green-700 hover:scale-[1.02]'
                }
              `}
            >
              {isLoading('lunch_end') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>Lunch End</span>
            </button>

        )}

        {status === 'other_break' && (
          <button
            onClick={endOther}
            disabled={isLoading('other_end')}
            className={`
              bg-green-600 text-white py-3 rounded-lg
              flex items-center justify-center space-x-2
              transition-all duration-200
              ${
                isLoading('other_end')
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:bg-green-700 hover:scale-[1.02]'
              }
            `}
          >
            {isLoading('other_end') ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>Other End</span>
          </button>

        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>
          Clock in to start your day. Lunch and other breaks are tracked
          separately and excluded from total working hours.
        </p>
      </div>
    </div>
  );
};

export default TimeClockCard;
