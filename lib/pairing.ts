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

  // Fallback check: see if user belongs to pairs in pairs table
  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id, created_at')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (pairs && pairs.length > 0) {
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
  const { data: pairs } = await supabase
    .from('pairs')
    .select('*')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (pairs && pairs.length > 0) {
    const activePair = pairs.find((p) => p.partner_id !== null) || pairs[0];

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

  // Creator clicking their own link
  if (pair.created_by === userId) {
    await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id });
    return { pair, role: 'creator' };
  }

  // User is already registered partner
  if (pair.partner_id === userId) {
    await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id });
    return { pair, role: 'partner' };
  }

  // Option 1: Partner slot is available -> Join as Romantic Partner 💕
  if (!pair.partner_id) {
    const { data: updated, error } = await supabase
      .from('pairs')
      .update({ partner_id: userId })
      .eq('id', pair.id)
      .is('partner_id', null)
      .select()
      .single();

    if (!error && updated) {
      await supabase.from('profiles').upsert({ id: userId, pair_id: updated.id });
      try {
        await supabase.from('space_members').upsert({
          space_id: updated.id,
          user_id: userId,
          role: 'partner',
        });
      } catch {}
      return { pair: updated, role: 'partner' };
    }
  }

  // Option 2: Partner slot is already taken -> Join as Group Friend 🥳
  try {
    await supabase.from('space_members').upsert({
      space_id: pair.id,
      user_id: userId,
      role: 'friend',
    });
  } catch {}

  await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id });
  return { pair, role: 'friend' };
}
