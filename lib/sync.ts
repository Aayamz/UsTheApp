import { getDB, SyncMutation } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

// Queue an optimistic mutation to local queue and trigger background processing
export async function queueMutation(store: string, action: 'insert' | 'update' | 'delete', payload: any) {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  const mutation: SyncMutation = {
    id: `mutation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    store,
    action,
    payload,
    timestamp: Date.now(),
  };

  await db.put('sync_queue', mutation);
  
  // Trigger background sync without awaiting network completion
  syncPendingMutations().catch((err) => console.log('Background sync skipped:', err));
}

// Transform local IndexedDB model to match Supabase table schema
async function prepareSupabasePayload(store: string, payload: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('pair_id')
    .eq('id', user.id)
    .maybeSingle();

  const pairId = profile?.pair_id;
  if (!pairId) return null;

  if (store === 'pick_swipes') {
    return {
      id: payload.id || `ps-${user.id}-${payload.cardId || payload.card_id}`,
      pair_id: pairId,
      card_id: payload.cardId || payload.card_id,
      user_id: user.id,
      swipe: payload.userSwipe || payload.swipe || 'left',
      matched: !!payload.matched,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
  }

  return { ...payload, pair_id: pairId };
}

// Background sync runner
export async function syncPendingMutations() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;

  const db = await getDB();
  const pending = await db.getAll('sync_queue');

  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      if (item.action === 'insert' || item.action === 'update') {
        const payloadToSync = await prepareSupabasePayload(item.store, item.payload);
        
        if (!payloadToSync) {
          // Unauthenticated or un-paired user, remove invalid queue item
          await db.delete('sync_queue', item.id);
          continue;
        }

        const { error } = await supabase.from(item.store).upsert(payloadToSync);
        if (!error) {
          await db.delete('sync_queue', item.id);
        } else {
          console.warn(`Supabase sync error for ${item.store}:`, error.message);
          // Delete bad payload to prevent endless HTTP 400 retries
          if (error.code === '22P02' || error.code === '42703' || error.message.includes('400')) {
            await db.delete('sync_queue', item.id);
          }
        }
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.store).delete().eq('id', item.payload.id);
        if (!error) {
          await db.delete('sync_queue', item.id);
        }
      }
    } catch (e) {
      console.log(`Sync mutation error for ${item.id}:`, e);
      // Delete erroneous queue item on unrecoverable syntax/network error
      await db.delete('sync_queue', item.id);
    }
  }
}
