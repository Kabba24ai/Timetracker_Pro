import React from 'react';
import { Palmtree, CalendarOff, CircleSlash, Stethoscope, Scale, HeartCrack, PartyPopper, CalendarCheck } from 'lucide-react';
import { DayStatusCode, TimeOffStatus } from '../../lib/schedule';

// A shared, read-only status pill for the Work Schedule surfaces (employee page
// AND the admin grid overlay). Approved Vacation / Unpaid Time Off / generic Time
// Off, an explicit Day Off, and the schedule-owned DISPLAY statuses a manager
// sets on the grid. No hours, balances, or private detail — purely the
// operational availability state.
//
// Colors are drawn from the palette already in use across the admin UI
// (indigo/amber/slate/green/blue/rose/violet), not from a mockup.

export type ScheduleStatus = TimeOffStatus | DayStatusCode | 'day_off';

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
  // Schedule display statuses (vacation / unpaid_time_off reuse the entries
  // above, so the same absence never changes color between the two sources).
  sick: {
    label: 'Sick',
    cls: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: <Stethoscope className="h-3 w-3" />,
  },
  paid_time_off: {
    label: 'Paid Time Off',
    cls: 'bg-green-100 text-green-700 border-green-200',
    icon: <CalendarCheck className="h-3 w-3" />,
  },
  jury_duty: {
    label: 'Jury Duty',
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Scale className="h-3 w-3" />,
  },
  bereavement: {
    label: 'Bereavement',
    cls: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: <HeartCrack className="h-3 w-3" />,
  },
  holiday: {
    label: 'Holiday',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <PartyPopper className="h-3 w-3" />,
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
