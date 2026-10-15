import React, { useState } from 'react';
import { Users, Settings, Calendar, Clock, CalendarDays, Award, BarChart3 } from 'lucide-react';
import Header from '../components/Header';
import EmployeeManagement from '../components/admin/EmployeeManagement';
import PayPeriodSummaryGrid, {
  defaultPayPeriodView,
  type PayPeriodView,
} from '../components/admin/PayPeriodSummary';
import TimeReviewV2 from '../components/admin/TimeReviewV2';
import VacationManagement from '../components/admin/VacationManagement';
import SystemSettings from '../components/admin/SystemSettings';
import WorkScheduleV2 from '../components/admin/WorkScheduleV2';
import AttendanceV2 from '../components/admin/AttendanceV2';
import type { PeriodSelection } from '../lib/admin';

interface DrillDown {
  userId: number;
  nonce: number; // forces a re-target even if the same employee is reused
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pay-periods');
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  // The ONE pay-period selection for the dashboard lives HERE, not inside either
  // tab: Pay Periods and Time Review both show — and change — this period. So a
  // drill-down opens the employee on the period the summary showed, and switching
  // tabs or coming back never resets it. Sort and Exceptions-only ride along for
  // the summary. Each tab remounts and refetches, so corrections just made inside
  // Time Review are reflected immediately.
  const [payPeriodView, setPayPeriodView] = useState<PayPeriodView>(defaultPayPeriodView);
  const changeSelection = (selection: PeriodSelection) => setPayPeriodView((view) => ({ ...view, ...selection }));

  const tabs = [
    { id: 'pay-periods', name: 'Pay Periods', icon: BarChart3 },
    { id: 'time-review', name: 'Time Review', icon: Clock },
    { id: 'employees', name: 'Employees', icon: Users },
    { id: 'attendance', name: 'Attendance', icon: Award },
    { id: 'work-schedule', name: 'Work Schedule', icon: CalendarDays },
    { id: 'vacation', name: 'Vacation Management', icon: Calendar },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  // Clicking an employee row in the pay-period grid opens their Time Review on
  // the same (shared) period.
  const openDrillDown = (userId: number) => {
    setDrillDown({ userId, nonce: Date.now() });
    setActiveTab('time-review');
  };

  // Return from a drill-down to the pay period the administrator came from.
  const backToSummary = () => {
    setDrillDown(null);
    setActiveTab('pay-periods');
  };

  const summaryGrid = (
    <PayPeriodSummaryGrid
      onDrillDown={openDrillDown}
      view={payPeriodView}
      onViewChange={setPayPeriodView}
    />
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'pay-periods':
        return summaryGrid;
      case 'time-review':
        return (
          <TimeReviewV2
            key={drillDown?.nonce ?? 'default'}
            initialUserId={drillDown?.userId}
            selection={payPeriodView}
            onSelectionChange={changeSelection}
            onBack={drillDown ? backToSummary : undefined}
          />
        );
      case 'employees':
        return <EmployeeManagement />;
      case 'attendance':
        return <AttendanceV2 />;
      case 'work-schedule':
        return <WorkScheduleV2 />;
      case 'vacation':
        return <VacationManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return summaryGrid;
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
