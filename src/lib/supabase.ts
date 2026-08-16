import { createClient } from '@supabase/supabase-js';

// LEGACY (Phase 3 cleanup): the time clock now runs on the kabba2 TimeTracker V2
// API (see src/lib/api.ts + src/lib/timeclock.ts). Supabase remains only for the
// not-yet-migrated attendance/PTO demo screens. When it is not configured we
// fail SOFT with a placeholder client so those legacy screens degrade to their
// own empty/error states instead of crashing the whole app at import time.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase is not configured; legacy attendance/PTO demo screens are disabled. ' +
      'The time clock does not use Supabase.',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);