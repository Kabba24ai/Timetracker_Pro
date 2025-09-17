import React, { useState, useEffect } from 'react';
import { Calendar, Edit, Save, X } from 'lucide-react';

interface VacationRecord {
  id?: string;
  employee_id: string;
  employee_name: string;
  allotted_hours: number;
  accrued_hours: number;
  used_hours: number;
}

// Mock vacation data for demo
const mockVacationRecords: VacationRecord[] = [
  {
    id: '1',
    employee_id: '1',
    employee_name: 'John Doe',
    allotted_hours: 80,
    accrued_hours: 24.5,
    used_hours: 8.0,
  },
  {
    id: '2',
    employee_id: '3',
    employee_name: 'Jane Smith',
    allotted_hours: 80,
    accrued_hours: 32.0,
    used_hours: 16.0,
  },
  {
    id: '3',
    employee_id: '2',
    employee_name: 'Admin User',
    allotted_hours: 120,
    accrued_hours: 28.0,
    used_hours: 0.0,
  }
];

const VacationManagement: React.FC = () => {
  const [vacationRecords, setVacationRecords] = useState<VacationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ allotted_hours: number; used_hours: number }>({
    allotted_hours: 0,
    used_hours: 0,
  });

  useEffect(() => {
    fetchVacationRecords();
  }, []);

  const fetchVacationRecords = async () => {
    try {
      // Use mock data for demo
      setVacationRecords(mockVacationRecords);
    } catch (error) {
      console.error('Error fetching vacation records:', error);
    } finally {
      setLoading(false);
    }
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

  const startEditing = (record: VacationRecord) => {
    setEditingId(record.employee_id);
    setEditValues({
      allotted_hours: record.allotted_hours,
      used_hours: record.used_hours,
    });
  };

  const saveChanges = async (employeeId: string) => {
    try {
      // In demo mode, just update local state
      setVacationRecords(prev => 
        prev.map(record => 
          record.employee_id === employeeId 
            ? { ...record, ...editValues }
            : record
        )
      );

      setEditingId(null);
    } catch (error) {
      console.error('Error saving vacation data:', error);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({ allotted_hours: 0, used_hours: 0 });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Calendar className="h-6 w-6 text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-900">Vacation Management</h2>
      </div>

      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> Changes are temporary and will reset on page refresh.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Allotted Hours</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Accrued Hours</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Used Hours</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Available</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vacationRecords.map((record) => {
                const available = record.accrued_hours - record.used_hours;
                const isEditing = editingId === record.employee_id;

                return (
                  <tr key={record.employee_id} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-3 px-4 font-medium text-gray-900">{record.employee_name}</td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.allotted_hours}
                          onChange={(e) => setEditValues(prev => ({ 
                            ...prev, 
                            allotted_hours: Number(e.target.value) 
                          }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          min="0"
                        />
                      ) : (
                        <span className="text-gray-600">{record.allotted_hours}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-blue-600 font-semibold">
                      {record.accrued_hours.toFixed(1)}
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.used_hours}
                          onChange={(e) => setEditValues(prev => ({ 
                            ...prev, 
                            used_hours: Number(e.target.value) 
                          }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          min="0"
                          step="0.5"
                        />
                      ) : (
                        <span className="text-red-600">{record.used_hours}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          available > 0 ? 'text-green-600' : 'text-gray-600'
                        }`}
                      >
                        {available.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => saveChanges(record.employee_id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(record)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500 space-y-1">
        <p>• Vacation accrues at 1 hour per 26 hours worked</p>
        <p>• Allotted hours represent the annual vacation allowance</p>
        <p>• Used hours can be manually adjusted for vacation requests</p>
      </div>
    </div>
  );
};

export default VacationManagement;