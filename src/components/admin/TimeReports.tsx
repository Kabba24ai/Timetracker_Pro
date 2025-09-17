import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Download, Edit, Plus, Save, X, Trash2, ChevronDown } from 'lucide-react';

interface TimeEntry {
  id: string;
  employee_id: string;
  entry_type: 'clock_in' | 'clock_out' | 'lunch_out' | 'lunch_in' | 'unpaid_out' | 'unpaid_in';
  timestamp: string;
  created_at: string;
}

interface TimeReportData {
  employee_name: string;
  employee_id: string;
  total_hours: number;
  lunch_hours: number;
  unpaid_hours: number;
  paid_hours: number;
}

interface PayPeriod {
  number: number;
  start_date: string;
  end_date: string;
  label: string;
}

// Mock report data for demo
const mockReportData: TimeReportData[] = [
  {
    employee_name: 'John Doe',
    employee_id: '1',
    total_hours: 38.5,
    lunch_hours: 4.0,
    unpaid_hours: 1.5,
    paid_hours: 33.0,
  },
  {
    employee_name: 'Jane Smith',
    employee_id: '3',
    total_hours: 42.0,
    lunch_hours: 5.0,
    unpaid_hours: 0.5,
    paid_hours: 36.5,
  },
  {
    employee_name: 'Admin User',
    employee_id: '2',
    total_hours: 35.0,
    lunch_hours: 3.0,
    unpaid_hours: 0.0,
    paid_hours: 32.0,
  }
];

