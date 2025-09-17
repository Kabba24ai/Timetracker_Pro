import React, { useEffect, useState } from 'react';
import { Calendar, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VacationData {
  allotted_hours: number;
  accrued_hours: number;
  used_hours: number;
  hours_worked_this_year: number;
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

  useEffect(() => {
    if (employee) {
      fetchVacationData();
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
          <p>• Contact HR to request vacation time</p>
          <p>• Hours update daily based on time entries</p>
        </div>
      </div>
    </div>
  );
};

export default VacationSummary;