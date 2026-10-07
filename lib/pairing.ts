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

// ----------------------------------------------------------------
// PARTNER invite flow – join as romantic partner in couple's space
// Uses the main invite_code on the pairs table
// Uses SECURITY DEFINER RPC to bypass RLS (needed for detection)
// ----------------------------------------------------------------
export async function getPairByInviteCode(supabase: SupabaseClient, code: string) {
  if (!code) return null;
  const cleanCode = code.trim();

  // Use RPC to bypass RLS — only returns minimal safe fields
  const { data, error } = await supabase
    .rpc('get_pair_by_invite_code', { p_code: cleanCode });

  if (error) {
    console.error('[getPairByInviteCode] RPC error:', error);
    // Fallback: direct query (works for open/self-owned pairs)
    const { data: fallback } = await supabase
      .from('pairs')
      .select('id, invite_code, created_by, partner_id, friend_invite_code')
      .ilike('invite_code', cleanCode)
      .maybeSingle();
    return fallback;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

// ----------------------------------------------------------------
// FRIEND invite flow – join as friend in a SEPARATE friend_space
// Uses the friend_invite_code on the pairs table
// Uses SECURITY DEFINER RPC to bypass RLS (friends can't read
// fully-paired couples via direct table queries)
// Friends NEVER get pair_id set to the couple's pair
// ----------------------------------------------------------------
export async function getPairByFriendCode(supabase: SupabaseClient, code: string) {
  if (!code) return null;
  const cleanCode = code.trim();

  const { data, error } = await supabase
    .rpc('get_pair_by_friend_code', { p_code: cleanCode });

  if (error) {
    console.error('[getPairByFriendCode] RPC error:', error);
    return null;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

// ----------------------------------------------------------------
// Ensure a friend_space exists for this couple pair
// Returns the friend_space row
// ----------------------------------------------------------------
export async function ensureFriendSpaceForPair(
  supabase: SupabaseClient,
  couplePairId: string
) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('friend_spaces')
    .select('*')
    .eq('couple_pair_id', couplePairId)
    .maybeSingle();

  if (existing) return existing;

  // Create new friend space for this couple
  const { data: created, error } = await supabase
    .from('friend_spaces')
    .insert({ couple_pair_id: couplePairId, name: 'Friends Group' })
    .select()
    .single();

  if (error) {
    console.error('[ensureFriendSpaceForPair] Error creating friend space:', error);
    return null;
  }

  return created;
}

// ----------------------------------------------------------------
// Join as PARTNER (couple space) - uses main invite_code
// ----------------------------------------------------------------
export async function joinPairByCode(
  supabase: SupabaseClient,
  code: string,
  userId: string
): Promise<{ pair: any; role: 'creator' | 'partner' } | null> {
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

  // Partner slot is available → Join as Partner 💕
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

  // Partner slot is taken — this is not a friend invite code
  // Direct them to use the friend invite code instead
  console.warn('[joinPairByCode] Partner slot already taken. Use friend invite link instead.');
  return null;
}

// ----------------------------------------------------------------
// Join as FRIEND (separate friend_space) - uses friend_invite_code
// Uses a SECURITY DEFINER RPC that atomically:
//   1. Finds pair by friend_invite_code (bypasses RLS)
//   2. Creates friend_space if needed
//   3. Adds user to friend_space_members
//   4. Does NOT set friend's pair_id to couple's pair
// ----------------------------------------------------------------
export async function joinAsFriend(
  supabase: SupabaseClient,
  friendCode: string,
  userId: string
): Promise<{ friendSpace: any; role: 'friend' } | null> {
  if (!friendCode || !userId) return null;

  const { data: authUser } = await supabase.auth.getUser();
  const userEmail = authUser?.user?.email || '';
  const displayName =
    authUser?.user?.user_metadata?.full_name ||
    authUser?.user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : 'Friend');

  // Call the security-definer RPC — handles everything atomically
  const { data: friendSpaceId, error } = await supabase
    .rpc('join_as_friend', {
      p_friend_code: friendCode.trim(),
      p_user_id: userId,
      p_display_name: displayName,
    });

  if (error) {
    console.error('[joinAsFriend] RPC error:', error);
    return null;
  }

  if (!friendSpaceId) {
    console.error('[joinAsFriend] RPC returned null — invalid code or user is already couple member');
    return null;
  }

  return { friendSpace: { id: friendSpaceId }, role: 'friend' };
}

// ----------------------------------------------------------------
// Detect invite type: is this a partner code or friend code?
// Uses SECURITY DEFINER RPC so it works regardless of whether
// the couple already has both partners joined.
// ----------------------------------------------------------------
export type InviteType = 'partner' | 'friend' | 'invalid';

export async function detectInviteType(
  supabase: SupabaseClient,
  code: string
): Promise<{ type: InviteType; pair?: any }> {
  if (!code) return { type: 'invalid' };
  const cleanCode = code.trim();

  // Use security-definer RPC — bypasses RLS, works for all cases
  const { data: result, error } = await supabase
    .rpc('detect_invite_type', { p_code: cleanCode });

  if (error) {
    console.error('[detectInviteType] RPC error:', error);
    // Fallback to direct queries (works for open pairs at least)
    const { data: partnerPair } = await supabase
      .from('pairs')
      .select('id, invite_code, partner_id, created_by')
      .ilike('invite_code', cleanCode)
      .maybeSingle();

    if (partnerPair) return { type: 'partner', pair: partnerPair };
    return { type: 'invalid' };
  }

  if (!result || result.type === 'invalid') {
    return { type: 'invalid' };
  }

  // Shape the pair object to match what the join page expects
  const pair = {
    id: result.pair_id,
    created_by: result.created_by,
    partner_id: result.partner_id,
  };

  return { type: result.type as InviteType, pair };
}

// ----------------------------------------------------------------
// Get friend spaces for a user (for the UI to show friend spaces)
// ----------------------------------------------------------------
export async function getMyFriendSpaces(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('friend_space_members')
    .select('friend_space_id, friend_spaces(id, name, couple_pair_id)')
    .eq('user_id', userId);

  if (error) {
    console.error('[getMyFriendSpaces] Error:', error);
    return [];
  }

  return (data || []).map((row: any) => row.friend_spaces).filter(Boolean);
}

// ----------------------------------------------------------------
// Get members of a friend space
// ----------------------------------------------------------------
export async function getFriendSpaceMembers(supabase: SupabaseClient, friendSpaceId: string) {
  const { data, error } = await supabase
    .from('friend_space_members')
    .select('user_id, display_name, added_at')
    .eq('friend_space_id', friendSpaceId)
    .order('added_at', { ascending: true });

  if (error) {
    console.error('[getFriendSpaceMembers] Error:', error);
    return [];
  }

  return data || [];
}
