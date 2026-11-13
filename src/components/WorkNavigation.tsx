import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, History } from 'lucide-react';

const NAV_BTN =
  'inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors';

/**
 * Dashboard sidebar navigation: the Work History and Work Schedule buttons only.
 * The full pages own the detail; nothing is fetched here.
 */
const WorkNavigation: React.FC = () => (
  <nav aria-label="Work History and Work Schedule" className="rounded-lg border border-gray-200 p-4">
    <div className="grid grid-cols-2 gap-2">
      <Link to="/history" className={NAV_BTN}>
        <History className="h-4 w-4" />
        <span>Work History</span>
      </Link>
      <Link to="/schedule" className={NAV_BTN}>
        <CalendarDays className="h-4 w-4" />
        <span>Work Schedule</span>
      </Link>
    </div>
  </nav>
);

export default WorkNavigation;
