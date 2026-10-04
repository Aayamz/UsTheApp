import { redirect } from 'next/navigation';
import NavigationShell from '@/components/NavigationShell';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getMyProfile } from '@/lib/pairing';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const profile = await getMyProfile(supabase, user.id);

  if (!profile?.pair_id) redirect('/invite');

  return <NavigationShell />;
}
