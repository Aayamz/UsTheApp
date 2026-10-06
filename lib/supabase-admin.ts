import { createClient } from '@supabase/supabase-js';

// NEVER import this in a Client Component or anything that ships to the
// browser -- the service role key bypasses RLS entirely. Server-only
// routes (like the daily content cron job) are the only valid caller.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
