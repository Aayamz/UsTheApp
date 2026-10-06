import { SupabaseClient } from '@supabase/supabase-js';

export async function getMyProfile(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, pair_id, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.pair_id) {
    const { data: pair } = await supabase
      .from('pairs')
      .select('id, partner_id')
      .eq('id', profile.pair_id)
      .maybeSingle();
    if (pair) return { ...profile, pair_id: pair.id };
  }

  // Search in pairs table for partnered space
  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id, created_at')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`);

  if (pairs && pairs.length > 0) {
    const activePair =
      pairs.find((p) => p.partner_id !== null) ||
      pairs.find((p) => p.created_by === userId) ||
      pairs[0];

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
  const { data: authUser } = await supabase.auth.getUser();
  const userEmail = authUser?.user?.email || '';
  const displayName =
    authUser?.user?.user_metadata?.full_name ||
    authUser?.user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : 'User');

  // Search for pairs where user is creator or partner
  const { data: pairs } = await supabase
    .from('pairs')
    .select('*')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`);

  if (pairs && pairs.length > 0) {
    // PREFER PARTNERED PAIRS (partner_id is not null)
    const partnered = pairs.find((p) => p.partner_id !== null);
    if (partnered) {
      // Clean up any unpartnered pairs created by this user
      try {
        await supabase
          .from('pairs')
          .delete()
          .eq('created_by', userId)
          .is('partner_id', null)
          .neq('id', partnered.id);
      } catch {}

      await supabase.from('profiles').upsert({
        id: userId,
        pair_id: partnered.id,
        display_name: displayName,
      });
      return partnered;
    }

    const activePair = pairs.find((p) => p.created_by === userId) || pairs[0];
    await supabase.from('profiles').upsert({
      id: userId,
      pair_id: activePair.id,
      display_name: displayName,
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
    display_name: displayName,
  });

  return created;
}

export async function ensureGroupSpaceForPair(
  supabase: SupabaseClient,
  couplePair: { id: string; created_by: string; partner_id: string | null },
  userId: string
) {
  // Check if a secondary group pair already exists for this couple
  const { data: existingGroupPairs } = await supabase
    .from('pairs')
    .select('*')
    .eq('created_by', couplePair.created_by)
    .neq('id', couplePair.id);

  if (existingGroupPairs && existingGroupPairs.length > 0) {
    return existingGroupPairs[0];
  }

  // Check if user is in space_members for a group space
  const { data: sm } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', userId)
    .neq('space_id', couplePair.id);

  if (sm && sm.length > 0) {
    const { data: friendPair } = await supabase
      .from('pairs')
      .select('*')
      .eq('id', sm[0].space_id)
      .maybeSingle();

    if (friendPair) return friendPair;
  }

  // Create a new dedicated Group Event pair
  const { data: newGroup, error } = await supabase
    .from('pairs')
    .insert({
      created_by: couplePair.created_by,
      partner_id: couplePair.partner_id || undefined,
    })
    .select()
    .single();

  if (error || !newGroup) return couplePair;
  return newGroup;
}

export async function getPairByInviteCode(supabase: SupabaseClient, code: string) {
  if (!code) return null;
  const cleanCode = code.trim();
  const { data, error } = await supabase
    .from('pairs')
    .select('*')
    .ilike('invite_code', cleanCode)
    .maybeSingle();

  if (error) {
    console.error('[getPairByInviteCode] Error querying pair:', error);
  }

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

  const { data: authUser } = await supabase.auth.getUser();
  const userEmail = authUser?.user?.email || '';
  const displayName =
    authUser?.user?.user_metadata?.full_name ||
    authUser?.user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : 'Member');

  // Creator clicking their own link
  if (pair.created_by === userId) {
    await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id, display_name: displayName });
    return { pair, role: 'creator' };
  }

  // User is already registered partner
  if (pair.partner_id === userId) {
    await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id, display_name: displayName });
    return { pair, role: 'partner' };
  }

  // Option 1: Partner slot is available -> Join as Partner 💕
  if (!pair.partner_id) {
    const { data: updated, error } = await supabase
      .from('pairs')
      .update({ partner_id: userId })
      .eq('id', pair.id)
      .is('partner_id', null)
      .select()
      .single();

    if (!error && updated) {
      await supabase.from('profiles').upsert({ id: userId, pair_id: updated.id, display_name: displayName });

      // Clean up any empty standalone pairs previously created by this user
      try {
        await supabase
          .from('pairs')
          .delete()
          .eq('created_by', userId)
          .is('partner_id', null)
          .neq('id', updated.id);
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

    // Clean up empty standalone pairs for joining friend
    try {
      await supabase
        .from('pairs')
        .delete()
        .eq('created_by', userId)
        .is('partner_id', null)
        .neq('id', pair.id);
    } catch {}
  } catch (e) {
    console.error('Error adding to space_members:', e);
  }

  await supabase.from('profiles').upsert({ id: userId, pair_id: pair.id, display_name: displayName });
  return { pair, role: 'friend' };
}
