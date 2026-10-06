import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensurePairForUser } from '@/lib/pairing';
import InviteWaiting from '@/components/auth/InviteWaiting';
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
    <div className="min-h-full w-full flex flex-col items-center justify-center gap-6 px-8 py-12 text-center bg-[#1F1324] text-[#F6EFE9]">
      <Logo size={48} showWordmark />
      <h1 className="text-xl font-bold">Invite your partner or friends</h1>
      <InviteWaiting pairId={pair.id} inviteCode={pair.invite_code} />
    </div>
  );
}
