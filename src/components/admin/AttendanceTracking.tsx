import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, TrendingUp, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { AchievementGoal } from '../../types/achievement';
import { formatDateForApi } from '../../utils/date';


import toast from 'react-hot-toast';


import { DateRangeOption, dateRangeOptions, getDateRange } from '../../lib/dateRanges';


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

  const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState(10);
const [lastPage, setLastPage] = useState(1);
const [total, setTotal] = useState(0);


  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState<AchievementGoal | null>(null);
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('current-month');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadGoals();
  }, []);


  useEffect(() => {
  if (activeTab === 'goals') {
    loadGoals();
  }
}, [activeTab]);


useEffect(() => {
  if (activeTab === 'summaries') {
    loadAggregatedAttendance();
  }
}, [activeTab, page, perPage, dateRangeOption, selectedMonth]);

useEffect(() => {
  setPage(1);
}, [perPage, dateRangeOption, selectedMonth]);


  const loadGoals = async () => {
    try {
      const response = await api.get('/achievement-goals');

      if (response.success == true) {
        setGoals(response.data);
      } else {
        setGoals([]);
      }

    } catch (error) {
      console.error('Failed to load achievement goals', error);
      setGoals([]);
    }

  };

const loadAggregatedAttendance = async () => {
  setLoading(true);

  const dateRange = getDateRange(dateRangeOption, selectedMonth);

  const start = formatDateForApi(dateRange.startDate);
  const end   = formatDateForApi(dateRange.endDate);

  const res = await api.get(
    `/users/attendance/summary` +
    `?start_date=${start}` +
    `&end_date=${end}` +
    `&page=${page}` +
    `&per_page=${perPage}`
  );

  if (!res.success) {
    toast.error('Failed to load attendance summary');
    setAggregatedStats([]);
    setLoading(false);
    return;
  }

  setAggregatedStats(res.data);
  setPage(res.meta.current_page);
  setLastPage(res.meta.last_page);
  setTotal(res.meta.total);
  setLoading(false);
};





  const saveGoal = async (goal: Partial<AchievementGoal>) => {
    setIsSavingGoal(true);
    setFieldErrors({}); // clear previous errors

    try {
      if (goal.id) {
        await api.put(`/achievement-goals/update/${goal.id}`, goal);
        toast.success('Achievement goal updated successfully');
      } else {
        await api.post('/achievement-goals/store', goal);
        toast.success('Achievement goal created successfully');
      }

      setEditingGoal(null);
      await loadGoals();

    } catch (error: any) {
      console.error('Failed to save goal', error);

      //  Laravel validation error (fetch-style)
      if (error?.errors) {
        setFieldErrors(error.errors);
        toast.error(error.message || 'Validation failed');
      } else {
        toast.error(error?.message || 'Something went wrong');
      }

    } finally {
      setIsSavingGoal(false);
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

  const from = total === 0 ? 0 : Math.min((page - 1) * perPage + 1, total);
  const to = Math.min(page * perPage, total);


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
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'summaries'
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
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'goals'
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

          <div className="bg-white rounded-lg border overflow-x-auto">
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{from}</span> to{' '}
              <span className="font-medium">{to}</span> of{' '}
              <span className="font-medium">{total}</span> results
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Rows:</label>
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                >
                  {[5, 10, 30, 50, 100, 500].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                >
                  Prev
                </button>

                <button
                  disabled={page === lastPage}
                  onClick={() => setPage(p => Math.min(p + 1, lastPage))}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name *</label>
                    <input
                      type="text"
                      value={editingGoal.goal_name}
                      onChange={(e) => {
                        setEditingGoal({ ...editingGoal, goal_name: e.target.value });

                        // clear field error on change
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.goal_name;
                          return copy;
                        });
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent
                      ${fieldErrors.goal_name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                        }`}
                    />


                    {fieldErrors.goal_name && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.goal_name[0]}
                      </p>
                    )}
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Order *</label>
                      <input
                        type="number"
                        value={editingGoal.display_order}
                      

                        onChange={(e) => {
                        setEditingGoal({ ...editingGoal, display_order: parseInt(e.target.value) });

                        // clear field error on change
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.display_order;
                          return copy;
                        });
                      }}


                         className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent
                      ${fieldErrors.goal_name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                        }`}
                      />
                       {fieldErrors.display_order && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.display_order[0]}
                      </p>
                    )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji) *</label>
                      <input
                        type="text"
                        value={editingGoal.icon}

                        onChange={(e) => {
                        setEditingGoal({ ...editingGoal, icon: e.target.value });

                        // clear field error on change
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.icon;
                          return copy;
                        });
                      }}

                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent
                      ${fieldErrors.goal_name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                        }`}

                      />

                    {fieldErrors.icon && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.icon[0]}
                      </p>
                    )}

                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color (Hex) *</label>
                      <input
                        type="text"
                        value={editingGoal.color}
                        
                        onChange={(e) => {
                        setEditingGoal({ ...editingGoal, color: e.target.value });

                        // clear field error on change
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.color;
                          return copy;
                        });
                      }}

                         className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent
                      ${fieldErrors.goal_name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                        }`}

                      />
                          {fieldErrors.color && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.color[0]}
                      </p>
                    )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Days Missed *</label>
                      <input
                        type="number"
                        value={editingGoal.days_missed_max}
                        onChange={(e) => {
                          setEditingGoal({
                            ...editingGoal,
                            days_missed_max: parseInt(e.target.value),
                          });

                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.days_missed_max;
                            return copy;
                          });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg
                         ${fieldErrors.days_missed_max
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                          }`} />

                      {fieldErrors.days_missed_max && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors.days_missed_max[0]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Days Late *</label>
                      <input
                        type="number"
                        value={editingGoal.days_late_max}
                        // onChange={(e) => setEditingGoal({ ...editingGoal, days_late_max: parseInt(e.target.value) })}
                        // className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                         onChange={(e) => {
                          setEditingGoal({
                            ...editingGoal,
                            days_late_max: parseInt(e.target.value),
                          });

                          setFieldErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.days_late_max;
                            return copy;
                          });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg
                         ${fieldErrors.days_late_max
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                          }`} 

                      />

                        {fieldErrors.days_late_max && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors.days_late_max[0]}
                        </p>
                      )}

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
                    disabled={isSavingGoal}
                    className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${isSavingGoal
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {isSavingGoal && (
                      // <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    )}
                    {isSavingGoal ? 'Saving...' : 'Save Goal'}
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
