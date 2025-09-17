import { createClient } from '@supabase/supabase-js';

// Placeholder Supabase client for demo mode
// In production, replace with actual Supabase URL and keys
const supabaseUrl = 'https://placeholder.supabase.co';
const supabaseAnonKey = 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);