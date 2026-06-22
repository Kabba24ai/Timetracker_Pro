import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatHoursToTime, formatSecondsToTime } from '../utils/helper';

const TENANT_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'UTC';

interface TimeEntry {
  id: string;
  employee_id: string;
  break_id?: number;
  entry_type: 'clock_in' | 'clock_out' | 'lunch_out' | 'lunch_in' | 'unpaid_out' | 'unpaid_in';
  rounded_time: string;
  timestamp: string;
  created_at: string;
}

interface PayPeriod {
  number: number;
  start_date: string;
  end_date: string;
  label: string;
}

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TENANT_TIMEZONE,
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TENANT_TIMEZONE,
    weekday: 'short',
    year: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatDateSimple = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-');

  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const PayrollHours: React.FC = () => {

  const { employee } = useAuth();

  const [loading, setLoading] = useState(true);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<PayPeriod | null>(null);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [showPayPeriodDropdown, setShowPayPeriodDropdown] = useState(false);
  const [dailyBreakdownData, setDailyBreakdownData] = useState<any[]>([]);
  const [periodType, setPeriodType] = useState<'current' | 'previous' | 'all'>('current');
  const [currentPeriodNumber, setCurrentPeriodNumber] = useState<number | null>(null);



  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const toggleDay = (date: string) =>
    setOpenDays((p) => ({ ...p, [date]: !p[date] }));

  const [openBreaks, setOpenBreaks] = useState<Record<string, boolean>>({});

  const toggleBreak = (key: string) =>
    setOpenBreaks(p => ({ ...p, [key]: !p[key] }));


  useEffect(() => {
    fetchPayPeriods();
  }, []);


  useEffect(() => {
    if (selectedPayPeriod && employee?.user_id) {
      setLoading(true);
      setDailyBreakdownData([]);
      handleViewDailyBreakdown(employee.user_id);
    }
  }, [selectedPayPeriod, employee]);

  const fetchPayPeriods = async () => {
    try {
      const res = await api.get('/time-reports/pay-periods');

      if (!res.success) return;

      const periods = res.data;
      const currentNumber = res.current_period;

      setPayPeriods(periods);
      setCurrentPeriodNumber(currentNumber);

      const current = periods.find((p: any) => p.number === currentNumber);

      if (current) {
        setSelectedPayPeriod(current);
      }

    } catch (error) {
      console.error(error);
    }
  };
  const handlePeriodTypeChange = (type: 'current' | 'previous' | 'all') => {
    setPeriodType(type);

    if (type === 'current') {
      const current = payPeriods.find(p => p.number === currentPeriodNumber);
      if (current) setSelectedPayPeriod(current);
    }

    if (type === 'previous') {
      const index = payPeriods.findIndex(p => p.number === currentPeriodNumber);
      if (index > 0) {
        setSelectedPayPeriod(payPeriods[index - 1]);
      }
    }

    if (type === 'all') {
      // setSelectedPayPeriod(null);
    }

    setShowPayPeriodDropdown(false); // cleanup
  };
  const normalizeTime = (t: any) => {
    if (!t) return null;

    // If already string
    if (typeof t === 'string') return t;

    // If object with adjusted/actual
    return t.actual || t.adjusted || null;
  };
  const convertDailyToFlatEntries = (dailyData: any[]) => {
    const flat: TimeEntry[] = [];

    dailyData.forEach(day => {
      day.entries.forEach((entry: any) => {

        //  Clock In first
        if (entry.clock_in) {
          flat.push({
            id: `${entry.entry_id}-in`,
            employee_id: '',
            entry_type: 'clock_in',
            rounded_time: entry.clock_in.adjusted,
            timestamp: normalizeTime(entry.clock_in),
            created_at: normalizeTime(entry.clock_in),
          });
        }

        //  Lunch breaks
        entry.lunch_breaks?.forEach((l: any, i: number) => {
          flat.push({
            id: `${entry.entry_id}-lunch-out-${i}`,
            employee_id: '',
            break_id: l.id,
            entry_type: 'lunch_out',
            rounded_time: l.start.adjusted,
            timestamp: normalizeTime(l.start),
            created_at: normalizeTime(l.start),
          });

          flat.push({
            id: `${entry.entry_id}-lunch-in-${i}`,
            employee_id: '',
            entry_type: 'lunch_in',
            break_id: l.id,
            rounded_time: l.end.adjusted,
            timestamp: normalizeTime(l.end),
            created_at: normalizeTime(l.end),
          });
        });

        //  Unpaid breaks
        entry.unpaid_breaks?.forEach((u: any, i: number) => {
          flat.push({
            id: `${entry.entry_id}-unpaid-out-${i}`,
            employee_id: '',
            entry_type: 'unpaid_out',
            break_id: u.id,
            rounded_time: u.start.adjusted,
            timestamp: normalizeTime(u.start),
            created_at: normalizeTime(u.start),
          });

          flat.push({
            id: `${entry.entry_id}-unpaid-in-${i}`,
            employee_id: '',
            entry_type: 'unpaid_in',
            break_id: u.id,
            rounded_time: u.end.adjusted,
            timestamp: normalizeTime(u.end),
            created_at: normalizeTime(u.end),
          });
        });

        //  Clock Out last
        if (entry.clock_out) {
          flat.push({
            id: `${entry.entry_id}-out`,
            employee_id: '',
            entry_type: 'clock_out',
            rounded_time: entry.clock_out.adjusted,
            timestamp: normalizeTime(entry.clock_out),
            created_at: normalizeTime(entry.clock_out),
          });
        }

      });
    });

    return flat.filter(e => e.timestamp);
  };

  const handleViewDailyBreakdown = async (employeeId: string) => {
    await generateDailyBreakdown(employeeId);
  };


  const generateDailyBreakdown = async (employeeId: string) => {
    if (!selectedPayPeriod) return;

    try {
      const res = await api.get<{
        success: boolean;
        data: any[];
      }>(`/users/time-entries-list/${employeeId}?pay_period=${selectedPayPeriod.number}`);

      if (!res.success) {
        setDailyBreakdownData([]);

        return;
      }

      // Backend already returns daily breakdown
      setDailyBreakdownData(res.data);

      // setLoading(false);

    } catch (err) {
      console.error('Daily breakdown fetch failed', err);
      setDailyBreakdownData([]);

    } finally {
      setLoading(false);
    }
  };


  const TimeCell = ({ adjusted, actual, className = "" }: any) => {
    if (!adjusted) return <span className="text-gray-400">-</span>;

    return (
      <div className={className}>
        <div className=" font-semibold">{formatTime(new Date(adjusted))}</div>
        {actual && (
          <div className="  italic text-gray-500">
            {formatTime(new Date(actual))}
          </div>
        )}
      </div>
    );
  };


  const BreakCell = ({
    breaks,
    type, // "lunch" | "unpaid"
    side, // "start" | "end"
    entryId,
    colorClass,
  }: {
    breaks: any[] | undefined;
    type: "lunch" | "unpaid";
    side: "start" | "end";
    entryId: number | string;
    colorClass: string;
  }) => {
    const count = breaks?.length ?? 0;
    const key = `${entryId}-${type}-${side}`;

    if (count === 0) return <span className="text-gray-400">-</span>;

    //  single break -> show directly
    if (count === 1) {
      const b = breaks![0];
      return (
        <TimeCell
          adjusted={b?.[side]?.adjusted}
          actual={b?.[side]?.actual}
          className={colorClass}
        />
      );
    }

    //  multiple breaks -> expandable in SAME CELL
    return (
      <div className="mt-1 space-y-1 animate-in fade-in duration-200">

        <div className="align-top">
          <button
            onClick={() => toggleBreak(key)}
            className={`${colorClass}  font-medium  flex items-center gap-1`}
          >
            <span
              className={`inline-block transition-transform duration-200 ${openBreaks[key] ? "rotate-90" : ""
                }`}
            >
              ▸
            </span>
            {count} breaks
          </button>

          {openBreaks[key] && (
            <div className="mt-2 space-y-1 rounded-md bg-white p-2 border border-gray-300 shadow-sm">
              {breaks!.map((b, i) => (
                <TimeCell
                  key={i}
                  adjusted={b?.[side]?.adjusted}
                  actual={b?.[side]?.actual}
                  className={colorClass}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const grandTotals = dailyBreakdownData.reduce(
    (acc, day) => {

      acc.worked += Number(day.totals?.worked_hours ?? 0);

      acc.unpaid += Number(day.totals?.unpaid_hours ?? 0);

      acc.paid += Number(day.totals?.paid_hours ?? 0);

      return acc;

    },
    {
      worked: 0,
      unpaid: 0,
      paid: 0,
    }
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">

        {/* LEFT SIDE */}
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Payroll Hours
          </h2>
        </div>


      </div>

      <div className="flex items-center justify-between mt-3 mb-3">

        <div className='flex items-center justify-between gap-2'>
          <Calendar className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            Pay Period:
          </span>
        </div>

        {/* LEFT: options */}
        <div className="flex items-center gap-6">

          {/* CURRENT */}
          <button
            onClick={() => handlePeriodTypeChange('current')}
            className="flex items-center gap-2 text-sm"
          >
            <span className={`w-4 h-4 rounded-full border flex items-center justify-center
              ${periodType === 'current'
                ? 'border-gray-700'
                : 'border-gray-300'}
            `}>
              {periodType === 'current' && (
                <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
              )}
            </span>

            <span className="text-gray-900 font-medium">
              Current:
            </span>

            <span className="text-gray-600">
              {payPeriods.find(p => p.number === currentPeriodNumber)?.label}
            </span>
          </button>


          {/* PREVIOUS */}
          <button
            onClick={() => handlePeriodTypeChange('previous')}
            className="flex items-center gap-2 text-sm"
          >
            <span className={`w-4 h-4 rounded-full border flex items-center justify-center
              ${periodType === 'previous'
                ? 'border-gray-700'
                : 'border-gray-300'}
            `}>
              {periodType === 'previous' && (
                <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
              )}
            </span>

            <span className="text-gray-900 font-medium">
              Previous:
            </span>

            <span className="text-gray-600">
              {payPeriods[
                payPeriods.findIndex(p => p.number === currentPeriodNumber) - 1
              ]?.label}
            </span>
          </button>


          {/* ALL */}
          <button
            onClick={() => handlePeriodTypeChange('all')}
            className="flex items-center gap-2 text-sm"
          >
            <span className={`w-4 h-4 rounded-full border flex items-center justify-center
              ${periodType === 'all'
                ? 'border-gray-700'
                : 'border-gray-300'}
            `}>
              {periodType === 'all' && (
                <span className="w-2 h-2 bg-gray-700 rounded-full"></span>
              )}
            </span>

            <span className="text-gray-900 font-medium">All</span>
          </button>

        </div>


        {/* RIGHT: dropdown */}
        <div className="relative">
          <button
            disabled={periodType !== 'all'}
            onClick={() => {
              if (periodType === 'all') {
                setShowPayPeriodDropdown(!showPayPeriodDropdown);
              }
            }}
            className={`w-80 px-4 py-2 text-sm text-left border rounded-lg flex items-center justify-between
              ${periodType !== 'all'
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white border-gray-300 hover:bg-gray-50'}
            `}
          >
            <span className="truncate text-gray-700">
              {selectedPayPeriod
                ? `Period ${selectedPayPeriod.number}: ${selectedPayPeriod.label}`
                : 'Select pay period'}
            </span>

            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {showPayPeriodDropdown && (
            <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-md max-h-60 overflow-y-auto z-20">
              {payPeriods.map((period) => (
                <button
                  key={period.number}
                  onClick={() => {
                    setSelectedPayPeriod(period);
                    setShowPayPeriodDropdown(false);
                    setPeriodType('all');
                  }}
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50
                    ${selectedPayPeriod?.number === period.number
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-700'}
                  `}
                >
                  Period {period.number}: {period.label}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="space-y-6">
        <div className="overflow-x-auto border rounded-lg">

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : (

            <div className="overflow-x-auto">
              <table className="min-w-full ">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Date</th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Clock In</th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Lunch<br /><span className=" text-gray-500">Start</span></th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Lunch<br /><span className=" text-gray-500">End</span></th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Unpaid<br /><span className=" text-gray-500">Start</span></th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Unpaid<br /><span className=" text-gray-500">End</span></th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Clock Out</th>
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Total Paid</th>
                 
                    <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Total Unpaid</th>
                       <th className="whitespace-nowrap text-left py-3 px-2 font-medium text-gray-900">Total Hours</th>
                  </tr>
                </thead>

                <tbody>
                  {dailyBreakdownData.map((day, dayIndex) => {

                    const entryCount = day.entries?.length ?? 0;

                    const isSingle = entryCount === 1;
                    const isEmpty = entryCount === 0;
                    const isOpen = !isSingle && !!openDays[day.date];
                    const entry = day.entries?.[0];
                    const dayBg =
                      dayIndex % 2 === 0 ? "bg-white" : "bg-gray-50";

                    const dayHover =
                      dayIndex % 2 === 0 ? " " : " ";

                    return (
                      <React.Fragment key={day.date}>
                        {/* DAY SUMMARY ROW */}
                        <tr className={`border-b border-gray-300 ${dayBg} ${dayHover} transition-colors`}>
                          <td className="whitespace-nowrap py-3 px-2 font-medium text-gray-900">
                            <button
                              onClick={() => {
                                if (!isSingle) toggleDay(day.date);
                              }}

                              className={`flex items-center gap-2 ${entryCount > 1 ? 'hover:text-blue-600' : 'cursor-default'
                                }`}
                            >

                              <span className="whitespace-nowrap inline-block w-4">
                                {entryCount > 1 && (
                                  <span
                                    className={`inline-block transition-transform duration-200 ${isOpen ? 'rotate-90' : ''
                                      }`}
                                  >
                                    ▸
                                  </span>
                                )}
                              </span>

                              {formatDateSimple(day.date)}

                            </button>
                          </td>

                          {/* Show dash in time columns for summary row */}
                          {/* TIME COLUMNS */}
                          {
                            isEmpty ? (
                              <>
                                <td className="py-3 px-2 text-gray-400">-</td>
                                <td className="py-3 px-2 text-gray-400">-</td>
                                <td className="py-3 px-2 text-gray-400">-</td>
                                <td className="py-3 px-2 text-gray-400">-</td>
                                <td className="py-3 px-2 text-gray-400">-</td>
                                <td className="py-3 px-2 text-gray-400">-</td>
                              </>
                            ) : isSingle ? (
                              <>
                                {/* Clock In */}
                                <td className="whitespace-nowrap py-3 px-2">
                                  <TimeCell
                                    adjusted={entry.clock_in?.adjusted}
                                    actual={entry.clock_in?.actual}
                                    className="text-green-600"
                                  />
                                </td>

                                {/* Lunch Start */}
                                <td className="whitespace-nowrap py-3 px-2 align-top">
                                  <BreakCell
                                    breaks={entry?.lunch_breaks}
                                    type="lunch"
                                    side="start"
                                    entryId={entry?.entry_id}
                                    colorClass="text-orange-600"
                                  />
                                </td>

                                {/* Lunch End */}
                                <td className="whitespace-nowrap py-3 px-2 align-top">
                                  <BreakCell
                                    breaks={entry?.lunch_breaks}
                                    type="lunch"
                                    side="end"
                                    entryId={entry?.entry_id}
                                    colorClass="text-orange-600"
                                  />
                                </td>

                                {/* Unpaid Start */}
                                <td className="whitespace-nowrap py-3 px-2 align-top">
                                  <BreakCell
                                    breaks={entry?.unpaid_breaks}
                                    type="unpaid"
                                    side="start"
                                    entryId={entry?.entry_id}
                                    colorClass="text-purple-600"
                                  />
                                </td>

                                {/* Unpaid End */}
                                <td className="whitespace-nowrap py-3 px-2 align-top">
                                  <BreakCell
                                    breaks={entry?.unpaid_breaks}
                                    type="unpaid"
                                    side="end"
                                    entryId={entry?.entry_id}
                                    colorClass="text-purple-600"
                                  />
                                </td>

                                {/* Clock Out */}
                                <td className="whitespace-nowrap py-3 px-2">
                                  <TimeCell
                                    adjusted={entry.clock_out?.adjusted}
                                    actual={entry.clock_out?.actual}
                                    className="text-red-600"
                                  />
                                </td>
                              </>
                            ) : (
                              <td colSpan={6} className="py-3 px-2 text-center">
                                <button
                                  onClick={() => toggleDay(day.date)}
                                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Show all entries ({entryCount})
                                </button>
                              </td>

                            )
                          }
                          <td className="py-3 px-2  text-green-600 font-semibold">
                            {formatHoursToTime(day.totals?.paid_hours ?? 0)}
                            {/* {Number(day.totals?.paid_hours ?? 0).toFixed(2)} */}
                          </td>


                          <td className="py-3 px-2  text-red-600 font-semibold">
                            {formatHoursToTime(day.totals?.unpaid_hours ?? 0)}
                            {/* {Number(day.totals?.unpaid_hours ?? 0).toFixed(2)} */}
                          </td>
                          {/* DAY TOTALS */}
                          <td className="py-3 px-2  text-blue-600 font-semibold">
                            {formatHoursToTime(day.totals?.worked_hours ?? 0)}
                            {/* {Number(day.totals?.worked_hours ?? 0).toFixed(2)} */}
                          </td>
                        </tr>

                        {/* EXPANDED ENTRIES */}
                        {!isSingle && isOpen &&
                          day.entries.map((entry, entryIndex) => (
                            <tr
                              key={entry.entry_id}
                              className="whitespace-nowrap border-b border-gray-200 bg-gray-100
                                transition-colors duration-200 "

                            >
                              {/* Empty date cell for entry row */}
                              <td className="py-3 px-2  text-gray-600">
                                <span className="inline-flex items-center gap-1">

                                  Entry {entryIndex + 1}
                                </span>
                              </td>


                              {/* Clock In */}
                              <td className="whitespace-nowrap py-3 px-2">
                                <TimeCell
                                  adjusted={entry.clock_in?.adjusted}
                                  actual={entry.clock_in?.actual}
                                  className="text-green-600"
                                />
                              </td>

                              {/* Lunch Start / End (show first lunch break or list) */}
                              <td className="whitespace-nowrap py-3 px-2 align-top">
                                <BreakCell
                                  breaks={entry.lunch_breaks}
                                  type="lunch"
                                  side="start"
                                  entryId={entry.entry_id}
                                  colorClass="text-orange-600"
                                />
                              </td>


                              <td className="whitespace-nowrap py-3 px-2 align-top">
                                <BreakCell
                                  breaks={entry.lunch_breaks}
                                  type="lunch"
                                  side="end"
                                  entryId={entry.entry_id}
                                  colorClass="text-orange-600"
                                />
                              </td>


                              {/* Unpaid Start / End */}
                              <td className="whitespace-nowrap py-3 px-2 align-top">
                                <BreakCell
                                  breaks={entry.unpaid_breaks}
                                  type="unpaid"
                                  side="start"
                                  entryId={entry.entry_id}
                                  colorClass="text-purple-600"
                                />
                              </td>


                              <td className="whitespace-nowrap py-3 px-2 align-top">
                                <BreakCell
                                  breaks={entry.unpaid_breaks}
                                  type="unpaid"
                                  side="end"
                                  entryId={entry.entry_id}
                                  colorClass="text-purple-600"
                                />
                              </td>


                              {/* Clock Out */}
                              <td className="py-3 px-2">
                                <TimeCell
                                  adjusted={entry.clock_out?.adjusted}
                                  actual={entry.clock_out?.actual}
                                  className="text-red-600"
                                />
                              </td>
                              <td className="py-3 px-2  font-semibold text-green-700 bg-green-50">
                                {formatSecondsToTime(Number(entry.paid_seconds ?? 0))}
                                {/* {(Number(entry.paid_seconds ?? 0) / 3600).toFixed(2)} */}
                              </td>

                              <td className="py-3 px-2  font-semibold text-red-700 bg-red-50">
                                {formatSecondsToTime(Number(entry.unpaid_seconds ?? 0))}
                                {/* {(Number(entry.unpaid_seconds ?? 0) / 3600).toFixed(2)} */}
                              </td>

                              {/* Entry totals (instead of repeating day totals) */}
                              <td className="py-3 px-2  font-semibold text-blue-700 bg-blue-50">
                                {formatSecondsToTime(Number(entry.worked_seconds ?? 0))}
                                {/* {(Number(entry.worked_seconds ?? 0) / 3600).toFixed(2)} */}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                  <tr className="border-t-2 border-gray-400 bg-gray-100 sticky bottom-0">

                    <td
                      colSpan={7}
                      className="py-4 px-2 text-right font-bold text-gray-900 text-sm"
                    >
                      Grand Totals
                    </td>
                    <td className="py-4 px-2 font-bold text-green-700 bg-green-100">
                      {formatHoursToTime(grandTotals.paid)}
                    </td>


                    <td className="py-4 px-2 font-bold text-red-700 bg-red-100">
                      {formatHoursToTime(grandTotals.unpaid)}
                    </td>
                    <td className="py-4 px-2 font-bold text-blue-700 bg-blue-100">
                      {formatHoursToTime(grandTotals.worked)}
                    </td>


                  </tr>
                </tbody>

              </table>
            </div>

          )}

          {!loading && dailyBreakdownData.length === 0 && (
            <div className="p-6 bg-gray-50 rounded-lg border text-center">
              <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                No time data found for this pay period.
              </p>
            </div>
          )}


        </div>
      </div>
    </div>
  );

};

export default PayrollHours;