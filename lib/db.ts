import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface TrailEntry {
  id: string;
  type: 'moment' | 'countdown' | 'on_this_day';
  title: string;
  description?: string;
  imageUrl?: string;
  date: string; // ISO string
  partner: string;
  likesCount: number;
  tags?: string[];
  countdownTarget?: string; // target date ISO
  location?: string;
  spaceId?: string;
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
  spaceId?: string;
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
  sender: string;
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
const DB_VERSION = 2; // Incremented version to purge old dummy records

let dbPromise: Promise<IDBPDatabase<UDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<UDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable on server'));
  }
  if (!dbPromise) {
    dbPromise = openDB<UDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Clear all dummy stores on upgrade to v2
        if (oldVersion < 2) {
          const names = Array.from(db.objectStoreNames);
          for (const name of names) {
            db.deleteObjectStore(name);
          }
        }

        if (!db.objectStoreNames.contains('trail_entries')) {
          const trailStore = db.createObjectStore('trail_entries', { keyPath: 'id' });
          trailStore.createIndex('by-date', 'date');
        }

        if (!db.objectStoreNames.contains('spark_prompts')) {
          const sparkStore = db.createObjectStore('spark_prompts', { keyPath: 'id' });
          sparkStore.createIndex('by-date', 'date');
        }

        if (!db.objectStoreNames.contains('someday_capsules')) {
          const capsuleStore = db.createObjectStore('someday_capsules', { keyPath: 'id' });
          capsuleStore.createIndex('by-unlockDate', 'unlockDate');
        }

        if (!db.objectStoreNames.contains('pick_cards')) {
          const cardStore = db.createObjectStore('pick_cards', { keyPath: 'id' });
          cardStore.createIndex('by-deck', 'deck');
        }
        if (!db.objectStoreNames.contains('pick_swipes')) {
          db.createObjectStore('pick_swipes', { keyPath: 'cardId' });
        }

        if (!db.objectStoreNames.contains('nudges')) {
          const nudgeStore = db.createObjectStore('nudges', { keyPath: 'id' });
          nudgeStore.createIndex('by-timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Clear all user dummy data for a fresh start
export async function purgeAllDummyData() {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  await db.clear('trail_entries');
  await db.clear('spark_prompts');
  await db.clear('someday_capsules');
  await db.clear('pick_swipes');
  await db.clear('nudges');
}

// Seed default pick cards and initial spark prompt without hardcoded dummy users
export async function seedInitialDataIfEmpty() {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  const cardCount = await db.count('pick_cards');

  if (cardCount === 0) {
    // Seed Pick Deck Choices (Default clean cards for swiping)
    const defaultCards: PickCard[] = [
      {
        id: 'p-1',
        deck: 'food',
        title: 'Artisanal Wood-fired Pizza',
        description: 'Crispy Neapolitan sourdough crust, truffle cream, fresh basil, and burrata.',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
        tags: ['Cozy', 'Comfort Food', 'Casual'],
        rating: '4.9 ★',
      },
      {
        id: 'p-2',
        deck: 'food',
        title: 'Authentic Omakase Sushi',
        description: 'Fresh salmon nigiri, toro, spicy tuna rolls, and warm miso soup.',
        image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80',
        tags: ['Japanese', 'Date Night', 'Fresh'],
        rating: '4.8 ★',
      },
      {
        id: 'p-3',
        deck: 'food',
        title: 'Tacos & Mezcal Fiesta',
        description: 'Slow-cooked birria tacos, freshly mashed guacamole, and smoky lime mezcal cocktails.',
        image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
        tags: ['Mexican', 'Fun Vibe', 'Cocktails'],
        rating: '4.7 ★',
      },
      {
        id: 'p-4',
        deck: 'movie',
        title: 'La La Land',
        description: 'A jazz pianist and an aspiring actress fall in love while pursuing their dreams in LA.',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
        tags: ['Romance', 'Musical', 'Aesthetic'],
        rating: '4.9 ★',
      },
      {
        id: 'p-5',
        deck: 'plan',
        title: 'Sunset Beach Picnic & Blankets',
        description: 'Pack cheese, grapes, sparkling cider, and watch the waves as the sky turns orange.',
        image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        tags: ['Outdoor', 'Romantic', 'Budget Friendly'],
        rating: '5.0 ★',
      },
    ];

    const txCards = db.transaction('pick_cards', 'readwrite');
    for (const card of defaultCards) {
      await txCards.store.put(card);
    }
    await txCards.done;
  }

  // Seed default daily Spark prompt if empty
  const sparkCount = await db.count('spark_prompts');
  if (sparkCount === 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const initialSpark: SparkPrompt = {
      id: `s-${todayStr}`,
      date: todayStr,
      question: 'What is one small thing I did this week that made you feel deeply cherished?',
      category: 'Intimacy & Gratitude',
      revealed: false,
    };

    await db.put('spark_prompts', initialSpark);
  }
}
