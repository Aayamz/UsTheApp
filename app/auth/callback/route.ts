import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Preserve where the user was headed, e.g. /join/abc123
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // First-time sign-in: make sure a profiles row exists.
      // Safe to call every time -- onConflict just no-ops if it's already there.
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          display_name:
            data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
          avatar_url: data.user.user_metadata?.avatar_url ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong -- send them back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
