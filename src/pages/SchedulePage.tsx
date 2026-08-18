import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft } from 'lucide-react';
import Header from '../components/Header';
import EmployeeWorkSchedule from '../components/schedule/EmployeeWorkSchedule';

// Employee Work Schedule page — the read-only schedule for every authenticated
// employee, reached from the Time Clock card's "Work Schedule" button.
const SchedulePage: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <Header />

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft className="h-4 w-4" />
          <span>Back</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <CalendarDays className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Work Schedule</h1>
        </div>
      </div>

      <EmployeeWorkSchedule />
    </div>
  </div>
);

export default SchedulePage;
