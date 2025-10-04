import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, TrendingUp, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DateRangeOption, dateRangeOptions, getDateRange } from '../../lib/dateRanges';

interface AchievementGoal {
  id: string;
  goal_name: string;
  goal_type: string;
  display_order: number;
  icon: string;
  color: string;
  days_missed_max: number;
  days_late_max: number;
  description: string;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: string;
  check_in_time: string | null;
  minutes_late: number;
  employee: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface EmployeeAggregatedStats {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  days_present: number;
  days_late: number;
  days_missed: number;
  days_excused: number;
  total_minutes_late: number;
  achievement: AchievementGoal | null;
}

const AttendanceTracking: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'goals' | 'summaries'>('summaries');
  const [goals, setGoals] = useState<AchievementGoal[]>([]);
  const [aggregatedStats, setAggregatedStats] = useState<EmployeeAggregatedStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState<AchievementGoal | null>(null);
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('current-month');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, dateRangeOption, selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'goals') {
      await loadGoals();
    } else {
      await loadAggregatedAttendance();
    }
    setLoading(false);
  };

  const loadGoals = async () => {
    const { data, error } = await supabase
      .from('achievement_goals')
      .select('*')
      .order('display_order');

    if (!error && data) {
      setGoals(data);
    }
  };

  const loadAggregatedAttendance = async () => {
    const dateRange = getDateRange(dateRangeOption, selectedMonth);

    const startDateStr = dateRange.startDate.toISOString().split('T')[0];
    const endDateStr = dateRange.endDate.toISOString().split('T')[0];

    const { data: records, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        employee:employees(id, first_name, last_name, email)
      `)
      .gte('attendance_date', startDateStr)
      .lte('attendance_date', endDateStr)
      .order('attendance_date', { ascending: false });

    if (error || !records) {
      setAggregatedStats([]);
      return;
    }

    const { data: allGoals } = await supabase
      .from('achievement_goals')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    const employeeMap = new Map<string, EmployeeAggregatedStats>();

    records.forEach((record: any) => {
      const empId = record.employee.id;

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employee_id: empId,
          first_name: record.employee.first_name,
          last_name: record.employee.last_name,
          email: record.employee.email,
          days_present: 0,
          days_late: 0,
          days_missed: 0,
          days_excused: 0,
          total_minutes_late: 0,
          achievement: null,
        });
      }

      const stats = employeeMap.get(empId)!;

      if (record.status === 'present') stats.days_present++;
      else if (record.status === 'late') stats.days_late++;
      else if (record.status === 'missed') stats.days_missed++;
      else if (record.status === 'excused') stats.days_excused++;

      stats.total_minutes_late += record.minutes_late || 0;
    });

    const statsArray = Array.from(employeeMap.values());

    statsArray.forEach((stats) => {
      if (allGoals) {
        const matchingGoal = allGoals.find((goal: AchievementGoal) => {
          if (goal.goal_type === 'positive') {
            return stats.days_missed <= goal.days_missed_max && stats.days_late <= goal.days_late_max;
          } else {
            return stats.days_missed >= goal.days_missed_max || stats.days_late >= goal.days_late_max;
          }
        });
        stats.achievement = matchingGoal || null;
      }
    });

    setAggregatedStats(statsArray);
  };

  const saveGoal = async (goal: Partial<AchievementGoal>) => {
    if (goal.id) {
      const { error } = await supabase
        .from('achievement_goals')
        .update({
          goal_name: goal.goal_name,
          goal_type: goal.goal_type,
          display_order: goal.display_order,
          icon: goal.icon,
          color: goal.color,
          days_missed_max: goal.days_missed_max,
          days_late_max: goal.days_late_max,
          description: goal.description,
          is_active: goal.is_active,
        })
        .eq('id', goal.id);

      if (!error) {
        setEditingGoal(null);
        loadGoals();
      }
    } else {
      const { error } = await supabase
        .from('achievement_goals')
        .insert({
          goal_name: goal.goal_name,
          goal_type: goal.goal_type,
          display_order: goal.display_order,
          icon: goal.icon,
          color: goal.color,
          days_missed_max: goal.days_missed_max,
          days_late_max: goal.days_late_max,
          description: goal.description,
          is_active: goal.is_active ?? true,
        });

      if (!error) {
        setEditingGoal(null);
        loadGoals();
      }
    }
  };

  const recalculateAllSummaries = async () => {
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('is_active', true);

    if (employees) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      for (const employee of employees) {
        await supabase.rpc('calculate_monthly_summary', {
          p_employee_id: employee.id,
          p_year: year,
          p_month: month,
        });
      }
      loadAggregatedAttendance();
    }
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
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Attendance Tracking</h2>
        <p className="text-gray-600">Monitor employee attendance and manage achievement goals</p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('summaries')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'summaries'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Attendance Summary</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'goals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>Achievement Goals</span>
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'summaries' && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">View:</label>
              <select
                value={dateRangeOption}
                onChange={(e) => {
                  const newOption = e.target.value as DateRangeOption;
                  setDateRangeOption(newOption);
                  if (newOption === 'select-month') {
                    setShowMonthPicker(true);
                  } else {
                    setShowMonthPicker(false);
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
                <div className="flex items-center space-x-2">
                  <input
                    type="month"
                    value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-');
                      setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-600">
                <Calendar className="inline h-4 w-4 mr-1" />
                {currentDateRange.label}
              </div>
              <button
                onClick={recalculateAllSummaries}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Recalculate</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Missed
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mins Late
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Achievement
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aggregatedStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No attendance data for this period
                    </td>
                  </tr>
                ) : (
                  aggregatedStats.map((stats) => (
                    <tr key={stats.employee_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {stats.first_name} {stats.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{stats.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-green-600">{stats.days_present}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-orange-600">{stats.days_late}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-red-600">{stats.days_missed}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-blue-600">{stats.total_minutes_late}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {stats.achievement ? (
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-2xl">{stats.achievement.icon}</span>
                            <span className="text-sm font-medium" style={{ color: stats.achievement.color }}>
                              {stats.achievement.goal_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No achievement</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'goals' && (
        <div>
          <div className="mb-4">
            <button
              onClick={() =>
                setEditingGoal({
                  id: '',
                  goal_name: '',
                  goal_type: 'positive',
                  display_order: goals.length + 1,
                  icon: '🏆',
                  color: '#FFD700',
                  days_missed_max: 0,
                  days_late_max: 0,
                  description: '',
                  is_active: true,
                })
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add New Goal
            </button>
          </div>

          <div className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="bg-white p-6 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <span className="text-4xl">{goal.icon}</span>
                    <div>
                      <h4 className="text-lg font-semibold" style={{ color: goal.color }}>
                        {goal.goal_name}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                      <div className="mt-2 flex items-center space-x-4 text-sm">
                        <span className="text-gray-700">
                          <strong>Type:</strong>{' '}
                          <span className={goal.goal_type === 'positive' ? 'text-green-600' : 'text-red-600'}>
                            {goal.goal_type}
                          </span>
                        </span>
                        <span className="text-gray-700">
                          <strong>Max Missed:</strong> {goal.days_missed_max}
                        </span>
                        <span className="text-gray-700">
                          <strong>Max Late:</strong> {goal.days_late_max}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingGoal(goal)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editingGoal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">
                  {editingGoal.id ? 'Edit Achievement Goal' : 'Add Achievement Goal'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name</label>
                    <input
                      type="text"
                      value={editingGoal.goal_name}
                      onChange={(e) => setEditingGoal({ ...editingGoal, goal_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
                      <select
                        value={editingGoal.goal_type}
                        onChange={(e) => setEditingGoal({ ...editingGoal, goal_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="positive">Positive</option>
                        <option value="negative">Negative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={editingGoal.display_order}
                        onChange={(e) => setEditingGoal({ ...editingGoal, display_order: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                      <input
                        type="text"
                        value={editingGoal.icon}
                        onChange={(e) => setEditingGoal({ ...editingGoal, icon: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color (Hex)</label>
                      <input
                        type="text"
                        value={editingGoal.color}
                        onChange={(e) => setEditingGoal({ ...editingGoal, color: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Days Missed</label>
                      <input
                        type="number"
                        value={editingGoal.days_missed_max}
                        onChange={(e) =>
                          setEditingGoal({ ...editingGoal, days_missed_max: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Days Late</label>
                      <input
                        type="number"
                        value={editingGoal.days_late_max}
                        onChange={(e) => setEditingGoal({ ...editingGoal, days_late_max: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={editingGoal.description}
                      onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingGoal.is_active}
                      onChange={(e) => setEditingGoal({ ...editingGoal, is_active: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700">Active</label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingGoal(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveGoal(editingGoal)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Goal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceTracking;
