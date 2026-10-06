import { getDB, SyncMutation } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

function isValidUuid(val: any): boolean {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

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

// Format local IndexedDB camelCase model to match Supabase Postgres SQL schema
function prepareSupabasePayload(store: string, payload: any, userId: string, pairId: string | null) {
  const rawPairId = pairId || payload.pair_id || null;
  const commonPairId = isValidUuid(rawPairId) ? rawPairId : null;
  const validUserId = isValidUuid(userId) ? userId : null;

  switch (store) {
    case 'trail_entries':
      const authorUuid = validUserId || (isValidUuid(payload.partner) ? payload.partner : null);
      return {
        id: payload.id || `t-${Date.now()}`,
        pair_id: commonPairId,
        type: payload.type || 'moment',
        title: payload.title,
        description: payload.description || null,
        image_url: payload.imageUrl || payload.image_url || null,
        date: payload.date || new Date().toISOString(),
        partner: authorUuid || payload.partner || 'You',
        likes_count: payload.likesCount ?? payload.likes_count ?? 0,
        tags: payload.tags || [],
        countdown_target: payload.countdownTarget || payload.countdown_target || null,
        location: payload.location || null,
      };

    case 'spark_prompts':
      return {
        id: payload.id,
        pair_id: commonPairId,
        date: payload.date || new Date().toISOString().split('T')[0],
        question: payload.question,
        category: payload.category || null,
        user_answer: payload.userAnswer || payload.user_answer || null,
        partner_answer: payload.partnerAnswer || payload.partner_answer || null,
        revealed: !!payload.revealed,
        answered_at: payload.answeredAt || payload.answered_at || null,
        source: payload.source || 'static',
      };

    case 'someday_capsules':
      return {
        id: payload.id,
        pair_id: commonPairId,
        title: payload.title,
        unlock_date: payload.unlockDate || payload.unlock_date || new Date().toISOString(),
        content: payload.content || null,
        media_type: payload.mediaType || payload.media_type || 'text',
        media_url: payload.mediaUrl || payload.media_url || null,
        sealed_by: isValidUuid(payload.sealedBy) ? payload.sealedBy : validUserId,
        is_unlocked: !!(payload.isUnlocked ?? payload.is_unlocked),
        is_event_scoped: !!(payload.isEventScoped ?? payload.is_event_scoped),
        event_name: payload.eventName || payload.event_name || null,
      };

    case 'pick_cards':
      return {
        id: payload.id,
        pair_id: commonPairId,
        date: payload.date || new Date().toISOString().split('T')[0],
        deck: payload.deck || 'food',
        title: payload.title,
        description: payload.description || null,
        image: payload.image || null,
        tags: payload.tags || [],
        rating: payload.rating || null,
        source: payload.source || 'static',
      };

    case 'pick_swipes':
      return {
        id: payload.id || `ps-${userId}-${payload.cardId || payload.card_id || 'card'}-${Date.now().toString(36)}`,
        pair_id: commonPairId,
        card_id: payload.cardId || payload.card_id || null,
        user_id: validUserId,
        swipe: payload.userSwipe || payload.swipe || 'left',
        matched: !!payload.matched,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

    case 'nudges':
      return {
        id: payload.id,
        pair_id: commonPairId,
        sender: isValidUuid(payload.sender) ? payload.sender : validUserId,
        emoji: payload.emoji || '❤️',
        label: payload.label || 'Thinking of you',
        timestamp: payload.timestamp || new Date().toISOString(),
        viewed: !!payload.viewed,
      };

    default:
      return {
        ...payload,
        pair_id: commonPairId,
      };
  }
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

    const { getActivePairId } = await import('./pairSync');
    const pairId = await getActivePairId();

    for (const item of pending) {
      try {
        if (item.action === 'insert' || item.action === 'update') {
          const payloadToSync = prepareSupabasePayload(item.store, item.payload, userId, pairId);
          const { error } = await supabase.from(item.store).upsert(payloadToSync, { onConflict: 'id' });
          if (error) {
            console.error(`Sync error for ${item.store}:`, error);
          }
        } else if (item.action === 'delete') {
          await supabase.from(item.store).delete().eq('id', item.payload.id);
        }
      } catch (err) {
        console.error(`Failed executing queue mutation for ${item.store}:`, err);
      }

      // Always clear item from queue after processing to avoid retrying duplicate payloads
      try {
        await db.delete('sync_queue', item.id);
      } catch {}
    }
  } catch {}
}
