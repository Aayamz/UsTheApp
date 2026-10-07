import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check not already in a pair
  const { data: existing } = await supabase
    .from('pairs')
    .select('id')
    .or(`created_by.eq.${user.id},partner_id.eq.${user.id}`)
    .limit(1);

  if (existing && existing.length > 0) {
    redirect('/invite');
  }

  // Get display name
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'User');

  // Create a new pair for this user
  const { data: created, error } = await supabase
    .from('pairs')
    .insert({ created_by: user.id })
    .select()
    .single();

  if (error || !created) {
    redirect('/invite');
  }

  // Set their profile pair_id
  await supabase.from('profiles').upsert({
    id: user.id,
    pair_id: created.id,
    display_name: displayName,
  });

  redirect('/invite');
}
