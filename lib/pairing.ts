import { SupabaseClient } from '@supabase/supabase-js';

export async function getMyProfile(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, pair_id, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.pair_id) {
    return profile;
  }

  // Fallback check: see if user belongs to a pair in pairs table
  const { data: pair } = await supabase
    .from('pairs')
    .select('id')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .maybeSingle();

  if (pair) {
    await supabase.from('profiles').upsert({
      id: userId,
      pair_id: pair.id,
      display_name: profile?.display_name || undefined,
    });
    return { id: userId, pair_id: pair.id, display_name: profile?.display_name };
  }

  return profile;
}

export async function ensurePairForUser(supabase: SupabaseClient, userId: string) {
  // Check if user is creator or partner in an existing pair
  const { data: existing } = await supabase
    .from('pairs')
    .select('*')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .maybeSingle();

  if (existing) {
    // Always keep profiles table in sync using upsert
    await supabase.from('profiles').upsert({
      id: userId,
      pair_id: existing.id,
    });
    return existing;
  }

  // Create new pair if none exists
  const { data: created, error } = await supabase
    .from('pairs')
    .insert({ created_by: userId })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('profiles').upsert({
    id: userId,
    pair_id: created.id,
  });

  return created;
}

export async function getPairByInviteCode(supabase: SupabaseClient, code: string) {
  const { data } = await supabase
    .from('pairs')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();
  return data;
}

export async function joinPairByCode(
  supabase: SupabaseClient,
  code: string,
  userId: string
) {
  const pair = await getPairByInviteCode(supabase, code);
  if (!pair) return null;

  if (pair.created_by === userId) {
    await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id });
    return pair;
  }

  if (pair.partner_id && pair.partner_id !== userId) {
    return null; // Already claimed by someone else
  }

  if (pair.partner_id === userId) {
    await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id });
    return pair;
  }

  // Update pairs row to set partner_id
  const { data: updated, error } = await supabase
    .from('pairs')
    .update({ partner_id: userId })
    .eq('id', pair.id)
    .is('partner_id', null)
    .select()
    .single();

  if (error || !updated) return null;

  // Sync profiles for invited user
  await supabase.from('profiles').upsert({
    id: userId,
    pair_id: updated.id,
  });

  return updated;
}
