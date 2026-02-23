import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, TrendingUp, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateForApi } from '../utils/date';

import { useAuth } from '../contexts/AuthContext';
import { DateRangeOption, dateRangeOptions, getDateRange } from '../lib/dateRanges';
import {
  AttendanceRecord,
  AttendanceStats,
  AchievementGoal,
} from '../types';

const TENANT_TIMEZONE =
  import.meta.env.VITE_APP_TIMEZONE || 'UTC';


const EmployeeAttendance: React.FC = () => {
  const { employee } = useAuth();

    const [currentStats, setCurrentStats] = useState<AttendanceStats | null>(null);
const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);


  const [loading, setLoading] = useState(true);
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('current-month');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState(10);
const [lastPage, setLastPage] = useState(1);
const [total, setTotal] = useState(0);


// useEffect(() => {
//   if (!employee) return;

//   if (dateRangeOption === 'select-month' && !selectedMonth) {
//     return;
//   }

//   loadAttendanceData();
// }, [employee, dateRangeOption, selectedMonth]);


useEffect(() => {
  if (!employee) return;
  loadAttendanceData();
}, [employee, page, perPage, dateRangeOption, selectedMonth]);

useEffect(() => {
  setPage(1);
}, [dateRangeOption, selectedMonth]);





const loadAttendanceData = async () => {
  if (!employee) return;

  setLoading(true);

  const dateRange = getDateRange(dateRangeOption, selectedMonth);

  const startDate = formatDateForApi(dateRange.startDate);
  const endDate   = formatDateForApi(dateRange.endDate);

  const res = await api.get<{
    data: AttendanceRecord[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  }>(
    `/attendance?start_date=${startDate}&end_date=${endDate}&page=${page}&per_page=${perPage}`
  );

  if (!res.success) {
    setLoading(false);
    return;
  }

  setRecentRecords(res.data);
  setLastPage(res.meta.last_page);
  setTotal(res.meta.total);
setCurrentStats(res.stats);
  setLoading(false);
};





  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'text-green-600 bg-green-50';
      case 'late':
        return 'text-orange-600 bg-orange-50';
      case 'missed':
        return 'text-red-600 bg-red-50';
      case 'excused':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

const formatDate = (dateString: string) => {
  const date = new Date(dateString);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};


  const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: TENANT_TIMEZONE,
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};


  const currentDateRange = getDateRange(dateRangeOption, selectedMonth);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Overview</h2>
          <p className="text-gray-600 mt-1">Track your attendance and achievements</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            value={dateRangeOption}
            onChange={(e) => {
              const newOption = e.target.value as DateRangeOption;
              setDateRangeOption(newOption);

              if (newOption === 'select-month') {
                setShowMonthPicker(true);
              } else {
                setShowMonthPicker(false);
                setSelectedMonth(new Date()); //  reset to current
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {(dateRangeOption === 'select-month' || showMonthPicker) && (
            <input
              type="month"
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600 flex items-center">
        <Calendar className="inline h-4 w-4 mr-2" />
        {currentDateRange.label}
      </div>

      {currentStats && currentStats.achievement && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-6xl">{currentStats.achievement.icon}</div>
              <div>
                <h3 className="text-2xl font-bold" style={{ color: currentStats.achievement.color }}>
                  {currentStats.achievement.goal_name}
                </h3>
                <p className="text-gray-700 mt-1">{currentStats.achievement.description}</p>
              </div>
            </div>
            <Trophy className="h-16 w-16 text-blue-300" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Days Present</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{currentStats?.days_present || 0}</p>
            </div>
            <Calendar className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Days Late</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{currentStats?.days_late || 0}</p>
            </div>
            <Clock className="h-10 w-10 text-orange-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Days Missed</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{currentStats?.days_missed || 0}</p>
            </div>
            <Calendar className="h-10 w-10 text-red-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Minutes Late</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{currentStats?.total_minutes_late || 0}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-200" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Minutes Late
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No attendance records found for this period
                  </td>
                </tr>
              ) : (
                recentRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.attendance_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          record.status
                        )}`}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatTime(record.check_in_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {record.minutes_late > 0 ? (
                        <span className="font-semibold text-orange-600">{record.minutes_late} min</span>
                      ) : (
                        <span className="text-gray-400">On time</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between  px-6 py-4">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
          </p>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Prev
            </button>

            <button
              disabled={page === lastPage}
              onClick={() => setPage(p => Math.min(p + 1, lastPage))}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeAttendance;
