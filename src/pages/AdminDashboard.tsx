import React, { useState } from 'react';
import { Users, Settings, Calendar, Clock, CalendarDays } from 'lucide-react';
import Header from '../components/Header';
import EmployeeManagement from '../components/admin/EmployeeManagement';
import TimeReports from '../components/admin/TimeReports';
import VacationManagement from '../components/admin/VacationManagement';
import SystemSettings from '../components/admin/SystemSettings';
import WorkSchedule from '../components/admin/WorkSchedule';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('employees');

  const tabs = [
    { id: 'employees', name: 'Employees', icon: Users },
    { id: 'time-reports', name: 'Time Reports', icon: Clock },
    { id: 'work-schedule', name: 'Work Schedule', icon: CalendarDays },
    { id: 'vacation', name: 'Vacation Management', icon: Calendar },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'employees':
        return <EmployeeManagement />;
      case 'time-reports':
        return <TimeReports />;
      case 'work-schedule':
        return <WorkSchedule />;
      case 'vacation':
        return <VacationManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <EmployeeManagement />;
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

        <div className="bg-white rounded-xl shadow-sm border">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;