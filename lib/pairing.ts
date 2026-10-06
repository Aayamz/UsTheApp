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

  // Fallback check: see if user belongs to pairs in pairs table (prioritize active paired pairs)
  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id, created_at')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (pairs && pairs.length > 0) {
    // Prefer pair with partner_id attached if user is partner, or creator of active pair
    const activePair = pairs.find((p) => p.partner_id !== null) || pairs[0];
    await supabase.from('profiles').upsert({
      id: userId,
      pair_id: activePair.id,
      display_name: profile?.display_name || undefined,
    });
    return { id: userId, pair_id: activePair.id, display_name: profile?.display_name };
  }

  return profile;
}

export async function ensurePairForUser(supabase: SupabaseClient, userId: string) {
  // Check if user is creator or partner in existing pairs
  const { data: pairs } = await supabase
    .from('pairs')
    .select('*')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (pairs && pairs.length > 0) {
    // Prefer pair that has partner_id set (if any), or most recent
    const activePair = pairs.find((p) => p.partner_id !== null) || pairs[0];

    // Always keep profiles table in sync using upsert
    await supabase.from('profiles').upsert({
      id: userId,
      pair_id: activePair.id,
    });
    return activePair;
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
  if (!code) return null;
  const { data } = await supabase
    .from('pairs')
    .select('*')
    .eq('invite_code', code.trim())
    .maybeSingle();
  return data;
}

export async function joinPairByCode(
  supabase: SupabaseClient,
  code: string,
  userId: string
) {
  if (!code || !userId) return null;
  const pair = await getPairByInviteCode(supabase, code.trim());
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

  // Clean up any empty solo pairs created by this user that were never claimed by anyone else
  try {
    await supabase
      .from('pairs')
      .delete()
      .eq('created_by', userId)
      .is('partner_id', null)
      .neq('id', updated.id);
  } catch (e) {
    console.log('Cleanup of solo pair error (non-fatal):', e);
  }

  // Sync profiles for invited user
  await supabase.from('profiles').upsert({
    id: userId,
    pair_id: updated.id,
  });

  return updated;
}

