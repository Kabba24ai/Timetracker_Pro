// Tenant-timezone helpers for the TimeTracker admin UI.
//
// Every wall-clock decision — what "today" is, how an instant is displayed, how
// a datetime-local field is pre-filled, and how an entered wall-clock time is
// converted to a UTC instant for the API — is done in the CANONICAL TENANT
// TimeTracker timezone (an IANA id the server provides), NEVER the browser's.
//
// These functions take the tz explicitly (from AuthContext) so nothing here
// reads the device timezone or hard-codes a zone.

const pad = (n: number) => String(n).padStart(2, '0');

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock components of an instant, as seen in `tz`. */
function partsInTz(date: Date, tz: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = p.value;
  return {
    year: +map.year,
    month: +map.month,
    day: +map.day,
    hour: +map.hour,
    minute: +map.minute,
    second: +map.second,
  };
}

/** Milliseconds `tz` is ahead of UTC at the given instant (DST-aware). */
function tzOffsetMs(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** The tenant-tz calendar date `daysAgo` before now, as 'YYYY-MM-DD'. */
export function tenantToday(tz: string, daysAgo = 0): string {
  const p = partsInTz(new Date(Date.now() - daysAgo * 86_400_000), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Display an instant in tenant time (default: "Sep 14, 9:00 AM"). */
export function formatInstant(
  iso: string | null,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(iso));
}

/** Tenant-time clock only, e.g. "9:00 AM". */
export function formatClock(iso: string | null, tz: string): string {
  return formatInstant(iso, tz, { hour: 'numeric', minute: '2-digit' });
}

/** Tenant-time date only, e.g. "9/14/2026". */
export function formatDate(iso: string | null, tz: string): string {
  return formatInstant(iso, tz, { year: 'numeric', month: 'numeric', day: 'numeric' });
}

/**
 * Format a plain calendar date ('YYYY-MM-DD') as e.g. "Sunday, August 16, 2026".
 * The date has no time/zone, so it is rendered from its parts (UTC-anchored) and
 * never shifts by timezone — it is the exact day the Time Review row represents.
 */
export function formatCalendarDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, mo - 1, d)));
}

/** Pre-fill a datetime-local input: an instant → 'YYYY-MM-DDTHH:MM' in tenant time. */
export function toTenantDatetimeLocal(iso: string | null, tz: string): string {
  const p = partsInTz(iso ? new Date(iso) : new Date(), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Convert a wall-clock 'YYYY-MM-DDTHH:MM' ENTERED IN TENANT TIME to the UTC
 * instant ISO string for API submission — independent of the browser timezone.
 * Two-pass offset resolution handles DST transitions correctly.
 */
export function tenantWallClockToUtcIso(local: string, tz: string): string {
  const [datePart, timePart] = local.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = (timePart ?? '00:00').split(':').map(Number);

  const asUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset1 = tzOffsetMs(new Date(asUtc), tz);
  let instant = asUtc - offset1;
  const offset2 = tzOffsetMs(new Date(instant), tz);
  if (offset2 !== offset1) instant = asUtc - offset2;

  return new Date(instant).toISOString();
}
