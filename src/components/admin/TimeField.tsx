import React, { useRef } from 'react';

// A fast, purpose-built 12-hour time control: Hour (1–12) · Minute (00–59) ·
// AM/PM. Digits overwrite on focus; two hour digits advance to minute; tab order
// is Hour → Minute → AM/PM. Shared by the Time Review correction modal and the
// Work Schedule cell editor — one time-entry surface, no duplication.

export interface Clock {
  h: number; // 1–12
  m: number; // 0–59
  ampm: 'AM' | 'PM';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:MM' (24h) → {h,m,ampm}. */
export function parse24(t: string): Clock {
  const [hh, mm] = t.split(':').map(Number);
  const ampm: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return { h, m: mm || 0, ampm };
}

/** {h,m,ampm} → 'HH:MM' (24h). */
export function to24(c: Clock): string {
  let hh = c.h % 12;
  if (c.ampm === 'PM') hh += 12;
  return `${pad(hh)}:${pad(c.m)}`;
}

interface Props {
  value: Clock;
  onChange: (c: Clock) => void;
  autoFocus?: boolean;
  label?: string; // used to disambiguate the Hour/Minute aria-labels when several are on screen
}

const TimeField: React.FC<Props> = ({ value, onChange, autoFocus, label }) => {
  const minuteRef = useRef<HTMLInputElement>(null);
  const prefix = label ? `${label} ` : '';

  const setHour = (raw: string, andAdvance: boolean) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    const h = digits === '' ? 0 : Math.min(12, parseInt(digits, 10));
    onChange({ ...value, h });
    if (andAdvance && (digits.length === 2 || parseInt(digits || '0', 10) > 1)) minuteRef.current?.select();
  };
  const setMinute = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    const m = digits === '' ? 0 : Math.min(59, parseInt(digits, 10));
    onChange({ ...value, m });
  };

  const cell = 'w-14 text-center px-2 py-2 border border-gray-300 rounded-lg font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={`${prefix}Hour`}
        inputMode="numeric"
        value={value.h ? String(value.h) : ''}
        autoFocus={autoFocus}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setHour(e.target.value, true)}
        onBlur={(e) => setHour(e.target.value, false)}
        className={cell}
      />
      <span className="text-lg font-semibold text-gray-400">:</span>
      <input
        aria-label={`${prefix}Minute`}
        ref={minuteRef}
        inputMode="numeric"
        value={pad(value.m)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setMinute(e.target.value)}
        className={cell}
      />
      <select
        aria-label={`${prefix}AM/PM`}
        value={value.ampm}
        onChange={(e) => onChange({ ...value, ampm: e.target.value as 'AM' | 'PM' })}
        className="ml-1 px-2 py-2 border border-gray-300 rounded-lg bg-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimeField;
