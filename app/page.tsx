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

  // ── Pair check ──────────────────────────────────────────────
  // Only let users into the main app if they are a proper couple
  // member (creator OR partner in a pair). Friends and brand-new
  // users who haven't joined a couple space are redirected to /invite.
  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id')
    .or(`created_by.eq.${user.id},partner_id.eq.${user.id}`)
    .limit(1);

  const activePair = pairs?.[0] ?? null;

  if (!activePair) {
    // New user or friend whose invite failed — send to invite/onboarding
    redirect('/invite');
  }

  return <NavigationShell />;
}
