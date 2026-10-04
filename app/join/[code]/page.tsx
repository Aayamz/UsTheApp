import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getPairByInviteCode, joinPairByCode } from '@/lib/pairing';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in yet -- send to login, then come straight back here.
  if (!user) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6 px-8 text-center">
        <h1 className="text-2xl font-semibold">You&apos;ve been invited to U&</h1>
        <p className="text-sm text-[#F6EFE9]/60">Sign in to join.</p>
        <div className="w-full max-w-xs">
          <GoogleSignInButton next={`/join/${code}`} />
        </div>
      </div>
    );
  }

  const pair = await getPairByInviteCode(supabase, code);

  if (!pair) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-xl font-semibold">This invite isn&apos;t valid</h1>
        <p className="text-sm text-[#F6EFE9]/60">Ask for a fresh link.</p>
      </div>
    );
  }

  if (pair.partner_id && pair.partner_id !== user.id) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-xl font-semibold">This invite has already been used</h1>
      </div>
    );
  }

  await joinPairByCode(supabase, code, user.id);

  redirect('/');
}
