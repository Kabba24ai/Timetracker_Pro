import React, { useEffect, useState } from 'react';
import { Calendar, TrendingUp, Clock, Plus, X, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VacationData {
  allotted_hours: number;
  accrued_hours: number;
  used_hours: number;
  hours_worked_this_year: number;
}

interface VacationRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  hours: number;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
}

const VacationSummary: React.FC = () => {
  const { employee } = useAuth();
  const [vacationData, setVacationData] = useState<VacationData>({
    allotted_hours: 0,
    accrued_hours: 0,
    used_hours: 0,
    hours_worked_this_year: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [newRequest, setNewRequest] = useState({
    start_date: '',
    end_date: '',
    hours: 8,
  });

  useEffect(() => {
    if (employee) {
      fetchVacationData();
      fetchVacationRequests();
    }
  }, [employee]);

  const fetchVacationData = async () => {
    try {
      // Get demo vacation data from localStorage
      const vacationKey = `vacation_${employee.id}`;
      const savedVacation = localStorage.getItem(vacationKey);
      const vacation = savedVacation ? JSON.parse(savedVacation) : null;
      
      // Get time entries for this year
      const entriesKey = `time_entries_${employee.id}`;
      const savedEntries = localStorage.getItem(entriesKey);
      const currentYear = new Date().getFullYear();
      
      let timeEntries: any[] = [];
      if (savedEntries) {
        const allEntries = JSON.parse(savedEntries);
        timeEntries = allEntries.filter((entry: any) => 
          entry.timestamp.startsWith(currentYear.toString())
        );
      }
      
      const hoursWorked = calculateHoursWorked(timeEntries);
      const accruedHours = calculateAccruedHours(hoursWorked);

      setVacationData({
        allotted_hours: vacation?.allotted_hours || 80, // Default 2 weeks
        accrued_hours: accruedHours,
        used_hours: vacation?.used_hours || 0,
        hours_worked_this_year: hoursWorked,
      });
    } catch (error) {
      console.error('Error fetching vacation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVacationRequests = async () => {
    try {
      const requestsKey = `vacation_requests_${employee.id}`;
      const savedRequests = localStorage.getItem(requestsKey);
      const requests = savedRequests ? JSON.parse(savedRequests) : [];
      setVacationRequests(requests);
    } catch (error) {
      console.error('Error fetching vacation requests:', error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!employee || !newRequest.start_date || newRequest.hours <= 0) return;

    const endDate = calculateEndDate(newRequest.start_date, newRequest.hours);

    const request: VacationRequest = {
      id: Date.now().toString(),
      employee_id: employee.id,
      start_date: newRequest.start_date,
      end_date: endDate,
      hours: newRequest.hours,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    try {
      const requestsKey = `vacation_requests_${employee.id}`;
      const savedRequests = localStorage.getItem(requestsKey);
      const requests = savedRequests ? JSON.parse(savedRequests) : [];
      requests.push(request);
      localStorage.setItem(requestsKey, JSON.stringify(requests));

      setVacationRequests(requests);
      setShowRequestForm(false);
      setNewRequest({ start_date: '', end_date: '', hours: 8 });
    } catch (error) {
      console.error('Error submitting vacation request:', error);
    }
  };

  const handleCancelRequest = () => {
    setShowRequestForm(false);
    setNewRequest({ start_date: '', end_date: '', hours: 8 });
  };

  const calculateEndDate = (startDate: string, hours: number) => {
    const start = new Date(startDate);
    const workDaysNeeded = Math.ceil(hours / 8); // 8 hours per work day
    let currentDate = new Date(start);
    let workDaysAdded = 0;
    
    // Get holiday settings
    const savedSettings = localStorage.getItem('demo_system_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : null;
    const year = start.getFullYear().toString();
    const holidays = settings?.holidays?.[year] || {};
    
    // Get holiday dates for the year
    const holidayDates = getHolidayDates(year, holidays);
    
    // Add work days, skipping weekends
    while (workDaysAdded < workDaysNeeded) {
      const dayOfWeek = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];
      
      // If it's a weekday (Monday = 1, Friday = 5) and not a holiday, count it
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidayDates.includes(dateString)) {
        workDaysAdded++;
      }
      
      // If we haven't reached the required work days, move to next day
      if (workDaysAdded < workDaysNeeded) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getHolidayDates = (year: string, holidays: any) => {
    const yearNum = parseInt(year);
    const dates: string[] = [];
    
    if (holidays.new_years_day) {
      dates.push(`${year}-01-01`);
    }
    
    if (holidays.memorial_day) {
      // Last Monday in May
      const may = new Date(yearNum, 4, 31);
      const lastMonday = new Date(may);
      lastMonday.setDate(31 - (may.getDay() + 6) % 7);
      dates.push(lastMonday.toISOString().split('T')[0]);
    }
    
    if (holidays.independence_day) {
      dates.push(`${year}-07-04`);
    }
    
    if (holidays.labor_day) {
      // First Monday in September
      const sept = new Date(yearNum, 8, 1);
      const firstMonday = new Date(sept);
      firstMonday.setDate(1 + (8 - sept.getDay()) % 7);
      dates.push(firstMonday.toISOString().split('T')[0]);
    }
    
    if (holidays.thanksgiving_day) {
      // Fourth Thursday in November
      const nov = new Date(yearNum, 10, 1);
      const firstThursday = new Date(nov);
      firstThursday.setDate(1 + (11 - nov.getDay()) % 7);
      const fourthThursday = new Date(firstThursday);
      fourthThursday.setDate(firstThursday.getDate() + 21);
      dates.push(fourthThursday.toISOString().split('T')[0]);
    }
    
    if (holidays.christmas_day) {
      dates.push(`${year}-12-25`);
    }
    
    // Add floating holidays
    if (holidays.floating_holidays) {
      Object.entries(holidays.floating_holidays).forEach(([date, holiday]: [string, any]) => {
        if (holiday.enabled) {
          dates.push(date);
        }
      });
    }
    
    return dates;
  };

  const calculateHoursWorked = (entries: any[]) => {
    let totalHours = 0;
    let clockInTime: Date | null = null;
    let lunchStartTime: Date | null = null;
    let unpaidStartTime: Date | null = null;

    entries.forEach((entry) => {
      const entryTime = new Date(entry.timestamp);

      switch (entry.entry_type) {
        case 'clock_in':
          clockInTime = entryTime;
          break;
        case 'clock_out':
          if (clockInTime) {
            const hoursWorked = (entryTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
            totalHours += hoursWorked;
            clockInTime = null;
          }
          break;
        case 'lunch_out':
          lunchStartTime = entryTime;
          break;
        case 'lunch_in':
          if (lunchStartTime) {
            const lunchHours = (entryTime.getTime() - lunchStartTime.getTime()) / (1000 * 60 * 60);
            totalHours -= lunchHours;
            lunchStartTime = null;
          }
          break;
        case 'unpaid_out':
          unpaidStartTime = entryTime;
          break;
        case 'unpaid_in':
          if (unpaidStartTime) {
            const unpaidHours = (entryTime.getTime() - unpaidStartTime.getTime()) / (1000 * 60 * 60);
            totalHours -= unpaidHours;
            unpaidStartTime = null;
          }
          break;
      }
    });

    return Math.max(0, totalHours);
  };

  const calculateAccruedHours = (hoursWorked: number) => {
    // Accrue 1 hour of vacation for every 26 hours worked (standard rate)
    return Math.floor(hoursWorked / 26);
  };

  const availableHours = vacationData.accrued_hours - vacationData.used_hours;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-green-100 p-2 rounded-lg">
          <Calendar className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Vacation Summary</h2>
      </div>

      {showRequestForm && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Request Vacation Time</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={newRequest.start_date}
                onChange={(e) => setNewRequest(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
              <select
                value={newRequest.hours}
                onChange={(e) => setNewRequest(prev => ({ ...prev, hours: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={3}>3 hours</option>
                <option value={4}>4 hours (Half day)</option>
                <option value={5}>5 hours</option>
                <option value={6}>6 hours</option>
                <option value={7}>7 hours</option>
                <option value={8}>8 hours (Full day)</option>
                <option value={16}>16 hours (2 days)</option>
                <option value={24}>24 hours (3 days)</option>
                <option value={32}>32 hours (4 days)</option>
                <option value={40}>40 hours (5 days)</option>
                <option value={48}>48 hours (6 days)</option>
                <option value={56}>56 hours (7 days)</option>
                <option value={64}>64 hours (8 days)</option>
                <option value={72}>72 hours (9 days)</option>
                <option value={80}>80 hours (10 days)</option>
              </select>
            </div>
            {newRequest.start_date && newRequest.hours > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Calculated End Date:</strong> {calculateEndDate(newRequest.start_date, newRequest.hours)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Based on 8 hours per work day, excluding weekends
                </p>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSubmitRequest}
                disabled={!newRequest.start_date || newRequest.hours <= 0 || availableHours < newRequest.hours}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>Submit Request</span>
              </button>
              <button
                onClick={handleCancelRequest}
                className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>
            {availableHours < newRequest.hours && (
              <p className="text-sm text-red-600">
                Insufficient vacation hours available. You have {availableHours.toFixed(1)} hours available.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">Available Hours</p>
              <p className="text-sm text-gray-600">Ready to use</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{availableHours.toFixed(1)}</p>
        </div>

        <button
          onClick={() => setShowRequestForm(true)}
          disabled={availableHours <= 0}
          className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>Request Vacation Time</span>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600">Accrued</p>
            <p className="text-lg font-semibold text-green-600">{vacationData.accrued_hours.toFixed(1)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-gray-600">Used</p>
            <p className="text-lg font-semibold text-red-600">{vacationData.used_hours.toFixed(1)}</p>
          </div>
        </div>

        {vacationRequests.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Requests</h4>
            <div className="space-y-2">
              {vacationRequests.slice(-3).reverse().map((request) => (
                <div key={request.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()} ({request.hours} hours)
                    </p>
                    <p className="text-xs text-gray-500">
                      Requested {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    request.status === 'approved' ? 'bg-green-100 text-green-800' :
                    request.status === 'denied' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="h-4 w-4 text-gray-600" />
            <p className="text-sm font-medium text-gray-900">This Year</p>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Hours Worked:</span>
              <span className="font-medium">{vacationData.hours_worked_this_year.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Annual Allotment:</span>
              <span className="font-medium">{vacationData.allotted_hours}</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Vacation accrues at 1 hour per 26 hours worked</p>
          <p>• Submit vacation requests using the button above</p>
          <p>• Hours update daily based on time entries</p>
          <p>• Requests require manager approval</p>
        </div>
      </div>
    </div>
  );
};

export default VacationSummary;