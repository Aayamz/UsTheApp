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

  if (profile?.pair_id) {
    const { data: validPair } = await supabase
      .from('pairs')
      .select('id')
      .eq('id', profile.pair_id)
      .maybeSingle();
    if (validPair) return validPair.id;
  }

  const { data: memberRow } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (memberRow?.space_id) {
    await supabase
      .from('profiles')
      .upsert({ id: authData.user.id, pair_id: memberRow.space_id });
    return memberRow.space_id;
  }

  const { data: pairs } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id')
    .or(`created_by.eq.${authData.user.id},partner_id.eq.${authData.user.id}`);

  if (pairs && pairs.length > 0) {
    const active =
      pairs.find((p) => p.partner_id !== null) ||
      pairs.find((p) => p.partner_id === authData.user.id) ||
      pairs[0];

    if (active) {
      await supabase
        .from('profiles')
        .upsert({ id: authData.user.id, pair_id: active.id });
      return active.id;
    }
  }

  return null;
}

let globalChannel: any = null;
let currentPairId: string | null = null;

// ----------------------------------------------------
// FETCH & SAVE HELPERS WITH CANONICAL PAIR DEDUPLICATION
// ----------------------------------------------------

export async function fetchAndSaveTrail(pairId: string) {
  const db = await getDB();
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id;

  let partnerDisplayName = 'Partner';
  if (currentUserId && pairId) {
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('pair_id', pairId)
      .neq('id', currentUserId)
      .maybeSingle();

    if (partnerProfile?.display_name) {
      partnerDisplayName = partnerProfile.display_name;
    }
  }

  const existingLocal = await db.getAll('trail_entries');
  const localMap = new Map(existingLocal.map((e) => [e.id, e]));

  const { data: remote, error } = await supabase
    .from('trail_entries')
    .select('*')
    .eq('pair_id', pairId)
    .order('date', { ascending: false });

  if (error) console.error('Error fetching trail entries:', error);

  if (remote) {
    remote.forEach((r) => {
      const localItem = localMap.get(r.id);
      const likedByMe = localItem ? Boolean(localItem.likedByMe) : false;

      const isMine =
        (r.created_by && r.created_by === currentUserId) ||
        (r.partner && r.partner === currentUserId) ||
        (localItem?.partner === 'You' && (!r.partner || r.partner === 'You' || r.partner === currentUserId));

      const authorName = isMine ? 'You' : partnerDisplayName;

      localMap.set(r.id, {
        id: r.id,
        type: (r.type as any) || 'moment',
        title: r.title,
        description: r.description || undefined,
        imageUrl: r.image_url || undefined,
        date: r.date,
        partner: authorName,
        likesCount: r.likes_count ?? 0,
        likedByMe,
        tags: r.tags || [],
        countdownTarget: r.countdown_target || undefined,
        location: r.location || undefined,
      });
    });
  }

  const merged = Array.from(localMap.values());
  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const item of merged) {
    await db.put('trail_entries', item);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('u-sync-trail', { detail: merged }));
  }
  return merged;
}

export async function fetchAndSaveSpark(pairId: string) {
  const db = await getDB();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  const { data: pair } = await supabase
    .from('pairs')
    .select('created_by, partner_id')
    .eq('id', pairId)
    .maybeSingle();

  const isCreator = pair?.created_by === userId;

  let { data: remote, error } = await supabase
    .from('spark_prompts')
    .select('*')
    .eq('pair_id', pairId)
    .order('date', { ascending: false });

  if (error) console.error('Error fetching spark prompts:', error);

  const todayStr = new Date().toISOString().split('T')[0];
  const hasToday = remote?.some((r) => r.date === todayStr);

  if (!hasToday && pairId) {
    const canonicalId = `s-${pairId}-${todayStr}`;
    const defaultSparkRow = {
      id: canonicalId,
      pair_id: pairId,
      date: todayStr,
      question: 'What is one small detail about me that you noticed recently?',
      category: 'Connection & Joy',
      user_answer: null,
      partner_answer: null,
      revealed: false,
      answered_at: null,
      source: 'default',
    };

    const { error: sparkUpsertErr } = await supabase
      .from('spark_prompts')
      .upsert(defaultSparkRow, { onConflict: 'id' });

    if (!sparkUpsertErr) {
      remote = [defaultSparkRow, ...(remote || [])];
    }
  }

  const dateMap = new Map<string, SparkPrompt>();

  if (remote && remote.length > 0) {
    for (const r of remote) {
      const canonicalId = `s-${pairId}-${r.date}`;
      const myAnswer = isCreator ? r.user_answer : r.partner_answer;
      const partnerAnswer = isCreator ? r.partner_answer : r.user_answer;

      const isUserAnswered = Boolean(myAnswer);
      const isPartnerAnswered = Boolean(partnerAnswer);
      const isRevealed = Boolean(r.revealed || (isUserAnswered && isPartnerAnswered));

      const mappedItem: SparkPrompt = {
        id: canonicalId,
        date: r.date,
        question: r.question,
        category: r.category || 'Connection',
        userAnswer: myAnswer || undefined,
        partnerAnswer: partnerAnswer || undefined,
        revealed: isRevealed,
        answeredAt: r.answered_at || undefined,
      };

      const existing = dateMap.get(r.date);
      // Canonical row or latest prompt for date always takes priority over legacy rows
      if (!existing || r.id === canonicalId) {
        dateMap.set(r.date, mappedItem);
      }
    }
  }

  // Purge legacy non-canonical spark prompts from IndexedDB
  const existingLocal = await db.getAll('spark_prompts');
  for (const localItem of existingLocal) {
    const validForDate = dateMap.get(localItem.date);
    if (!validForDate || localItem.id !== validForDate.id) {
      await db.delete('spark_prompts', localItem.id);
    }
  }

  const merged = Array.from(dateMap.values());
  merged.sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const item of merged) {
    await db.put('spark_prompts', item);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('u-sync-spark', { detail: merged }));
  }
  return merged;
}

