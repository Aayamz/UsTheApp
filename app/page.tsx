import { redirect } from 'next/navigation';
import NavigationShell from '@/components/NavigationShell';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // ── 1. Check if user is a couple member (creator or partner) ──
  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id')
    .or(`created_by.eq.${user.id},partner_id.eq.${user.id}`)
    .limit(1);

  const activePair = pairs?.[0] ?? null;

  if (activePair) {
    // Full app for couple members
    return <NavigationShell />;
  }

  // ── 2. Check if user is a friend space member ──────────────
  // Friends are NOT in the pairs table, they're in friend_space_members.
  // We use the RPC to avoid RLS issues if the table exists.
  try {
    const { data: friendRows } = await supabase
      .from('friend_space_members')
      .select('friend_space_id')
      .eq('user_id', user.id)
      .limit(1);

    if (friendRows && friendRows.length > 0) {
      // Friend has a valid space — send them to the friend landing page
      redirect('/friend-space');
    }
  } catch {
    // Table may not exist yet if SQL migration hasn't been run
  }

  // ── 3. No couple pair AND no friend space → onboarding ────
  redirect('/invite');
}
