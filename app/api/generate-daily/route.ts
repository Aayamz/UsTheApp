import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ensurePairForUser } from '@/lib/pairing';

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  process.env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
].filter(Boolean) as string[];

async function askGroq(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not configured in Vercel settings.');
  }

  let lastError: Error | null = null;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.9,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Model ${model} returned HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error(`Empty response from Groq API using ${model}`);
      }

      return JSON.parse(rawContent);
    } catch (err: any) {
      console.warn(`Attempt with Groq model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Groq AI models failed');
}

function buildPrompt() {
  const month = new Date().toLocaleString('en-US', { month: 'long' });
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return `You write dynamic daily content for "U&", a private app for couples and close friends.
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
- No markdown, no backticks, just the JSON object.`;
}

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    const pair = await ensurePairForUser(supabase, user.id);
    const today = new Date().toISOString().split('T')[0];

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error: 'GROQ_API_KEY is missing from Vercel environment variables. Please add GROQ_API_KEY in Vercel settings and redeploy.',
          requiresKey: true,
        },
        { status: 400 }
      );
    }

    // Use admin client if service role key exists to bypass any RLS locks
    const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdminClient()
      : supabase;

    const aiContent = await askGroq(buildPrompt());

    const sparkId = `s-${pair.id}-${today}-${Date.now().toString(36)}`;
    const sparkRow = {
      id: sparkId,
      pair_id: pair.id,
      date: today,
      question: aiContent.spark?.question || 'What is a small detail about me that you noticed recently?',
      category: aiContent.spark?.category || 'Connection & Joy',
      source: 'ai',
    };

    const { error: sparkErr } = await dbClient.from('spark_prompts').upsert(sparkRow);
    if (sparkErr) {
      console.error('Error saving spark prompt to Supabase:', sparkErr.message);
    }

    const fallbackImages: Record<string, string> = {
      food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
      movie: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
      plan: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
      travel: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
    };

    const cardRows = (aiContent.pick_cards ?? []).map((c: any, i: number) => {
      const deckKey = c.deck || 'food';
      return {
        id: `p-${pair.id}-${today}-${Date.now().toString(36)}-${i}`,
        pair_id: pair.id,
        date: today,
        deck: deckKey,
        title: c.title,
        description: c.description,
        tags: c.tags ?? ['AI Suggested'],
        image: c.image || fallbackImages[deckKey] || fallbackImages.food,
        source: 'ai',
      };
    });

    if (cardRows.length > 0) {
      const { error: cardsErr } = await dbClient.from('pick_cards').upsert(cardRows);
      if (cardsErr) {
        console.error('Error saving pick cards to Supabase:', cardsErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      spark: sparkRow,
      pick_cards: cardRows,
    });
  } catch (err: any) {
    console.error('Groq AI content generation error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate AI content' },
      { status: 500 }
    );
  }
}
