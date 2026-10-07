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
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// FRIEND invite flow – join as friend in a SEPARATE friend_space
// Uses the friend_invite_code on the pairs table
// Friends NEVER get pair_id set to the couple's pair
// ----------------------------------------------------------------
export async function getPairByFriendCode(supabase: SupabaseClient, code: string) {
  if (!code) return null;
  const cleanCode = code.trim();
  const { data, error } = await supabase
    .from('pairs')
    .select('id, friend_invite_code, created_by, partner_id')
    .ilike('friend_invite_code', cleanCode)
    .maybeSingle();

  if (error) {
    console.error('[getPairByFriendCode] Error querying pair by friend code:', error);
  }

  return data;
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
// Friends see ONLY their friend_space, NEVER the couple's private data
// ----------------------------------------------------------------
export async function joinAsFriend(
  supabase: SupabaseClient,
  friendCode: string,
  userId: string
): Promise<{ friendSpace: any; role: 'friend' } | null> {
  if (!friendCode || !userId) return null;

  // Find the couple pair via friend_invite_code
  const couplePair = await getPairByFriendCode(supabase, friendCode.trim());
  if (!couplePair) {
    console.error('[joinAsFriend] No couple pair found for friend code:', friendCode);
    return null;
  }

  const { data: authUser } = await supabase.auth.getUser();
  const userEmail = authUser?.user?.email || '';
  const displayName =
    authUser?.user?.user_metadata?.full_name ||
    authUser?.user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : 'Friend');

  // If this person is already one of the couple partners, don't add as friend
  if (couplePair.created_by === userId || couplePair.partner_id === userId) {
    console.warn('[joinAsFriend] User is already a couple member, not joining as friend.');
    return null;
  }

  // Ensure friend_space exists for this couple
  const friendSpace = await ensureFriendSpaceForPair(supabase, couplePair.id);
  if (!friendSpace) return null;

  // Add user to friend_space_members (upsert = idempotent)
  const { error: memberError } = await supabase
    .from('friend_space_members')
    .upsert({
      friend_space_id: friendSpace.id,
      user_id: userId,
      display_name: displayName,
    }, { onConflict: 'friend_space_id,user_id' });

  if (memberError) {
    console.error('[joinAsFriend] Error adding to friend_space_members:', memberError);
  }

  // IMPORTANT: Friend does NOT get pair_id set to couple's pair
  // Friends have their own profile WITHOUT the couple's pair_id
  // Ensure friend has a profile row (but NOT linked to couple's pair)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, pair_id')
    .eq('id', userId)
    .maybeSingle();

  if (!existingProfile) {
    // New user - create profile without any pair_id
    await supabase.from('profiles').upsert({
      id: userId,
      display_name: displayName,
      pair_id: null,
    });
  }
  // Existing users keep their own pair_id (if they have their own couple space)

  return { friendSpace, role: 'friend' };
}

// ----------------------------------------------------------------
// Detect invite type: is this a partner code or friend code?
// ----------------------------------------------------------------
export type InviteType = 'partner' | 'friend' | 'invalid';

export async function detectInviteType(
  supabase: SupabaseClient,
  code: string
): Promise<{ type: InviteType; pair?: any }> {
  if (!code) return { type: 'invalid' };
  const cleanCode = code.trim();

  // Check partner invite_code first
  const { data: partnerPair } = await supabase
    .from('pairs')
    .select('id, invite_code, partner_id, created_by')
    .ilike('invite_code', cleanCode)
    .maybeSingle();

  if (partnerPair) {
    return { type: 'partner', pair: partnerPair };
  }

  // Check friend_invite_code
  const { data: friendPair } = await supabase
    .from('pairs')
    .select('id, friend_invite_code, partner_id, created_by')
    .ilike('friend_invite_code', cleanCode)
    .maybeSingle();

  if (friendPair) {
    return { type: 'friend', pair: friendPair };
  }

  return { type: 'invalid' };
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
