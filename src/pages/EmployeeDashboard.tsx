import React, { useState, useEffect } from 'react';
import { Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTimeClock } from '../contexts/TimeClockContext';
import TimeClockCard from '../components/TimeClockCard';
import TodayTimeEntries from '../components/TodayTimeEntries';
import VacationSummary from '../components/VacationSummary';
import EmployeeAttendance from '../components/EmployeeAttendance';
import Header from '../components/Header';

const EmployeeDashboard: React.FC = () => {
  const { employee } = useAuth();
  const { refreshEntries } = useTimeClock();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance'>('overview');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refreshEntries();
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {employee.first_name}!</h1>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0">
            <p className="text-xl text-gray-600">{formatDate(currentTime)}</p>
            <p className="text-2xl font-mono text-blue-600">{formatTime(currentTime)}</p>
          </div>
        </div>

        <div className="mb-6">
          <nav className="flex space-x-1 bg-white border rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'attendance'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Award className="h-5 w-5" />
              <span>Attendance</span>
            </button>
          </nav>
        </div>

        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <TimeClockCard />
              <TodayTimeEntries />
            </div>
            <div>
              <VacationSummary />
            </div>
          </div>
        ) : (
          <EmployeeAttendance />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;