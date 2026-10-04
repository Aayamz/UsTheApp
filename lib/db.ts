import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface TrailEntry {
  id: string;
  type: 'moment' | 'countdown' | 'on_this_day';
  title: string;
  description?: string;
  imageUrl?: string;
  date: string; // ISO string
  partner: 'You' | 'Alex';
  likesCount: number;
  tags?: string[];
  countdownTarget?: string; // target date ISO
  location?: string;
}

export interface SparkPrompt {
  id: string;
  date: string; // YYYY-MM-DD
  question: string;
  category: string;
  userAnswer?: string;
  partnerAnswer?: string;
  revealed: boolean;
  answeredAt?: string;
}

export interface CapsuleContributor {
  id: string;
  name: string;
  avatar: string;
  addedAt: string;
  messageSnippet?: string;
}

export interface SomedayCapsule {
  id: string;
  title: string;
  unlockDate: string; // ISO date
  content: string;
  mediaType: 'text' | 'image' | 'voice';
  mediaUrl?: string;
  sealedBy: string;
  isUnlocked: boolean;
  contributors: CapsuleContributor[];
  createdAt: string;
  isEventScoped?: boolean;
  eventName?: string;
}

export interface PickCard {
  id: string;
  deck: 'food' | 'movie' | 'plan' | 'travel';
  title: string;
  description: string;
  image: string;
  tags: string[];
  rating?: string;
}

export interface PickSwipe {
  cardId: string;
  userSwipe?: 'left' | 'right';
  partnerSwipe?: 'left' | 'right';
  matched: boolean;
  timestamp: string;
}

export interface NudgeRecord {
  id: string;
  sender: 'You' | 'Alex';
  emoji: string;
  label: string;
  timestamp: string;
  viewed: boolean;
}

