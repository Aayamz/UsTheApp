import { getDB, SyncMutation } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

// Queue an optimistic mutation to local queue and trigger background processing
export async function queueMutation(store: string, action: 'insert' | 'update' | 'delete', payload: any) {
  if (typeof window === 'undefined') return;
  try {
    const db = await getDB();
    const mutation: SyncMutation = {
      id: `mutation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      store,
      action,
      payload,
      timestamp: Date.now(),
    };

    await db.put('sync_queue', mutation);
    
    // Trigger background sync silently
    syncPendingMutations().catch(() => {});
  } catch {}
}

// Format local payload for Supabase database schema
function prepareSupabasePayload(store: string, payload: any, userId: string, pairId: string | null) {
  if (store === 'pick_swipes') {
    return {
      id: payload.id || `ps-${userId}-${payload.cardId || payload.card_id}`,
      pair_id: pairId || payload.pair_id || null,
      card_id: payload.cardId || payload.card_id,
      user_id: userId,
      swipe: payload.userSwipe || payload.swipe || 'left',
      matched: !!payload.matched,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
  }

  return {
    ...payload,
    pair_id: pairId || payload.pair_id || null,
  };
}

// Background sync runner - fail-safe & zero console noise
export async function syncPendingMutations() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;

  try {
    const db = await getDB();
    const pending = await db.getAll('sync_queue');

    if (!pending || pending.length === 0) return;

    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    if (!userId) {
      await db.clear('sync_queue');
      return;
    }

    let pairId: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('pair_id')
        .eq('id', userId)
        .maybeSingle();
      pairId = profile?.pair_id || null;
    } catch {}

    for (const item of pending) {
      try {
        if (item.action === 'insert' || item.action === 'update') {
          const payloadToSync = prepareSupabasePayload(item.store, item.payload, userId, pairId);
          await supabase.from(item.store).upsert(payloadToSync);
        } else if (item.action === 'delete') {
          await supabase.from(item.store).delete().eq('id', item.payload.id);
        }
      } catch {}

      // Always clear item from queue after processing to avoid retrying bad payloads
      try {
        await db.delete('sync_queue', item.id);
      } catch {}
    }
  } catch {}
}
