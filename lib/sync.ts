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

// Background sync runner
export async function syncPendingMutations() {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;

  const db = await getDB();
  const pending = await db.getAll('sync_queue');

  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      if (item.action === 'insert' || item.action === 'update') {
        const { error } = await supabase.from(item.store).upsert(item.payload);
        if (!error) {
          await db.delete('sync_queue', item.id);
        }
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.store).delete().eq('id', item.payload.id);
        if (!error) {
          await db.delete('sync_queue', item.id);
        }
      }
    } catch (e) {
      console.log(`Sync mutation error for ${item.id}:`, e);
      break; // Pause remaining queue until next online cycle
    }
  }
}
