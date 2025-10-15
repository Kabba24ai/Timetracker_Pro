import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface WorkDay {
  date: string;
  is_scheduled: boolean;
  start_time?: string;
  end_time?: string;
  hours: number;
  store_location?: string;
}

const EmployeeScheduleView: React.FC = () => {
  const { employee } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [weekOptions, setWeekOptions] = useState<string[]>([]);

  useEffect(() => {
    const weeks = [];
    const today = new Date();

    for (let i = -2; i <= 4; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() + (i * 7));
      const monday = new Date(weekDate);
      monday.setDate(weekDate.getDate() - weekDate.getDay() + 1);
      weeks.push(monday.toISOString().split('T')[0]);
    }

    setWeekOptions(weeks);

    const currentWeekMonday = new Date(today);
    currentWeekMonday.setDate(today.getDate() - today.getDay() + 1);
    setSelectedWeek(currentWeekMonday.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (!selectedWeek || !employee) return;

    const scheduleKey = `demo_work_schedule_${selectedWeek}`;
    const savedSchedule = localStorage.getItem(scheduleKey);

    if (savedSchedule) {
      const scheduleData = JSON.parse(savedSchedule);
      const employeeSchedule = scheduleData[employee.id];

      if (employeeSchedule) {
        setWorkDays(employeeSchedule);
      } else {
        setWorkDays(generateEmptyWeek(selectedWeek));
      }
    } else {
      setWorkDays(generateEmptyWeek(selectedWeek));
    }
  }, [selectedWeek, employee]);

  const generateEmptyWeek = (weekStart: string): WorkDay[] => {
    const days: WorkDay[] = [];
    const startDate = new Date(weekStart);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        is_scheduled: false,
        hours: 0,
      });
    }

    return days;
  };

  const formatWeekLabel = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${dayName}\n${month} ${dayNum}`;
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const totalHours = workDays.reduce((sum, day) => sum + day.hours, 0);

  const getStoreColor = (store: string) => {
    const colors: { [key: string]: string } = {
      'Main Store': 'bg-blue-100 text-blue-800 border-blue-300',
      'North Branch': 'bg-green-100 text-green-800 border-green-300',
      'South Branch': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'East Location': 'bg-purple-100 text-purple-800 border-purple-300',
      'West Location': 'bg-pink-100 text-pink-800 border-pink-300',
      'Downtown': 'bg-orange-100 text-orange-800 border-orange-300'
    };
    return colors[store] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">My Work Schedule</h2>
          </div>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Week:</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  {formatWeekLabel(week)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-3 min-w-[800px]">
            {workDays.map((day) => (
              <div
                key={day.date}
                className={`border rounded-lg p-4 ${
                  isToday(day.date)
                    ? 'ring-2 ring-blue-500'
                    : ''
                } ${
                  day.is_scheduled && day.store_location
                    ? getStoreColor(day.store_location)
                    : day.is_scheduled
                    ? 'bg-white border-gray-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-center mb-3">
                  <div className="text-sm font-semibold whitespace-pre-line">
                    {getDayLabel(day.date)}
                  </div>
                  {isToday(day.date) && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      Today
                    </span>
                  )}
                </div>

                {day.is_scheduled ? (
                  <div className="space-y-2">
                    {day.store_location && (
                      <div className="text-center mb-2">
                        <div className="flex items-center justify-center space-x-1">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="font-bold text-sm">{day.store_location}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-sm justify-center">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">
                        {day.start_time} - {day.end_time}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-center">
                        <span className="text-lg font-bold">{day.hours}h</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <span className="text-sm text-gray-400">Off</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-700">Weekly Total:</span>
            <span className="text-2xl font-bold text-blue-600">{totalHours} hours</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Store Locations</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className={`${getStoreColor('Main Store')} rounded-lg p-3 flex items-center space-x-2`}>
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">Main Store</span>
          </div>
          <div className={`${getStoreColor('North Branch')} rounded-lg p-3 flex items-center space-x-2`}>
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">North Branch</span>
          </div>
          <div className={`${getStoreColor('South Branch')} rounded-lg p-3 flex items-center space-x-2`}>
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">South Branch</span>
          </div>
          <div className={`${getStoreColor('East Location')} rounded-lg p-3 flex items-center space-x-2`}>
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">East Location</span>
          </div>
          <div className={`${getStoreColor('West Location')} rounded-lg p-3 flex items-center space-x-2`}>
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">West Location</span>
          </div>
          <div className={`${getStoreColor('Downtown')} rounded-lg p-3 flex items-center space-x-2`}>
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">Downtown</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Schedule Information</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Your schedule is updated by your manager</li>
          <li>• Check regularly for any changes or updates</li>
          <li>• Contact your manager if you have questions about your schedule</li>
        </ul>
      </div>
    </div>
  );
};

export default EmployeeScheduleView;
