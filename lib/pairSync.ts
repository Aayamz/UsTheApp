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

// ----------------------------------------------------
// 1. TRAIL ENTRIES SYNC (Deduplicated & Preserves likedByMe)
// ----------------------------------------------------
export async function syncTrailEntries(onUpdate: (entries: TrailEntry[]) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return;

  const fetchRemote = async () => {
    const { data: remote } = await supabase
      .from('trail_entries')
      .select('*')
      .eq('pair_id', pairId)
      .order('date', { ascending: false });

    if (remote && remote.length > 0) {
      const db = await getDB();
      const existingLocal = await db.getAll('trail_entries');
      const localMap = new Map(existingLocal.map((e) => [e.id, e]));

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
          likesCount: r.likes_count || 0,
          likedByMe: likedByMe,
          tags: r.tags || [],
          countdownTarget: r.countdown_target || undefined,
          location: r.location || undefined,
        };
      });

      // Deduplicate by ID to prevent duplicate items in UI
      const uniqueMap = new Map<string, TrailEntry>();
      mapped.forEach((item) => uniqueMap.set(item.id, item));
      const deduplicated = Array.from(uniqueMap.values());

      for (const item of deduplicated) {
        await db.put('trail_entries', item);
      }
      onUpdate(deduplicated);
    }
  };

  await fetchRemote();

  const channel = supabase
    .channel(`realtime-trail-${pairId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trail_entries', filter: `pair_id=eq.${pairId}` },
      async () => {
        await fetchRemote();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ----------------------------------------------------
// 2. SPARK PROMPTS SYNC & ROLE-BASED DUAL REVEAL
// ----------------------------------------------------
export async function syncSparkPrompts(onUpdate: (prompts: SparkPrompt[]) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return;

  const fetchRemote = async () => {
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
        // Correct answer attribution: creator vs partner
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
      onUpdate(mapped);
    }
  };

  await fetchRemote();

  const channel = supabase
    .channel(`realtime-spark-${pairId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'spark_prompts', filter: `pair_id=eq.${pairId}` },
      async (payload) => {
        if (payload.new && (payload.new as any).revealed) {
          Haptics.sparkReveal();
        }
        await fetchRemote();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
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

  // Fetch existing row to preserve previous partner answer
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
  return result;
}

// ----------------------------------------------------
// 3. SOMEDAY CAPSULES SYNC
// ----------------------------------------------------
export async function syncSomedayCapsules(onUpdate: (capsules: SomedayCapsule[]) => void) {
  const pairId = await getActivePairId();
  if (!pairId) return;

  const fetchRemote = async () => {
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

      // Deduplicate by ID
      const uniqueMap = new Map<string, SomedayCapsule>();
      mapped.forEach((item) => uniqueMap.set(item.id, item));
      const deduplicated = Array.from(uniqueMap.values());

      for (const item of deduplicated) {
        await db.put('someday_capsules', item);
      }
      onUpdate(deduplicated);
    }
  };

  await fetchRemote();

  const channel = supabase
    .channel(`realtime-someday-${pairId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'someday_capsules', filter: `pair_id=eq.${pairId}` },
      async () => {
        await fetchRemote();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ----------------------------------------------------
// 4. PICK SWIPES & MUTUAL MATCH ENGINE
// ----------------------------------------------------
export async function syncPickSwipes(
  onMatch: (cardId: string) => void,
  onUpdateSwipes: (swipes: Record<string, PickSwipe>) => void
) {
  const pairId = await getActivePairId();
  if (!pairId) return;

  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData?.user?.id;
  if (!myUserId) return;

  const fetchSwipes = async () => {
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

        const db = await getDB();
        await db.put('pick_swipes', swipeMap[cardId]);
      }

      onUpdateSwipes(swipeMap);
    }
  };

  await fetchSwipes();

  const channel = supabase
    .channel(`realtime-pick-${pairId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pick_swipes', filter: `pair_id=eq.${pairId}` },
      async (payload) => {
        await fetchSwipes();
        if (payload.new) {
          const updated = payload.new as any;
          if (updated.user_id !== myUserId && updated.swipe === 'right') {
            onMatch(updated.card_id);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ----------------------------------------------------
// 5. NUDGES REALTIME SYNC
// ----------------------------------------------------
export async function syncNudges(
  onNewNudge: (nudge: NudgeRecord) => void,
  onUpdateList: (nudges: NudgeRecord[]) => void
) {
  const pairId = await getActivePairId();
  if (!pairId) return;

  const { data: authData } = await supabase.auth.getUser();
  const myUserId = authData?.user?.id;

  const fetchNudges = async () => {
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

      // Deduplicate by ID
      const uniqueMap = new Map<string, NudgeRecord>();
      mapped.forEach((item) => uniqueMap.set(item.id, item));
      const deduplicated = Array.from(uniqueMap.values());

      for (const item of deduplicated) {
        await db.put('nudges', item);
      }
      onUpdateList(deduplicated);
    }
  };

  await fetchNudges();

  const channel = supabase
    .channel(`realtime-nudges-${pairId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'nudges', filter: `pair_id=eq.${pairId}` },
      async (payload) => {
        const item = payload.new as any;
        if (item.sender !== myUserId) {
          Haptics.softTap();
          const newNudge: NudgeRecord = {
            id: item.id,
            sender: 'Partner',
            emoji: item.emoji || '❤️',
            label: item.label || 'Thinking of you',
            timestamp: item.timestamp,
            viewed: false,
          };
          onNewNudge(newNudge);
        }
        await fetchNudges();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
