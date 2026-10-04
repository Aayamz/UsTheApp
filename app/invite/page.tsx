import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensurePairForUser } from '@/lib/pairing';
import InviteWaiting from '@/components/auth/InviteWaiting';

export default async function InvitePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/invite');

  const pair = await ensurePairForUser(supabase, user.id);

  if (pair.partner_id) redirect('/');

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-6 px-8 text-center">
      <h1 className="text-2xl font-semibold">Invite her in</h1>
      <InviteWaiting pairId={pair.id} inviteCode={pair.invite_code} />
    </div>
  );
}
