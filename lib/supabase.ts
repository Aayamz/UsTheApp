import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example-u-and-me.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30';

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Must be createBrowserClient (not plain createClient from @supabase/supabase-js) --
// it stores the session/PKCE verifier in cookies instead of localStorage, which is
// what lets app/auth/callback/route.ts (a server-side Route Handler) read it back
// and complete the OAuth code exchange. Using the plain client here is why sign-in
// was failing even though Supabase had already created the auth user.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