const TimeReports: React.FC = () => {
  const [reportData, setReportData] = useState<TimeReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [employeeEntries, setEmployeeEntries] = useState<TimeEntry[]>([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    entry_type: 'clock_in' as TimeEntry['entry_type'],
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
  });
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<PayPeriod | null>(null);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [showPayPeriodDropdown, setShowPayPeriodDropdown] = useState(false);

  useEffect(() => {
    generatePayPeriods();
  }, []);

  useEffect(() => {
    if (selectedPayPeriod) {
      fetchTimeReports();
    }
  }, [selectedPayPeriod]);

  const generatePayPeriods = () => {
    // Get pay period settings from localStorage
    const savedSettings = localStorage.getItem('demo_system_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {
      pay_period_type: 'biweekly',
      pay_period_start_date: '2024-01-01'
    };

    const startDate = new Date(settings.pay_period_start_date);
    const periodLength = settings.pay_period_type === 'weekly' ? 7 : 14;
    const periods: PayPeriod[] = [];
    const currentDate = new Date();

    // Generate periods from start date to current date + 2 periods ahead
    let periodStart = new Date(startDate);
    let periodNumber = 1;

    while (periodStart <= new Date(currentDate.getTime() + (periodLength * 2 * 24 * 60 * 60 * 1000))) {
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + periodLength - 1);

      periods.push({
        number: periodNumber,
        start_date: periodStart.toISOString().split('T')[0],
        end_date: periodEnd.toISOString().split('T')[0],
        label: `Period ${periodNumber}: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`
      });

      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() + 1);
      periodNumber++;
    }

    setPayPeriods(periods);
    
    // Set current pay period as default
    const currentPeriod = periods.find(period => {
      const today = new Date().toISOString().split('T')[0];
      return today >= period.start_date && today <= period.end_date;
    });
    
    if (currentPeriod) {
      setSelectedPayPeriod(currentPeriod);
    } else if (periods.length > 0) {
      setSelectedPayPeriod(periods[periods.length - 1]);
    }
  };

  const fetchTimeReports = async () => {
    setLoading(true);
    try {
      // Use mock data for demo
      setReportData(mockReportData);
    } catch (error) {
      console.error('Error fetching time reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeEntries = async (employeeId: string) => {
    try {
      // Get entries from localStorage for demo
      const storageKey = `time_entries_${employeeId}`;
      const savedEntries = localStorage.getItem(storageKey);
      
      let entries: TimeEntry[] = [];
      if (savedEntries) {
        const allEntries = JSON.parse(savedEntries);
        // Filter for selected pay period
        entries = allEntries.filter((entry: TimeEntry) => {
          const entryDate = entry.timestamp.split('T')[0];
          return selectedPayPeriod && 
                 entryDate >= selectedPayPeriod.start_date && 
                 entryDate <= selectedPayPeriod.end_date;
        });
      }
      
      // Sort by timestamp
      entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setEmployeeEntries(entries);
    } catch (error) {
      console.error('Error fetching employee entries:', error);
    }
  };

  const handleEditEmployee = (employeeId: string) => {
    setEditingEmployee(employeeId);
    fetchEmployeeEntries(employeeId);
  };

  const handleAddEntry = async () => {
    if (!editingEmployee) return;

    const timestamp = `${newEntry.date}T${newEntry.time}:00.000Z`;
    const entry: TimeEntry = {
      id: Date.now().toString(),
      employee_id: editingEmployee,
      entry_type: newEntry.entry_type,
      timestamp,
      created_at: new Date().toISOString(),
    };

    try {
      // Save to localStorage for demo
      const storageKey = `time_entries_${editingEmployee}`;
      const savedEntries = localStorage.getItem(storageKey);
      const entries = savedEntries ? JSON.parse(savedEntries) : [];
      entries.push(entry);
      localStorage.setItem(storageKey, JSON.stringify(entries));

      // Refresh entries
      await fetchEmployeeEntries(editingEmployee);
      setShowAddEntry(false);
      setNewEntry({
        entry_type: 'clock_in',
        date: new Date().toISOString().split('T')[0],
        time: '08:00',
      });
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!editingEmployee) return;

    try {
      // Remove from localStorage for demo
      const storageKey = `time_entries_${editingEmployee}`;
      const savedEntries = localStorage.getItem(storageKey);
      if (savedEntries) {
        const entries = JSON.parse(savedEntries);
        const updatedEntries = entries.filter((entry: TimeEntry) => entry.id !== entryId);
        localStorage.setItem(storageKey, JSON.stringify(updatedEntries));
      }

      // Refresh entries
      await fetchEmployeeEntries(editingEmployee);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const getEntryTypeLabel = (entryType: string) => {
    const labels: { [key: string]: string } = {
      clock_in: 'Clock In',
      clock_out: 'Clock Out',
      lunch_out: 'Lunch Start',
      lunch_in: 'Lunch End',
      unpaid_out: 'Unpaid Start',
      unpaid_in: 'Unpaid End',
    };
    return labels[entryType] || entryType;
  };

  const getEntryTypeColor = (entryType: string) => {
    switch (entryType) {
      case 'clock_in':
        return 'text-green-600 bg-green-50';
      case 'clock_out':
        return 'text-red-600 bg-red-50';
      case 'lunch_out':
      case 'lunch_in':
        return 'text-orange-600 bg-orange-50';
      case 'unpaid_out':
      case 'unpaid_in':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  };

  if (editingEmployee) {
    const employee = reportData.find(r => r.employee_id === editingEmployee);
    
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setEditingEmployee(null)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <Clock className="h-6 w-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Manage Time Entries - {employee?.employee_name}
            </h2>
          </div>
          <button
            onClick={() => setShowAddEntry(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Entry</span>
          </button>
        </div>

        {showAddEntry && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Add New Time Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type</label>
                <select
                  value={newEntry.entry_type}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, entry_type: e.target.value as TimeEntry['entry_type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="clock_in">Clock In</option>
                  <option value="clock_out">Clock Out</option>
                  <option value="lunch_out">Lunch Start</option>
                  <option value="lunch_in">Lunch End</option>
                  <option value="unpaid_out">Unpaid Start</option>
                  <option value="unpaid_in">Unpaid End</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={newEntry.time}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  onClick={handleAddEntry}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Add</span>
                </button>
                <button
                  onClick={() => setShowAddEntry(false)}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Entry Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeEntries.map((entry) => {
                  const { date, time } = formatDateTime(entry.timestamp);
                  return (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-white">
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getEntryTypeColor(entry.entry_type)}`}>
                          {getEntryTypeLabel(entry.entry_type)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900">{date}</td>
                      <td className="py-3 px-4 font-mono text-gray-900">{time}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {employeeEntries.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No time entries found for the selected pay period.</p>
              <p className="text-sm text-gray-400 mt-1">Add entries using the button above.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Time Reports</h2>
        </div>
        <button className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> Showing sample time report data. Select a pay period and click "Edit" to manage individual employee time entries.
        </p>
      </div>

      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Pay Period:</label>
        </div>
        <div className="relative mt-2">
          <button
            onClick={() => setShowPayPeriodDropdown(!showPayPeriodDropdown)}
            className="w-full md:w-96 px-4 py-2 text-left bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
          >
            <span className="text-gray-900">
              {selectedPayPeriod ? selectedPayPeriod.label : 'Select a pay period...'}
            </span>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>
          
          {showPayPeriodDropdown && (
            <div className="absolute z-10 w-full md:w-96 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {payPeriods.map((period) => (
                <button
                  key={period.number}
                  onClick={() => {
                    setSelectedPayPeriod(period);
                    setShowPayPeriodDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 ${
                    selectedPayPeriod?.number === period.number ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading reports...</p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Employee</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Lunch Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Unpaid Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Paid Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((report) => (
                  <tr key={report.employee_id} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-3 px-4 font-medium text-gray-900">{report.employee_name}</td>
                    <td className="py-3 px-4 text-blue-600 font-semibold">
                      {report.total_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-orange-600 font-medium">
                      {report.lunch_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-red-600 font-medium">
                      {report.unpaid_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-green-600 font-semibold">
                      {report.paid_hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleEditEmployee(report.employee_id)}
                        className="flex items-center space-x-1 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reportData.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No time data found for the selected pay period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeReports;