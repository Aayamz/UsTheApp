import { SupabaseClient } from '@supabase/supabase-js';

// Call with a server-side client (see lib/supabase-server.ts) inside
// Server Components / Route Handlers only.

export async function getMyProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, pair_id, display_name')
    .eq('id', userId)
    .single();
  return data;
}

// Returns the user's existing pair (as creator or partner), or creates a
// fresh one with a generated invite code if they don't have one yet.
export async function ensurePairForUser(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('pairs')
    .select('*')
    .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('pairs')
    .insert({ created_by: userId })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('profiles').update({ pair_id: created.id }).eq('id', userId);

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

// Joins the signed-in user to an open invite. Returns the updated pair,
// or null if the invite was invalid / already claimed / is the user's own.
export async function joinPairByCode(
  supabase: SupabaseClient,
  code: string,
  userId: string
) {
  const pair = await getPairByInviteCode(supabase, code);
  if (!pair) return null;
  if (pair.created_by === userId) return pair; // it's your own invite, nothing to do
  if (pair.partner_id) return pair.partner_id === userId ? pair : null; // already claimed by someone else

  const { data: updated, error } = await supabase
    .from('pairs')
    .update({ partner_id: userId })
    .eq('id', pair.id)
    .is('partner_id', null)
    .select()
    .single();

  if (error || !updated) return null;

  await supabase.from('profiles').update({ pair_id: updated.id }).eq('id', userId);

  return updated;
}
