import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { detectInviteType, joinPairByCode, joinAsFriend } from '@/lib/pairing';
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

  // Detect invite type before requiring login so we can show correct UI
  // For unauthenticated users, we still try to detect the type via the anon key
  // (pairs are readable when partner_id IS NULL for the partner flow)
  const inviteType = user
    ? await detectInviteType(supabase, code)
    : { type: 'unknown' as any };

  // Not signed in yet -- show sign in page
  if (!user) {
    const isLikelyFriend = code.startsWith('f') || code.length > 8; // heuristic, will be re-detected after login
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
        <Logo size={48} showWordmark />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You&apos;ve been invited!</h1>
          <p className="text-sm text-[#C9B3D1] max-w-xs leading-relaxed">
            Sign in to accept your invite and join your private space.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <GoogleSignInButton next={`/join/${code}`} inviteCode={code} />
        </div>
      </div>
    );
  }

  // ── PARTNER INVITE ──────────────────────────────────────────
  if (inviteType.type === 'partner') {
    const pair = (inviteType as { type: 'partner'; pair: any }).pair;

    // Creator clicking their own link
    if (pair.created_by === user.id) {
      redirect('/');
    }

    // Already joined as partner
    if (pair.partner_id === user.id) {
      redirect('/');
    }

    // Partner slot taken — show error
    if (pair.partner_id && pair.partner_id !== user.id) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
          <Logo size={48} showWordmark />
          <h1 className="text-xl font-bold">This partner invite is already claimed</h1>
          <p className="text-sm text-[#C9B3D1] max-w-xs leading-relaxed">
            This couple already has two partners connected. Ask your friend for their friend invite link instead.
          </p>
          <Link href="/" className="mt-4 px-6 py-3 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-full">
            Go to App
          </Link>
        </div>
      );
    }

    // Slot available — join as partner
    const joinResult = await joinPairByCode(supabase, code, user.id);
    if (!joinResult) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
          <Logo size={48} showWordmark />
          <h1 className="text-xl font-bold">Could not join couple space</h1>
          <p className="text-sm text-[#C9B3D1]">Please try clicking the invite link again.</p>
          <Link href={`/join/${code}`} className="mt-4 px-6 py-3 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-full">
            Retry
          </Link>
        </div>
      );
    }

    redirect('/');
  }

  // ── FRIEND INVITE ────────────────────────────────────────────
  if (inviteType.type === 'friend') {
    const pair = (inviteType as { type: 'friend'; pair: any }).pair;

    // Couple members shouldn't be joining their own friend space via link
    if (pair.created_by === user.id || pair.partner_id === user.id) {
      redirect('/');
    }

    const joinResult = await joinAsFriend(supabase, code, user.id);

    if (!joinResult) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
          <Logo size={48} showWordmark />
          <h1 className="text-xl font-bold">Could not join friend space</h1>
          <p className="text-sm text-[#C9B3D1]">Please try the invite link again.</p>
          <Link href={`/join/${code}`} className="mt-4 px-6 py-3 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-full">
            Retry
          </Link>
        </div>
      );
    }

    // Show success before redirect
    redirect('/');
  }

  // ── INVALID INVITE ───────────────────────────────────────────
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#1F1324] text-[#F6EFE9]">
      <Logo size={48} showWordmark />
      <h1 className="text-xl font-bold">This invite isn&apos;t valid</h1>
      <p className="text-sm text-[#C9B3D1] max-w-xs leading-relaxed">
        Ask your partner for a fresh invite link — partner and friend links are separate.
      </p>
      <Link href="/" className="mt-4 px-6 py-3 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-full">
        Go to Home
      </Link>
    </div>
  );
}
