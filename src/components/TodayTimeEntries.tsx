    import React from 'react';
    import { useTimeClock } from '../contexts/TimeClockContext';
    import { Clock, Coffee, Pause, Play, StopCircle } from 'lucide-react';

    const TENANT_TIMEZONE =
      import.meta.env.VITE_APP_TIMEZONE || 'UTC';


    type TimeEvent = {
      id: string;
      entry_type:
        | 'clock_in'
        | 'clock_out'
        | 'lunch_out'
        | 'lunch_in'
        | 'other_out'
        | 'other_in';
      timestamp: string;
      actual_timestamp?: string;
    };

const getEffectiveTimestamp = (e: TimeEvent) => {
  if (
    (e.entry_type === 'clock_in' || e.entry_type === 'clock_out') &&
    e.actual_timestamp
  ) {
    return e.actual_timestamp;
  }
  return e.timestamp;
};



    const TodayTimeEntries: React.FC = () => {
      const { todayEntries } = useTimeClock();

        const timeEvents: TimeEvent[] = todayEntries.flatMap((entry) => {
        const events: TimeEvent[] = [];

      // Clock in
      if (entry.clock_in) {
        events.push({
          id: `${entry.id}-clock-in`,
          entry_type: 'clock_in',
          timestamp: entry.clock_in,
          actual_timestamp: entry.actual_clock_in,
        });
      }

      // Breaks
      entry.breaks?.forEach((b, index) => {
        if (b.start_time) {
          events.push({
            id: `${entry.id}-break-${index}-start`,
            entry_type: b.type === 'lunch' ? 'lunch_out' : 'other_out',
            timestamp: b.start_time,
          });
        }

        if (b.original_end_time) {
          events.push({
            id: `${entry.id}-break-${index}-end`,
            entry_type: b.type === 'lunch' ? 'lunch_in' : 'other_in',
            timestamp: b.original_end_time,
          });
        }
      });

      // Clock out
      if (entry.clock_out) {
        events.push({
          id: `${entry.id}-clock-out`,
          entry_type: 'clock_out',
          timestamp: entry.clock_out,
          actual_timestamp: entry.actual_clock_out,
        });
      }

      return events;
        });


    /**
     *  SINGLE SOURCE OF TRUTH
     * Latest event first
     */
  const orderedEvents = [...timeEvents].sort(
  (a, b) =>
    new Date(getEffectiveTimestamp(b)).getTime() -
    new Date(getEffectiveTimestamp(a)).getTime()
);





      const getEntryIcon = (entryType: string) => {
      switch (entryType) {
        case 'clock_in':
          return <Play className="h-4 w-4 text-green-600" />;
        case 'clock_out':
          return <StopCircle className="h-4 w-4 text-red-600" />;
        case 'lunch_out':
        case 'lunch_in':
          return <Coffee className="h-4 w-4 text-orange-600" />;
        case 'other_out':
        case 'other_in':
          return <Pause className="h-4 w-4 text-blue-600" />;
        default:
          return <Clock className="h-4 w-4 text-gray-600" />;
      }
    };


      const getEntryLabel = (entryType: string) => {
        const labels: Record<string, string> = {
          clock_in: 'Clock In',
          clock_out: 'Clock Out',
          lunch_out: 'Lunch Start',
          lunch_in: 'Lunch End',
          other_out: 'Other Break Start',
          other_in: 'Other Break End',
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
          case 'other_out':
          case 'other_in':
            return 'bg-blue-50 border-blue-200';
          default:
            return 'bg-gray-50 border-gray-200';
        }
      };

    //   const formatTime = (timestamp: string) => {
    //   const date = new Date(timestamp);
    //   if (isNaN(date.getTime())) return '--:--';

    //   return new Intl.DateTimeFormat('en-US', {
    //     timeZone: TENANT_TIMEZONE,
    //     hour12: true,
    //     hour: 'numeric',
    //     minute: '2-digit',
    //   }).format(date);
    // };

    const formatTime = (timestamp?: string) => {
      if (!timestamp) return '--:--';

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '--:--';

      return new Intl.DateTimeFormat('en-US', {
        timeZone: TENANT_TIMEZONE,
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
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
          {orderedEvents.map((entry, index) => (
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
                      {/* <p className="font-mono text-lg text-gray-900">{formatTime(entry.timestamp)}  
                        <br />
                        {entry.entry_type === 'clock_in' &&
                          entry.actual_timestamp &&
                          entry.actual_timestamp !== entry.timestamp && (
                            <span className="ml-2 text-sm text-gray-500">
                              ({formatTime(entry.actual_timestamp)})
                            </span>
                          )}
                        
                      </p> */}

                        <p className="font-mono text-lg text-gray-900">
                        {(entry.entry_type === 'clock_in' || entry.entry_type === 'clock_out') &&
                          entry.actual_timestamp
                            ? formatTime(entry.actual_timestamp)
                            : formatTime(entry.timestamp)}

                          {(entry.entry_type === 'clock_in' || entry.entry_type === 'clock_out') &&
                              entry.actual_timestamp &&
                              new Date(entry.actual_timestamp).getTime() !==
                                new Date(entry.timestamp).getTime() && (

                              <>
                                <br />
                                <span className="text-sm text-gray-500">
                                  ({formatTime(entry.timestamp)}) 
                                </span>
                              </>
                            )}
                        </p>

                  <p className="text-xs text-gray-500">

                      {isNaN(new Date(entry.timestamp).getTime())
                        ? '--'
                        : new Intl.DateTimeFormat('en-US', {
      timeZone: TENANT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(entry.timestamp))
    }
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

