import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getPairByInviteCode, joinPairByCode } from '@/lib/pairing';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import Link from 'next/link';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

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

  // Not signed in yet -- send to login with return URL
  if (!user) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
        <Logo size={48} showWordmark />
        <h1 className="text-xl font-bold">You&apos;ve been invited!</h1>
        <p className="text-sm text-[#C9B3D1]">Sign in with Google to accept your partner or friend&apos;s invite.</p>
        <div className="w-full max-w-xs">
          <GoogleSignInButton next={`/join/${code}`} inviteCode={code} />
        </div>
      </div>
    );
  }

  const pair = await getPairByInviteCode(supabase, code);

  if (!pair) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
        <Logo size={48} showWordmark />
        <h1 className="text-xl font-bold">This invite isn&apos;t valid</h1>
        <p className="text-sm text-[#C9B3D1]">Ask your partner or friend for a fresh invite link.</p>
        <Link href="/" className="mt-4 px-4 py-2 bg-[#FF8966] text-[#1F1324] font-bold text-xs rounded-full">
          Go to Home
        </Link>
      </div>
    );
  }

  if (pair.partner_id && pair.partner_id !== user.id) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
        <Logo size={48} showWordmark />
        <h1 className="text-xl font-bold">This invite has already been claimed</h1>
        <p className="text-sm text-[#C9B3D1]">Someone else has already joined this space.</p>
        <Link href="/" className="mt-4 px-4 py-2 bg-[#FF8966] text-[#1F1324] font-bold text-xs rounded-full">
          Go to Home
        </Link>
      </div>
    );
  }

  const joinedPair = await joinPairByCode(supabase, code, user.id);

  if (!joinedPair) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
        <Logo size={48} showWordmark />
        <h1 className="text-xl font-bold">Could not join space</h1>
        <p className="text-sm text-[#C9B3D1]">Please try clicking the invite link again.</p>
        <Link href={`/join/${code}`} className="mt-4 px-4 py-2 bg-[#FF8966] text-[#1F1324] font-bold text-xs rounded-full">
          Retry Joining
        </Link>
      </div>
    );
  }

  redirect('/');
}
