import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTimeClock } from '../contexts/TimeClockContext';
import TimeClockCard from '../components/TimeClockCard';
import TodayTimeEntries from '../components/TodayTimeEntries';
import VacationSummary from '../components/VacationSummary';
import Header from '../components/Header';

const EmployeeDashboard: React.FC = () => {
  const { employee } = useAuth();
  const { refreshEntries } = useTimeClock();
  const [currentTime, setCurrentTime] = useState(new Date());

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <TimeClockCard />
            <TodayTimeEntries />
          </div>
          <div>
            <VacationSummary />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;