import React, { useEffect, useRef, useState } from 'react';

// A fast, purpose-built 12-hour time control: Hour (1–12) · Minute (00–59) ·
// AM/PM. Digits overwrite on focus; two hour digits advance to minute; tab order
// is Hour → Minute → AM/PM. Shared by the Time Review correction modal and the
// Work Schedule cell editor — one time-entry surface, no duplication.
//
// While a field is focused it holds a raw EDITING STRING BUFFER ("", "2", "27")
// so a half-typed value is never zero-padded, clamped, or reordered mid-entry
// (typing "27" must show "27", never collapse to "02"). The buffer is normalized
// — clamped to range and, for minutes, zero-padded — only on blur. The parent
// always receives the parsed numeric value so a commit (Apply) works even without
// an explicit blur.

export interface Clock {
  h: number; // 1–12
  m: number; // 0–59
  ampm: 'AM' | 'PM';
}

const pad = (n: number) => String(n).padStart(2, '0');
// Keep the LAST two digits typed. Select-on-focus makes the first keystroke
// replace the old value; but if the caret ever appends instead (mouse click that
// collapses the selection), keeping the trailing two digits still yields what the
// admin just typed — e.g. "02" + "7" → "027" → "27", never a stuck "02".
const digitsOf = (raw: string) => raw.replace(/\D/g, '').slice(-2);

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

const hourText = (h: number) => (h ? String(h) : '');

const TimeField: React.FC<Props> = ({ value, onChange, autoFocus, label }) => {
  const minuteRef = useRef<HTMLInputElement>(null);
  const prefix = label ? `${label} ` : '';

  // Editing buffers (see file header). Hour renders unpadded; minute renders
  // zero-padded ONLY when not being edited.
  const [hStr, setHStr] = useState<string>(() => hourText(value.h));
  const [mStr, setMStr] = useState<string>(() => pad(value.m));
  const [hEditing, setHEditing] = useState(false);
  const [mEditing, setMEditing] = useState(false);

  // Reflect external value changes (e.g. prefill, programmatic set) only while the
  // field is NOT being edited, so live typing is never overwritten by a re-render.
  useEffect(() => {
    if (!hEditing) setHStr(hourText(value.h));
  }, [value.h, hEditing]);
  useEffect(() => {
    if (!mEditing) setMStr(pad(value.m));
  }, [value.m, mEditing]);

  const setHour = (raw: string, andAdvance: boolean) => {
    const digits = digitsOf(raw);
    setHStr(digits); // show exactly what was typed — no padding mid-entry
    const h = digits === '' ? 0 : Math.min(12, parseInt(digits, 10));
    onChange({ ...value, h });
    if (andAdvance && (digits.length === 2 || parseInt(digits || '0', 10) > 1)) minuteRef.current?.select();
  };
  const setMinute = (raw: string) => {
    const digits = digitsOf(raw);
    setMStr(digits); // show exactly what was typed — the two-digit-entry fix
    const m = digits === '' ? 0 : Math.min(59, parseInt(digits, 10));
    onChange({ ...value, m });
  };

  // Normalize on blur only: clamp to range; minute zero-pads to two digits.
  const commitHour = () => {
    setHEditing(false);
    const h = hStr === '' ? 0 : Math.min(12, parseInt(hStr, 10));
    setHStr(hourText(h));
    onChange({ ...value, h });
  };
  const commitMinute = () => {
    setMEditing(false);
    const m = mStr === '' ? 0 : Math.min(59, parseInt(mStr, 10));
    setMStr(pad(m));
    onChange({ ...value, m });
  };

  const cell = 'w-14 text-center px-2 py-2 border border-gray-300 rounded-lg font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={`${prefix}Hour`}
        inputMode="numeric"
        value={hStr}
        autoFocus={autoFocus}
        onFocus={(e) => { setHEditing(true); e.currentTarget.select(); }}
        onChange={(e) => setHour(e.target.value, true)}
        onBlur={commitHour}
        className={cell}
      />
      <span className="text-lg font-semibold text-gray-400">:</span>
      <input
        aria-label={`${prefix}Minute`}
        ref={minuteRef}
        inputMode="numeric"
        value={mStr}
        onFocus={(e) => { setMEditing(true); e.currentTarget.select(); }}
        onChange={(e) => setMinute(e.target.value)}
        onBlur={commitMinute}
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
