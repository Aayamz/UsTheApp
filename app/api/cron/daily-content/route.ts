import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// Scheduled by vercel.json to run once a day. Protected by CRON_SECRET so
// randoms can't trigger it (and burn your free Groq quota) by hitting the URL.

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function askGroq(prompt: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function buildPrompt(location: string | null, currency: string | null) {
  const month = new Date().toLocaleString('en-US', { month: 'long' });
  const locationLine = location
    ? `They're based near ${location} -- let that inform plan/food ideas (local season, typical weather, nearby-feeling suggestions) without inventing specific real business names.`
    : `No location given -- keep suggestions broadly applicable.`;
  const currencyLine = currency
    ? `If you reference cost, use ${currency} as the implied currency, but don't fabricate precise prices.`
    : '';

  return `You write content for "U&", a private daily app for one couple.
It's ${month}. ${locationLine} ${currencyLine}

Return ONLY valid JSON, no prose, in this exact shape:
{
  "spark": { "question": string, "category": string },
  "pick_cards": [
    { "deck": "food"|"movie"|"plan"|"travel", "title": string, "description": string, "tags": string[] }
  ]
}

Rules:
- "spark.question" is a warm, specific, slightly playful prompt for two partners to
  both answer privately (not generic like "what's your favorite color" -- something
  that surfaces a real memory, preference, or small confession).
- Provide exactly 5 "pick_cards", mixing decks, each a genuinely appealing option a
  couple could actually choose between tonight or this weekend. Vary them from any
  typical "pizza / sushi / tacos" default -- be specific and seasonal.
- No markdown, no backticks, just the JSON object.`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: pairs, error: pairsError } = await supabase
    .from('pairs')
    .select('id, created_by, partner_id');

  if (pairsError) {
    return NextResponse.json({ error: pairsError.message }, { status: 500 });
  }

  const results: Record<string, string> = {};

  for (const pair of pairs ?? []) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('location, currency')
        .in('id', [pair.created_by, pair.partner_id])
        .not('location', 'is', null)
        .limit(1)
        .maybeSingle();

      const content = await askGroq(buildPrompt(profile?.location ?? null, profile?.currency ?? null));

      await supabase.from('spark_prompts').upsert({
        id: `s-${pair.id}-${today}`,
        pair_id: pair.id,
        date: today,
        question: content.spark.question,
        category: content.spark.category,
        source: 'ai',
      });

      const cardRows = (content.pick_cards ?? []).map((c: any, i: number) => ({
        id: `p-${pair.id}-${today}-${i}`,
        pair_id: pair.id,
        date: today,
        deck: c.deck,
        title: c.title,
        description: c.description,
        tags: c.tags ?? [],
        source: 'ai',
      }));

      if (cardRows.length) {
        await supabase.from('pick_cards').upsert(cardRows);
      }

      results[pair.id] = 'ok';
    } catch (err: any) {
      console.error(`Daily content generation failed for pair ${pair.id}:`, err.message);
      results[pair.id] = 'failed';
    }
  }

  return NextResponse.json({ date: today, results });
}
