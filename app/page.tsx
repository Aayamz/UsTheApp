import { redirect } from 'next/navigation';
import NavigationShell from '@/components/NavigationShell';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensurePairForUser } from '@/lib/pairing';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <NavigationShell />;
}
