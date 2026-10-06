/**
 * Robust AI Content Generator with Dynamic Model Discovery & Zero-Downtime Fallback Pool.
 */

interface GeneratedSpark {
  question: string;
  category: string;
}

interface GeneratedPickCard {
  deck: 'food' | 'movie' | 'plan' | 'travel';
  title: string;
  description: string;
  tags: string[];
}

export interface DailyContentResult {
  spark: GeneratedSpark;
  pick_cards: GeneratedPickCard[];
  source: 'groq' | 'fallback';
}

const STATIC_MODEL_FALLBACKS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-specdec',
  'llama-3.1-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'gemma2-9b-it',
];

async function getActiveGroqModels(apiKey: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        const textModels = data.data
          .map((m: any) => m.id)
          .filter(
            (id: string) =>
              typeof id === 'string' &&
              !id.includes('guard') &&
              !id.includes('whisper') &&
              !id.includes('audio') &&
              !id.includes('vision') &&
              !id.includes('embed') &&
              !id.includes('decommissioned')
          );
        if (textModels.length > 0) {
          return textModels;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch active Groq models dynamically:', err);
  }
  return STATIC_MODEL_FALLBACKS;
}

export async function generateDailyContent(): Promise<DailyContentResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    const dynamicModels = await getActiveGroqModels(apiKey);
    const candidateModels = Array.from(
      new Set(
        [process.env.GROQ_MODEL, ...dynamicModels, ...STATIC_MODEL_FALLBACKS].filter(
          Boolean
        ) as string[]
      )
    );

    const month = new Date().toLocaleString('en-US', { month: 'long' });
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const prompt = `You write dynamic daily content for "U&", a private app for couples and close friends.
It is ${day}, ${month}.

Return ONLY valid JSON, no prose, in this exact shape:
{
  "spark": { "question": string, "category": string },
  "pick_cards": [
    { "deck": "food"|"movie"|"plan"|"travel", "title": string, "description": string, "tags": string[] }
  ]
}

Rules:
- "spark.question": a warm, fun, engaging, slightly playful question for two people to answer privately (e.g. "What is something I do that unexpectedly makes you smile?", "What's a memory of us you secretly replayed recently?").
- Provide 4 "pick_cards", one for each deck: "food", "movie", "plan", "travel".
- Return pure valid JSON only. No markdown formatting.`;

    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.9,
          }),
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`Groq model ${model} returned HTTP ${res.status}: ${errText}`);
          continue;
        }

        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) continue;

        const parsed = JSON.parse(rawContent);
        if (parsed.spark?.question && Array.isArray(parsed.pick_cards) && parsed.pick_cards.length > 0) {
          return {
            spark: parsed.spark,
            pick_cards: parsed.pick_cards,
            source: 'groq',
          };
        }
      } catch (err: any) {
        console.warn(`Groq generation failed with model ${model}:`, err.message);
      }
    }
  }

  // Graceful Curated Fallback Pool
  console.info('Using curated fallback content pool for daily generation.');
  return getCuratedFallbackContent();
}

function getCuratedFallbackContent(): DailyContentResult {
  const sparkPool: GeneratedSpark[] = [
    {
      question: 'What is one small thing I did this week that made you feel deeply cherished?',
      category: 'Intimacy & Gratitude',
    },
    {
      question: 'If we had an unplanned free 48 hours starting right now, where would you want us to escape to?',
      category: 'Dreams & Adventures',
    },
    {
      question: 'What is a song that instantly reminds you of one of our favorite memories together?',
      category: 'Music & Memories',
    },
    {
      question: 'What was your exact first impression of me, and how has it evolved since?',
      category: 'Reflection & Nostalgia',
    },
    {
      question: "What's a cozy ritual we haven't tried yet that you'd love to make 'our thing'?",
      category: 'Cozy Connections',
    },
    {
      question: 'If you could re-live one single evening from our time together, which one would you pick?',
      category: 'Romance & Joy',
    },
  ];

  const foodPool: GeneratedPickCard[] = [
    {
      deck: 'food',
      title: 'Late Night Gourmet Tacos & Margaritas',
      description: 'Street-style tacos with fresh guacamole and spiced rim drinks.',
      tags: ['Cozy', 'Casual', 'Fun'],
    },
    {
      deck: 'food',
      title: 'Artisan Wood-Fired Style Pizza Night',
      description: 'Crafting homemade pizzas together with custom wild toppings.',
      tags: ['Hands-on', 'Romantic'],
    },
    {
      deck: 'food',
      title: 'Sushi & Sake Pairing Experience',
      description: 'Fresh sashimi, spicy tuna rolls, and warm sake by candlelight.',
      tags: ['Flavorful', 'Date Night'],
    },
  ];

  const moviePool: GeneratedPickCard[] = [
    {
      deck: 'movie',
      title: 'Mind-Bending Sci-Fi Thriller',
      description: 'A gripping feature film with plot twists that will keep us debating until late.',
      tags: ['Suspense', 'Late Night'],
    },
    {
      deck: 'movie',
      title: 'Warm Feel-Good Romantic Comedy',
      description: 'A timeless, cozy romance with great soundtrack and endless laughs.',
      tags: ['Cozy', 'Lighthearted'],
    },
  ];

  const planPool: GeneratedPickCard[] = [
    {
      deck: 'plan',
      title: 'Stargazing & Hot Cocoa Escape',
      description: 'Drive out to a quiet vantage point with thick blankets and warm drinks.',
      tags: ['Outdoors', 'Romantic'],
    },
    {
      deck: 'plan',
      title: 'Vinyl Record & Board Game Night',
      description: 'Dim lighting, favorite tunes spinning, and playful friendly competition.',
      tags: ['Home', 'Playful'],
    },
  ];

  const travelPool: GeneratedPickCard[] = [
    {
      deck: 'travel',
      title: 'Secluded Mountain Cabin Weekend',
      description: 'Fireplace, crisp morning air, hot coffee on the wooden deck.',
      tags: ['Nature', 'Weekend Getaway'],
    },
    {
      deck: 'travel',
      title: 'Coastal Boutique Stay & Sunset Walk',
      description: 'Ocean breeze, fresh seafood, and barefoot sunset walks along the shore.',
      tags: ['Beach', 'Relaxation'],
    },
  ];

  const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  return {
    spark: pickRandom(sparkPool),
    pick_cards: [
      pickRandom(foodPool),
      pickRandom(moviePool),
      pickRandom(planPool),
      pickRandom(travelPool),
    ],
    source: 'fallback',
  };
}