export async function fetchAndSaveSomeday(pairId: string) {
  const db = await getDB();
  const existingLocal = await db.getAll('someday_capsules');
  const localMap = new Map(existingLocal.map((e) => [e.id, e]));

  const { data: remote, error } = await supabase
    .from('someday_capsules')
    .select('*')
    .eq('pair_id', pairId)
    .order('unlock_date', { ascending: true });

  if (error) console.error('Error fetching someday capsules:', error);

  if (remote) {
    remote.forEach((r) => {
      localMap.set(r.id, {
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
        contributors: localMap.get(r.id)?.contributors || [],
      });
    });
  }

  const merged = Array.from(localMap.values());
  merged.sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());

  for (const item of merged) {
    await db.put('someday_capsules', item);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('u-sync-someday', { detail: merged }));
  }
  return merged;
}

export async function fetchAndSavePickSwipes(pairId: string, payload?: any) {
  const db = await getDB();
  const existingSwipes = await db.getAll('pick_swipes');
  const swipeMap: Record<string, PickSwipe> = {};
  existingSwipes.forEach((s) => {
    swipeMap[s.cardId] = s;
  });

  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData?.user?.id;
  if (!myUserId) return swipeMap;

  const { data: remote, error } = await supabase
    .from('pick_swipes')
    .select('*')
    .eq('pair_id', pairId);

  if (error) console.error('Error fetching pick swipes:', error);

  if (remote) {
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

export async function fetchAndSaveNudges(pairId: string, payloadNew?: any, onNudgeCb?: (nudge: NudgeRecord) => void) {
  const db = await getDB();
  const existingNudges = await db.getAll('nudges');
  const localMap = new Map(existingNudges.map((e) => [e.id, e]));

  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData?.user?.id;

  const { data: remote, error } = await supabase
    .from('nudges')
    .select('*')
    .eq('pair_id', pairId)
    .order('timestamp', { ascending: false });

  if (error) console.error('Error fetching nudges:', error);

  if (remote) {
    remote.forEach((r) => {
      localMap.set(r.id, {
        id: r.id,
        sender: r.sender === myUserId ? 'You' : 'Partner',
        emoji: r.emoji || '❤️',
        label: r.label || 'Thinking of you',
        timestamp: r.timestamp,
        viewed: Boolean(r.viewed),
      });
    });
  }

  const merged = Array.from(localMap.values());
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  for (const item of merged) {
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
    window.dispatchEvent(new CustomEvent('u-sync-nudges', { detail: merged }));
  }
  return merged;
}

// ----------------------------------------------------
// APP-WIDE SINGLE PERSISTENT REALTIME LISTENER + AUTO-POLLING
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

  const refreshAll = () => {
    if (!currentPairId) return;
    fetchAndSaveTrail(currentPairId).catch(() => {});
    fetchAndSaveSpark(currentPairId).catch(() => {});
    fetchAndSaveSomeday(currentPairId).catch(() => {});
    fetchAndSavePickSwipes(currentPairId).catch(() => {});
    fetchAndSaveNudges(currentPairId).catch(() => {});
  };

  refreshAll();

  const pollInterval = setInterval(() => {
    refreshAll();
  }, 3000);

  const channelName = `rt-global-${pairId}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trail_entries' },
      () => {
        fetchAndSaveTrail(pairId).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'spark_prompts' },
      (payload: any) => {
        if (payload.new && payload.new.revealed) {
          Haptics.sparkReveal();
        }
        fetchAndSaveSpark(pairId).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'someday_capsules' },
      () => {
        fetchAndSaveSomeday(pairId).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pick_swipes' },
      (payload: any) => {
        fetchAndSavePickSwipes(pairId, payload).catch(() => {});
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'nudges' },
      (payload: any) => {
        fetchAndSaveNudges(pairId, payload.new, onNudgeReceived).catch(() => {});
      }
    )
    .subscribe();

  globalChannel = channel;

  return () => {
    clearInterval(pollInterval);
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

  const dateStr = new Date().toISOString().split('T')[0];
  const canonicalId = `s-${pairId}-${dateStr}`;

  const { data: existing } = await supabase
    .from('spark_prompts')
    .select('*')
    .eq('id', canonicalId)
    .maybeSingle();

  let newUserAnswer = isCreator ? answerText : existing?.user_answer || null;
  let newPartnerAnswer = !isCreator ? answerText : existing?.partner_answer || null;
  let isRevealed = Boolean(newUserAnswer && newPartnerAnswer);

  const payload = {
    id: canonicalId,
    pair_id: pairId,
    date: dateStr,
    question: existing?.question || 'What is a small detail about me that you noticed recently?',
    category: existing?.category || 'Connection',
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
    id: canonicalId,
    date: payload.date,
    question: payload.question,
    category: payload.category,
    userAnswer: isCreator ? newUserAnswer || undefined : newPartnerAnswer || undefined,
    partnerAnswer: isCreator ? newPartnerAnswer || undefined : newUserAnswer || undefined,
    revealed: isRevealed,
    answeredAt: payload.answered_at,
  };

  const db = await getDB();
  await db.put('spark_prompts', result);

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