export interface SyncMutation {
  id: string;
  store: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

interface UDB extends DBSchema {
  trail_entries: {
    key: string;
    value: TrailEntry;
    indexes: { 'by-date': string };
  };
  spark_prompts: {
    key: string;
    value: SparkPrompt;
    indexes: { 'by-date': string };
  };
  someday_capsules: {
    key: string;
    value: SomedayCapsule;
    indexes: { 'by-unlockDate': string };
  };
  pick_cards: {
    key: string;
    value: PickCard;
    indexes: { 'by-deck': string };
  };
  pick_swipes: {
    key: string;
    value: PickSwipe;
  };
  nudges: {
    key: string;
    value: NudgeRecord;
    indexes: { 'by-timestamp': string };
  };
  sync_queue: {
    key: string;
    value: SyncMutation;
  };
}

const DB_NAME = 'u_and_companion_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<UDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<UDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable on server'));
  }
  if (!dbPromise) {
    dbPromise = openDB<UDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Trail entries store
        if (!db.objectStoreNames.contains('trail_entries')) {
          const trailStore = db.createObjectStore('trail_entries', { keyPath: 'id' });
          trailStore.createIndex('by-date', 'date');
        }

        // Spark prompts store
        if (!db.objectStoreNames.contains('spark_prompts')) {
          const sparkStore = db.createObjectStore('spark_prompts', { keyPath: 'id' });
          sparkStore.createIndex('by-date', 'date');
        }

        // Someday capsules store
        if (!db.objectStoreNames.contains('someday_capsules')) {
          const capsuleStore = db.createObjectStore('someday_capsules', { keyPath: 'id' });
          capsuleStore.createIndex('by-unlockDate', 'unlockDate');
        }

        // Pick cards & swipes store
        if (!db.objectStoreNames.contains('pick_cards')) {
          const cardStore = db.createObjectStore('pick_cards', { keyPath: 'id' });
          cardStore.createIndex('by-deck', 'deck');
        }
        if (!db.objectStoreNames.contains('pick_swipes')) {
          db.createObjectStore('pick_swipes', { keyPath: 'cardId' });
        }

        // Nudges store
        if (!db.objectStoreNames.contains('nudges')) {
          const nudgeStore = db.createObjectStore('nudges', { keyPath: 'id' });
          nudgeStore.createIndex('by-timestamp', 'timestamp');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Initial Seeds to ensure instant paint on first boot!
export async function seedInitialDataIfEmpty() {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  const trailCount = await db.count('trail_entries');

  if (trailCount === 0) {
    const todayISO = new Date().toISOString();
    
    // Seed Trail
    const initialTrail: TrailEntry[] = [
      {
        id: 't-1',
        type: 'countdown',
        title: '3rd Anniversary Getaway to Kyoto 🌸',
        description: 'Tickets booked, Ryokan confirmed in Arashiyama!',
        date: todayISO,
        partner: 'You',
        likesCount: 14,
        countdownTarget: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Kyoto, Japan',
        imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 't-2',
        type: 'on_this_day',
        title: 'On This Day 2 Years Ago: First Rainy Walk',
        description: 'We shared that tiny red umbrella and stopped for warm cocoa in Soho.',
        date: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        partner: 'Alex',
        likesCount: 29,
        location: 'Soho Coffee House',
        imageUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 't-3',
        type: 'moment',
        title: 'Late Night Stargazing on the Rooftop',
        description: 'Made hot chamomile tea and spotted three shooting stars.',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        partner: 'Alex',
        likesCount: 8,
        location: 'Our Terrace',
        imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
      },
      {
        id: 't-4',
        type: 'moment',
        title: 'Sunday Pasta Making Masterpiece',
        description: 'Flour everywhere on the kitchen counter, but the handmade ravioli was 10/10!',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        partner: 'You',
        likesCount: 12,
        location: 'Kitchen Studio',
        imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
      }
    ];

    const txTrail = db.transaction('trail_entries', 'readwrite');
    for (const entry of initialTrail) {
      await txTrail.store.put(entry);
    }
    await txTrail.done;

    // Seed Spark Prompts
    const todayStr = new Date().toISOString().split('T')[0];
    const initialSpark: SparkPrompt[] = [
      {
        id: `s-${todayStr}`,
        date: todayStr,
        question: 'What is one small thing I did this week that made you feel deeply cherished?',
        category: 'Intimacy & Gratitude',
        revealed: false,
        partnerAnswer: 'When you left that tiny sticky note on my coffee mug on Tuesday morning! ☕✨',
      },
      {
        id: 's-yesterday',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        question: 'If we could teleport anywhere in the world for 24 hours right now, where would we go?',
        category: 'Dream Travel',
        userAnswer: 'A cozy wooden cabin in the Swiss Alps with a roaring fireplace and heavy snow outside.',
        partnerAnswer: 'Positano coast, sipping limoncello while watching the sunset over the sea!',
        revealed: true,
        answeredAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    const txSpark = db.transaction('spark_prompts', 'readwrite');
    for (const prompt of initialSpark) {
      await txSpark.store.put(prompt);
    }
    await txSpark.done;

    // Seed Someday Capsules
    const unlockSoon = new Date(Date.now() + 10000).toISOString(); // Unlocks in 10 seconds for instant interactive testing!
    const unlockNextYear = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const initialCapsules: SomedayCapsule[] = [
      {
        id: 'c-ready',
        title: 'Open When You Need A Warm Smile 💌',
        unlockDate: new Date(Date.now() - 1000).toISOString(), // Unlocked ready to tap!
        content: 'Remember that no matter how stressful the week gets, I am always right here in your corner cheering for you. You are my favorite human.',
        mediaType: 'text',
        sealedBy: 'Alex',
        isUnlocked: false,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        contributors: [
          { id: 'u-1', name: 'Alex', avatar: '✨', addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
        ]
      },
      {
        id: 'c-anniversary',
        title: 'For Our 4th Year Milestone 🥂',
        unlockDate: unlockNextYear,
        content: 'A collection of our private photo memories, voice notes, and secret promises for our future home.',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&auto=format&fit=crop&q=80',
        sealedBy: 'You',
        isUnlocked: false,
        createdAt: new Date().toISOString(),
        isEventScoped: true,
        eventName: 'Anniversary Party 2026',
        contributors: [
          { id: 'u-1', name: 'You', avatar: '💖', addedAt: new Date().toISOString(), messageSnippet: 'Added our dinner photos' },
          { id: 'u-2', name: 'Alex', avatar: '🌿', addedAt: new Date().toISOString(), messageSnippet: 'Added a 45s audio note' },
          { id: 'u-3', name: 'Maya (Friend)', avatar: '🎉', addedAt: new Date().toISOString(), messageSnippet: 'Left a congratulatory wish' }
        ]
      }
    ];

    const txCapsules = db.transaction('someday_capsules', 'readwrite');
    for (const cap of initialCapsules) {
      await txCapsules.store.put(cap);
    }
    await txCapsules.done;

    // Seed Pick Deck Cards
    const initialCards: PickCard[] = [
      {
        id: 'p-1',
        deck: 'food',
        title: 'Artisanal Wood-fired Pizza',
        description: 'Crispy Neapolitan sourdough crust, truffle cream, fresh basil, and burrata.',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
        tags: ['Cozy', 'Comfort Food', 'Casual'],
        rating: '4.9 ★'
      },
      {
        id: 'p-2',
        deck: 'food',
        title: 'Authentic Omakase Sushi',
        description: 'Fresh salmon nigiri, toro, spicy tuna rolls, and warm miso soup.',
        image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80',
        tags: ['Japanese', 'Date Night', 'Fresh'],
        rating: '4.8 ★'
      },
      {
        id: 'p-3',
        deck: 'food',
        title: 'Tacos & Mezcal Fiesta',
        description: 'Slow-cooked birria tacos, freshly mashed guacamole, and smoky lime mezcal cocktails.',
        image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
        tags: ['Mexican', 'Fun Vibe', 'Cocktails'],
        rating: '4.7 ★'
      },
      {
        id: 'p-4',
        deck: 'movie',
        title: 'La La Land',
        description: 'A jazz pianist and an aspiring actress fall in love while pursuing their dreams in LA.',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
        tags: ['Romance', 'Musical', 'Aesthetic'],
        rating: '4.9 ★'
      },
      {
        id: 'p-5',
        deck: 'plan',
        title: 'Sunset Beach Picnic & Blankets',
        description: 'Pack cheese, grapes, sparkling cider, and watch the waves as the sky turns orange.',
        image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        tags: ['Outdoor', 'Romantic', 'Budget Friendly'],
        rating: '5.0 ★'
      }
    ];

    const txCards = db.transaction('pick_cards', 'readwrite');
    for (const card of initialCards) {
      await txCards.store.put(card);
    }
    await txCards.done;

    // Seed Initial Pick Swipe state (Alex has already swiped right on Pizza & Beach Picnic so matching feels instant and magical!)
    const initialSwipes: PickSwipe[] = [
      { cardId: 'p-1', partnerSwipe: 'right', matched: false, timestamp: new Date().toISOString() },
      { cardId: 'p-5', partnerSwipe: 'right', matched: false, timestamp: new Date().toISOString() }
    ];
    const txSwipes = db.transaction('pick_swipes', 'readwrite');
    for (const s of initialSwipes) {
      await txSwipes.store.put(s);
    }
    await txSwipes.done;

    // Seed Nudges
    const initialNudges: NudgeRecord[] = [
      {
        id: 'n-1',
        sender: 'Alex',
        emoji: '💌',
        label: 'Thinking of you right now',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        viewed: true,
      },
      {
        id: 'n-2',
        sender: 'You',
        emoji: '💖',
        label: 'Sending warm hugs',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        viewed: true,
      }
    ];
    const txNudges = db.transaction('nudges', 'readwrite');
    for (const n of initialNudges) {
      await txNudges.store.put(n);
    }
    await txNudges.done;
  }
}
