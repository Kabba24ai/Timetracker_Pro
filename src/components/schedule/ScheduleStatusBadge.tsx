import React from 'react';
import { Palmtree, CalendarOff, CircleSlash } from 'lucide-react';
import { TimeOffStatus } from '../../lib/schedule';

// A shared, read-only status pill for the Work Schedule surfaces (employee page
// AND the admin grid overlay). Approved Vacation / Unpaid Time Off / generic Time
// Off, plus an explicit Day Off. No hours, balances, or private detail — purely
// the operational availability state.

export type ScheduleStatus = TimeOffStatus | 'day_off';

const STYLES: Record<ScheduleStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  vacation: {
    label: 'Vacation',
    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: <Palmtree className="h-3 w-3" />,
  },
  unpaid_time_off: {
    label: 'Unpaid Time Off',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <CircleSlash className="h-3 w-3" />,
  },
  time_off: {
    label: 'Time Off',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <CircleSlash className="h-3 w-3" />,
  },
  day_off: {
    label: 'Day Off',
    cls: 'bg-gray-50 text-gray-400 border-gray-200',
    icon: <CalendarOff className="h-3 w-3" />,
  },
};

const ScheduleStatusBadge: React.FC<{ status: ScheduleStatus; label?: string; partial?: boolean; className?: string }> = ({
  status,
  label,
  partial = false,
  className = '',
}) => {
  const cfg = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium whitespace-nowrap ${cfg.cls} ${className}`}
    >
      {cfg.icon}
      <span>{label ?? cfg.label}{partial ? ' (partial)' : ''}</span>
    </span>
  );
};

export default ScheduleStatusBadge;
