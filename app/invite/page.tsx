import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensurePairForUser } from '@/lib/pairing';
import InviteHub from '@/components/auth/InviteHub';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function InvitePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/invite');

  const pair = await ensurePairForUser(supabase, user.id);

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
        pairId={pair.id}
        partnerInviteCode={pair.invite_code}
        friendInviteCode={pair.friend_invite_code}
        hasPartner={!!pair.partner_id}
      />
    </div>
  );
}
