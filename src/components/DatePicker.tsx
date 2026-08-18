import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

// A lightweight, self-contained calendar date picker. Employees can click a day
// from the calendar OR type/keep an ISO date manually — no external date lib and
// no reliance on the browser's native date control. Value is 'YYYY-MM-DD'.

interface Props {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  min?: string; // inclusive lower bound (YYYY-MM-DD)
  label?: string; // accessible name for the text input
  id?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const parse = (iso: string): { y: number; m: number; d: number } | null => {
  if (!ISO.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
};

const DatePicker: React.FC<Props> = ({ value, onChange, min, label, id }) => {
  const [open, setOpen] = useState(false);
  // Which month the calendar is showing.
  const parsed = parse(value);
  const today = new Date();
  const [view, setView] = useState<{ y: number; m: number }>(() =>
    parsed ? { y: parsed.y, m: parsed.m } : { y: today.getFullYear(), m: today.getMonth() },
  );
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the visible month in sync when an external/typed value lands on a valid date.
  useEffect(() => {
    const p = parse(value);
    if (p) setView({ y: p.y, m: p.m });
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return cells;
  }, [view]);

  const disabled = (d: number) => (min ? toISO(view.y, view.m, d) < min : false);
  const isSelected = (d: number) => parsed && parsed.y === view.y && parsed.m === view.m && parsed.d === d;

  const pick = (d: number) => {
    if (disabled(d)) return;
    onChange(toISO(view.y, view.m, d));
    setOpen(false);
  };

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-stretch">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          className="w-full rounded-l-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`${label ?? 'Date'} calendar`}
          className="flex items-center rounded-r-lg border border-l-0 border-gray-300 px-2 text-gray-500 hover:bg-gray-50"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg" role="dialog">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded p-1 hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-gray-800">
              {MONTHS[view.m]} {view.y}
            </div>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded p-1 hover:bg-gray-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-gray-400">
            {DOW.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {grid.map((d, i) =>
              d === null ? (
                <div key={`e${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  disabled={disabled(d)}
                  aria-label={toISO(view.y, view.m, d)}
                  className={`rounded py-1 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent ${
                    isSelected(d) ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-gray-700'
                  }`}
                >
                  {d}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
