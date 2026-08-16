import React, { useState } from 'react';
import { Users, Settings, Calendar, Clock, CalendarDays, Award, BarChart3 } from 'lucide-react';
import Header from '../components/Header';
import EmployeeManagement from '../components/admin/EmployeeManagement';
import PayPeriodSummaryGrid from '../components/admin/PayPeriodSummary';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import VacationManagement from '../components/admin/VacationManagement';
import SystemSettings from '../components/admin/SystemSettings';
import WorkSchedule from '../components/admin/WorkSchedule';
import AttendanceTracking from '../components/admin/AttendanceTracking';

interface DrillDown {
  userId: number;
  from: string;
  to: string;
  nonce: number; // forces a re-target even if the same employee/range is reused
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pay-periods');
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  const tabs = [
    { id: 'pay-periods', name: 'Pay Periods', icon: BarChart3 },
    { id: 'time-review', name: 'Time Review', icon: Clock },
    { id: 'employees', name: 'Employees', icon: Users },
    { id: 'attendance', name: 'Attendance', icon: Award },
    { id: 'work-schedule', name: 'Work Schedule', icon: CalendarDays },
    { id: 'vacation', name: 'Vacation Management', icon: Calendar },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  // Clicking an employee row in the pay-period grid opens their Time Review
  // scoped to the same period.
  const openDrillDown = (userId: number, from: string, to: string) => {
    setDrillDown({ userId, from, to, nonce: Date.now() });
    setActiveTab('time-review');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'pay-periods':
        return <PayPeriodSummaryGrid onDrillDown={openDrillDown} />;
      case 'time-review':
        return (
          <TimeReviewV2
            key={drillDown?.nonce ?? 'default'}
            initialUserId={drillDown?.userId}
            initialFrom={drillDown?.from}
            initialTo={drillDown?.to}
          />
        );
      case 'employees':
        return <EmployeeManagement />;
      case 'attendance':
        return <AttendanceTracking />;
      case 'work-schedule':
        return <WorkSchedule />;
      case 'vacation':
        return <VacationManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <PayPeriodSummaryGrid onDrillDown={openDrillDown} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage employees, time tracking, and system settings</p>
        </div>

        <div className="mb-6">
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="bg-white rounded-xl shadow-sm border">{renderContent()}</div>
      </div>
    </div>
  );
};

export default AdminDashboard;
