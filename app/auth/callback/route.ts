import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';

  let origin = requestUrl.origin;
  if (forwardedHost) {
    origin = `${protocol}://${forwardedHost}`;
  } else if (host && !host.includes('localhost')) {
    origin = `${protocol}://${host}`;
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('OAuth code exchange failed:', error.message);
    }

    if (!error && data.user) {
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

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
