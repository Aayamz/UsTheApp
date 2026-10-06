import { supabase } from './supabase';
import { getDB, TrailEntry, SparkPrompt, SomedayCapsule, PickSwipe, NudgeRecord } from './db';
import { Haptics } from './haptics';

export async function getActivePairId(): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('pair_id')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profile?.pair_id) return profile.pair_id;

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, partner_id')
    .or(`created_by.eq.${authData.user.id},partner_id.eq.${authData.user.id}`)
    .order('created_at', { ascending: false });

  const active = pairs?.find((p) => p.partner_id !== null) || pairs?.[0];
  return active?.id || null;
}

// Global active channel reference to avoid duplicate subscriptions
let globalChannel: any = null;
let currentPairId: string | null = null;

// ----------------------------------------------------
// FETCH & SAVE HELPERS (IDB + EVENT BROADCAST)
// ----------------------------------------------------

export async function fetchAndSaveTrail(pairId: string) {
  const { data: remote } = await supabase
    .from('trail_entries')
    .select('*')
    .eq('pair_id', pairId)
    .order('date', { ascending: false });

  const db = await getDB();
  const existingLocal = await db.getAll('trail_entries');
  const localMap = new Map(existingLocal.map((e) => [e.id, e]));

  if (remote && remote.length > 0) {
    const mapped: TrailEntry[] = remote.map((r) => {
      const localItem = localMap.get(r.id);
      const likedByMe = localItem ? Boolean(localItem.likedByMe) : false;

      return {
        id: r.id,
        type: (r.type as any) || 'moment',
        title: r.title,
        description: r.description || undefined,
        imageUrl: r.image_url || undefined,
        date: r.date,
        partner: r.partner || 'Partner',
        likesCount: r.likes_count ?? 0,
        likedByMe,
        tags: r.tags || [],
        countdownTarget: r.countdown_target || undefined,
        location: r.location || undefined,
      };
    });

    const uniqueMap = new Map<string, TrailEntry>();
    mapped.forEach((item) => uniqueMap.set(item.id, item));
    const deduplicated = Array.from(uniqueMap.values());

    for (const item of deduplicated) {
      await db.put('trail_entries', item);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('u-sync-trail', { detail: deduplicated }));
    }
    return deduplicated;
  } else if (existingLocal.length > 0) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('u-sync-trail', { detail: existingLocal }));
    }
    return existingLocal;
  }
  return [];
}

export async function fetchAndSaveSpark(pairId: string) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  const { data: pair } = await supabase
    .from('pairs')
    .select('created_by, partner_id')
    .eq('id', pairId)
    .maybeSingle();

  const isCreator = pair?.created_by === userId;

  const { data: remote } = await supabase
    .from('spark_prompts')
    .select('*')
    .eq('pair_id', pairId)
    .order('date', { ascending: false });

  if (remote && remote.length > 0) {
    const db = await getDB();
    const mapped: SparkPrompt[] = remote.map((r) => {
      const myAnswer = isCreator ? r.user_answer : r.partner_answer;
      const partnerAnswer = isCreator ? r.partner_answer : r.user_answer;

      const isUserAnswered = Boolean(myAnswer);
      const isPartnerAnswered = Boolean(partnerAnswer);
      const isRevealed = Boolean(r.revealed || (isUserAnswered && isPartnerAnswered));

      return {
        id: r.id,
        date: r.date,
        question: r.question,
        category: r.category || 'Connection',
        userAnswer: myAnswer || undefined,
        partnerAnswer: partnerAnswer || undefined,
        revealed: isRevealed,
        answeredAt: r.answered_at || undefined,
      };
    });

    for (const item of mapped) {
      await db.put('spark_prompts', item);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('u-sync-spark', { detail: mapped }));
    }
    return mapped;
  }
  return [];
}

export async function fetchAndSaveSomeday(pairId: string) {
  const { data: remote } = await supabase
    .from('someday_capsules')
    .select('*')
    .eq('pair_id', pairId)
    .order('unlock_date', { ascending: true });

  if (remote && remote.length > 0) {
    const db = await getDB();
    const mapped: SomedayCapsule[] = remote.map((r) => ({
      id: r.id,
      title: r.title,
      unlockDate: r.unlock_date,
      content: r.content || '',
      mediaType: (r.media_type as any) || 'text',
      mediaUrl: r.media_url || undefined,
      sealedBy: r.sealed_by || 'Partner',
      isUnlocked: Boolean(r.is_unlocked),
      createdAt: r.created_at || new Date().toISOString(),
      isEventScoped: Boolean(r.is_event_scoped),
      eventName: r.event_name || undefined,
      contributors: [],
    }));

    const uniqueMap = new Map<string, SomedayCapsule>();
    mapped.forEach((item) => uniqueMap.set(item.id, item));
    const deduplicated = Array.from(uniqueMap.values());

    for (const item of deduplicated) {
      await db.put('someday_capsules', item);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('u-sync-someday', { detail: deduplicated }));
    }
    return deduplicated;
  }
  return [];
}

