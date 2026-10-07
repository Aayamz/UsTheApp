import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import InviteHub from '@/components/auth/InviteHub';
import JoinByCodeForm from '@/components/auth/JoinByCodeForm';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function InvitePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/invite');

  // Check if user is already in a couple pair
  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id, invite_code, friend_invite_code')
    .or(`created_by.eq.${user.id},partner_id.eq.${user.id}`)
    .limit(1);

  const existingPair = pairs?.[0] ?? null;

  // ── EXISTING COUPLE MEMBER ───────────────────────────────────
  // Show them their invite links to share with partner / friends
  if (existingPair) {
    return (
      <div className="min-h-full w-full flex flex-col items-center justify-start gap-6 px-6 py-10 bg-[#1F1324] text-[#F6EFE9] overflow-y-auto">
        <Logo size={44} showWordmark />
        <div className="text-center space-y-1.5 max-w-sm">
          <h1 className="text-2xl font-bold">Invite to Your Space</h1>
          <p className="text-sm text-[#C9B3D1] leading-relaxed">
            Partner and friend invites are completely separate — friends can never see your private couple space.
          </p>
        </div>
        <InviteHub
          pairId={existingPair.id}
          partnerInviteCode={existingPair.invite_code}
          friendInviteCode={existingPair.friend_invite_code ?? ''}
          hasPartner={!!existingPair.partner_id}
        />
      </div>
    );
  }

  // ── NEW USER / FRIEND WITH NO PAIR ───────────────────────────
  // They have no couple space. Show them options:
  //   A) Create a new couple space (they'll be the creator)
  //   B) Enter an invite code to join an existing space
  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center gap-6 px-6 py-12 bg-[#1F1324] text-[#F6EFE9] overflow-y-auto">
      <Logo size={48} showWordmark />
      <div className="text-center space-y-2 max-w-xs">
        <h1 className="text-2xl font-bold">Welcome to U&!</h1>
        <p className="text-sm text-[#C9B3D1] leading-relaxed">
          You need to join or create a space to get started.
        </p>
      </div>

      {/* Join by code - primary option for invited users */}
      <JoinByCodeForm userId={user.id} />

      {/* Divider */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-[#4F3C59]" />
        <span className="text-xs text-[#C9B3D1]">or</span>
        <div className="flex-1 h-px bg-[#4F3C59]" />
      </div>

      {/* Create new couple space */}
      <form action="/invite/create" method="POST" className="w-full max-w-xs">
        <button
          type="submit"
          className="w-full py-3.5 bg-[#372A3E] border border-[#4F3C59] text-[#F6EFE9] hover:bg-[#4F3C59]/60 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          💕 Create a New Couple Space
        </button>
        <p className="text-center text-[10px] text-[#C9B3D1] mt-2">
          Start fresh — you'll get invite links to share with your partner.
        </p>
      </form>
    </div>
  );
}
