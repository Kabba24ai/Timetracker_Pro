import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AchievementGoal {
  id: string;
  goal_name: string;
  icon: string;
  color: string;
  description: string;
}

interface MonthlySummary {
  id: string;
  year: number;
  month: number;
  days_present: number;
  days_late: number;
  days_missed: number;
  days_excused: number;
  total_minutes_late: number;
  achievement: AchievementGoal | null;
}

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  status: string;
  check_in_time: string | null;
  minutes_late: number;
}

const EmployeeAttendance: React.FC = () => {
  const { employee } = useAuth();
  const [currentSummary, setCurrentSummary] = useState<MonthlySummary | null>(null);
  const [previousSummaries, setPreviousSummaries] = useState<MonthlySummary[]>([]);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (employee) {
      loadAttendanceData();
    }
  }, [employee, selectedMonth, selectedYear]);

  const loadAttendanceData = async () => {
    if (!employee) return;
    setLoading(true);

    const { data: summary } = await supabase
      .from('monthly_attendance_summary')
      .select('*, achievement:achievement_goals(*)')
      .eq('employee_id', employee.id)
      .eq('year', selectedYear)
      .eq('month', selectedMonth)
      .maybeSingle();

    if (summary) {
      setCurrentSummary(summary as any);
    } else {
      setCurrentSummary(null);
    }

    const { data: previous } = await supabase
      .from('monthly_attendance_summary')
      .select('*, achievement:achievement_goals(*)')
      .eq('employee_id', employee.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6);

    if (previous) {
      setPreviousSummaries(previous as any);
    }

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);

    const { data: records } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('attendance_date', startDate.toISOString().split('T')[0])
      .lte('attendance_date', endDate.toISOString().split('T')[0])
      .order('attendance_date', { ascending: false });

    if (records) {
      setRecentRecords(records);
    }

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
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Overview</h2>
          <p className="text-gray-600 mt-1">Track your attendance and achievements</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentSummary && currentSummary.achievement && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-6xl">{currentSummary.achievement.icon}</div>
              <div>
                <h3 className="text-2xl font-bold" style={{ color: currentSummary.achievement.color }}>
                  {currentSummary.achievement.goal_name}
                </h3>
                <p className="text-gray-700 mt-1">{currentSummary.achievement.description}</p>
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
              <p className="text-3xl font-bold text-green-600 mt-2">{currentSummary?.days_present || 0}</p>
            </div>
            <Calendar className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Days Late</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{currentSummary?.days_late || 0}</p>
            </div>
            <Clock className="h-10 w-10 text-orange-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Days Missed</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{currentSummary?.days_missed || 0}</p>
            </div>
            <Calendar className="h-10 w-10 text-red-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Minutes Late</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{currentSummary?.total_minutes_late || 0}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-200" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Recent Attendance Records</h3>
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
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Achievement History</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {previousSummaries.slice(0, 6).map((summary) => (
              <div key={summary.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600">
                    {new Date(summary.year, summary.month - 1, 1).toLocaleString('default', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  {summary.achievement && <span className="text-2xl">{summary.achievement.icon}</span>}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Present:</span>
                    <span className="font-semibold text-green-600">{summary.days_present}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Late:</span>
                    <span className="font-semibold text-orange-600">{summary.days_late}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Missed:</span>
                    <span className="font-semibold text-red-600">{summary.days_missed}</span>
                  </div>
                </div>
                {summary.achievement && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs font-medium" style={{ color: summary.achievement.color }}>
                      {summary.achievement.goal_name}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAttendance;
