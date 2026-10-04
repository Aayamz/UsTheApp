import { redirect } from 'next/navigation';
import NavigationShell from '@/components/NavigationShell';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensurePairForUser } from '@/lib/pairing';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const pair = await ensurePairForUser(supabase, user.id);

  // If partner hasn't joined yet, redirect to invite waiting screen
  if (!pair.partner_id) {
    redirect('/invite');
  }

  return <NavigationShell />;
}
