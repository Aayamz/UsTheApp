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
  syncPendingMutations().catch(() => {});
}

// Safe payload mapping for Supabase synchronization
function prepareSupabasePayload(store: string, payload: any, userId: string) {
  if (store === 'pick_swipes') {
    return {
      id: payload.id || `ps-${userId}-${payload.cardId || payload.card_id}`,
      card_id: payload.cardId || payload.card_id,
      user_id: userId,
      swipe: payload.userSwipe || payload.swipe || 'left',
      matched: !!payload.matched,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
  }

  return payload;
}

// Background sync runner - silent & non-blocking per AGENTS.md
export async function syncPendingMutations() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;

  const db = await getDB();
  const pending = await db.getAll('sync_queue');

  if (!pending || pending.length === 0) return;

  // Get current user session once
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id || null;
  } catch {
    userId = null;
  }

  if (!userId) {
    // If not signed in, purge queue to prevent failing network calls
    await db.clear('sync_queue');
    return;
  }

  for (const item of pending) {
    try {
      if (item.action === 'insert' || item.action === 'update') {
        const payloadToSync = prepareSupabasePayload(item.store, item.payload, userId);
        const { error } = await supabase.from(item.store).upsert(payloadToSync);
        
        // Always remove processed or failing mutation from sync_queue to avoid retrying bad requests
        await db.delete('sync_queue', item.id);
        if (error) {
          console.debug(`[Background Sync] ${item.store} sync note:`, error.message);
        }
      } else if (item.action === 'delete') {
        await supabase.from(item.store).delete().eq('id', item.payload.id);
        await db.delete('sync_queue', item.id);
      }
    } catch {
      // Purge broken mutation item
      await db.delete('sync_queue', item.id);
    }
  }
}
