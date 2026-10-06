import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucbcjjrtexvlenoglorw.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmNqanJ0ZXh2bGVub2dsb3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjYwMjQsImV4cCI6MjEwNjcwMjAyNH0.rxQ64mcr_Jn0mOSvKRQDQFcAaX9EOIcjF__iZffbqfA';

export const isSupabaseConfigured = true;

let clientInstance: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  if (!clientInstance) {
    clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: keyof SupabaseClient) {
    const client = getSupabaseBrowserClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