export async function fetchAndSavePickSwipes(pairId: string, payload?: any) {
  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData?.user?.id;
  if (!myUserId) return {};

  const { data: remote } = await supabase
    .from('pick_swipes')
    .select('*')
    .eq('pair_id', pairId);

  if (remote) {
    const swipeMap: Record<string, PickSwipe> = {};
    const cardSwipes: Record<string, { userSwipe?: string; partnerSwipe?: string }> = {};

    for (const r of remote) {
      if (!cardSwipes[r.card_id]) {
        cardSwipes[r.card_id] = {};
      }

      if (r.user_id === myUserId) {
        cardSwipes[r.card_id].userSwipe = r.swipe;
      } else {
        cardSwipes[r.card_id].partnerSwipe = r.swipe;
      }
    }

    const db = await getDB();
    for (const cardId of Object.keys(cardSwipes)) {
      const uSwipe = cardSwipes[cardId].userSwipe;
      const pSwipe = cardSwipes[cardId].partnerSwipe;
      const isMatched = uSwipe === 'right' && pSwipe === 'right';

      swipeMap[cardId] = {
        cardId,
        userSwipe: uSwipe as any,
        partnerSwipe: pSwipe as any,
        matched: isMatched,
        timestamp: new Date().toISOString(),
      };

      await db.put('pick_swipes', swipeMap[cardId]);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('u-sync-pick', { detail: swipeMap }));

      if (payload?.new) {
        const item = payload.new;
        if (item.user_id !== myUserId && item.swipe === 'right') {
          window.dispatchEvent(new CustomEvent('u-sync-pick-match', { detail: item.card_id }));
        }
      }
    }
    return swipeMap;
  }
  return {};
}

export async function fetchAndSaveNudges(pairId: string, payloadNew?: any, onNudgeCb?: (nudge: NudgeRecord) => void) {
  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData?.user?.id;

  const { data: remote } = await supabase
    .from('nudges')
    .select('*')
    .eq('pair_id', pairId)
    .order('timestamp', { ascending: false });

  if (remote) {
    const db = await getDB();
    const mapped: NudgeRecord[] = remote.map((r) => ({
      id: r.id,
      sender: r.sender === myUserId ? 'You' : 'Partner',
      emoji: r.emoji || '❤️',
      label: r.label || 'Thinking of you',
      timestamp: r.timestamp,
      viewed: Boolean(r.viewed),
    }));

    const uniqueMap = new Map<string, NudgeRecord>();
    mapped.forEach((item) => uniqueMap.set(item.id, item));
    const deduplicated = Array.from(uniqueMap.values());

    for (const item of deduplicated) {
      await db.put('nudges', item);
    }

    if (payloadNew && payloadNew.sender !== myUserId) {
      Haptics.softTap();
      const newNudge: NudgeRecord = {
        id: payloadNew.id,
        sender: 'Partner',
        emoji: payloadNew.emoji || '❤️',
        label: payloadNew.label || 'Thinking of you',
        timestamp: payloadNew.timestamp,
        viewed: false,
      };

      if (onNudgeCb) onNudgeCb(newNudge);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('u-sync-new-nudge', { detail: newNudge }));
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('u-sync-nudges', { detail: deduplicated }));
    }
    return deduplicated;
  }
  return [];
}

// ----------------------------------------------------
// APP-WIDE SINGLE PERSISTENT REALTIME LISTENER
// ----------------------------------------------------

export async function startGlobalPairSync(onNudgeReceived?: (nudge: NudgeRecord) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return () => {};

  if (globalChannel && currentPairId === pairId) {
    return () => {};
  }

  if (globalChannel) {
    supabase.removeChannel(globalChannel);
    globalChannel = null;
  }

  currentPairId = pairId;

  // Initial silent load of all tables
  fetchAndSaveTrail(pairId).catch(() => {});
  fetchAndSaveSpark(pairId).catch(() => {});
  fetchAndSaveSomeday(pairId).catch(() => {});
  fetchAndSavePickSwipes(pairId).catch(() => {});
  fetchAndSaveNudges(pairId).catch(() => {});

  // Subscribe ONCE to a clean channel instance with all handlers chained BEFORE .subscribe()
  const channelName = `rt-global-${pairId}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trail_entries', filter: `pair_id=eq.${pairId}` },
      () => {
        fetchAndSaveTrail(pairId).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'spark_prompts', filter: `pair_id=eq.${pairId}` },
      (payload) => {
        if (payload.new && (payload.new as any).revealed) {
          Haptics.sparkReveal();
        }
        fetchAndSaveSpark(pairId).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'someday_capsules', filter: `pair_id=eq.${pairId}` },
      () => {
        fetchAndSaveSomeday(pairId).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pick_swipes', filter: `pair_id=eq.${pairId}` },
      (payload) => {
        fetchAndSavePickSwipes(pairId, payload).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'nudges', filter: `pair_id=eq.${pairId}` },
      (payload) => {
        fetchAndSaveNudges(pairId, payload.new, onNudgeReceived).catch(() => {});
      }
    )
    .subscribe();

  globalChannel = channel;

  return () => {
    if (globalChannel) {
      supabase.removeChannel(globalChannel);
      globalChannel = null;
      currentPairId = null;
    }
  };
}

// ----------------------------------------------------
// COMPONENT TAB SUBSCRIPTION HELPERS (LISTEN TO EVENTS / IDB)
// ----------------------------------------------------

export async function syncTrailEntries(onUpdate: (entries: TrailEntry[]) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return () => {};

  fetchAndSaveTrail(pairId).then((res) => onUpdate(res)).catch(() => {});

  const handleEvent = (e: any) => {
    if (e.detail) onUpdate(e.detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('u-sync-trail', handleEvent);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('u-sync-trail', handleEvent);
    }
  };
}

export async function syncSparkPrompts(onUpdate: (prompts: SparkPrompt[]) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return () => {};

  fetchAndSaveSpark(pairId).then((res) => onUpdate(res)).catch(() => {});

  const handleEvent = (e: any) => {
    if (e.detail) onUpdate(e.detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('u-sync-spark', handleEvent);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('u-sync-spark', handleEvent);
    }
  };
}

export async function submitSparkAnswer(promptId: string, answerText: string): Promise<SparkPrompt | null> {
  const pairId = await getActivePairId();
  if (!pairId) return null;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return null;

  const { data: pair } = await supabase
    .from('pairs')
    .select('created_by, partner_id')
    .eq('id', pairId)
    .maybeSingle();

  const isCreator = pair?.created_by === userId;

  const { data: existing } = await supabase
    .from('spark_prompts')
    .select('*')
    .eq('id', promptId)
    .maybeSingle();

  let newUserAnswer = isCreator ? answerText : existing?.user_answer || null;
  let newPartnerAnswer = !isCreator ? answerText : existing?.partner_answer || null;
  let isRevealed = Boolean(newUserAnswer && newPartnerAnswer);

  const payload = {
    id: promptId,
    pair_id: pairId,
    date: existing?.date || new Date().toISOString().split('T')[0],
    question: existing?.question || 'What made you smile today?',
    category: existing?.category || 'Intimacy',
    user_answer: newUserAnswer,
    partner_answer: newPartnerAnswer,
    revealed: isRevealed,
    answered_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('spark_prompts')
    .upsert(payload, { onConflict: 'id' });

  if (error) console.error('Error saving spark answer:', error);

  if (isRevealed) {
    Haptics.sparkReveal();
  }

  const result: SparkPrompt = {
    id: promptId,
    date: payload.date,
    question: payload.question,
    category: payload.category,
    userAnswer: answerText,
    partnerAnswer: isCreator ? (existing?.partner_answer || undefined) : (existing?.user_answer || undefined),
    revealed: isRevealed,
    answeredAt: payload.answered_at,
  };

  const db = await getDB();
  await db.put('spark_prompts', result);

  // Trigger sync broadcast locally
  fetchAndSaveSpark(pairId).catch(() => {});

  return result;
}

export async function syncSomedayCapsules(onUpdate: (capsules: SomedayCapsule[]) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return () => {};

  fetchAndSaveSomeday(pairId).then((res) => onUpdate(res)).catch(() => {});

  const handleEvent = (e: any) => {
    if (e.detail) onUpdate(e.detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('u-sync-someday', handleEvent);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('u-sync-someday', handleEvent);
    }
  };
}

export async function syncPickSwipes(
  onMatch: (cardId: string) => void,
  onUpdateSwipes: (swipes: Record<string, PickSwipe>) => void
) {
  const pairId = await getActivePairId();
  if (!pairId) return () => {};

  fetchAndSavePickSwipes(pairId).then((res) => onUpdateSwipes(res)).catch(() => {});

  const handleEvent = (e: any) => {
    if (e.detail) onUpdateSwipes(e.detail);
  };

  const handleMatchEvent = (e: any) => {
    if (e.detail) onMatch(e.detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('u-sync-pick', handleEvent);
    window.addEventListener('u-sync-pick-match', handleMatchEvent);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('u-sync-pick', handleEvent);
      window.removeEventListener('u-sync-pick-match', handleMatchEvent);
    }
  };
}

export async function syncNudges(
  onNewNudge: (nudge: NudgeRecord) => void,
  onUpdateList: (nudges: NudgeRecord[]) => void
) {
  const pairId = await getActivePairId();
  if (!pairId) return () => {};

  fetchAndSaveNudges(pairId).then((res) => onUpdateList(res)).catch(() => {});

  const handleListEvent = (e: any) => {
    if (e.detail) onUpdateList(e.detail);
  };

  const handleNewEvent = (e: any) => {
    if (e.detail) onNewNudge(e.detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('u-sync-nudges', handleListEvent);
    window.addEventListener('u-sync-new-nudge', handleNewEvent);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('u-sync-nudges', handleListEvent);
      window.removeEventListener('u-sync-new-nudge', handleNewEvent);
    }
  };
}
