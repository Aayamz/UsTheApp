import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ensurePairForUser } from '@/lib/pairing';
import { generateDailyContent } from '@/lib/ai-generator';

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

    // Use admin client if service role key exists to bypass any RLS locks
    const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdminClient()
      : supabase;

    const aiContent = await generateDailyContent();

    const sparkId = `s-${pair.id}-${today}-${Date.now().toString(36)}`;
    const sparkRow = {
      id: sparkId,
      pair_id: pair.id,
      date: today,
      question: aiContent.spark?.question || 'What is a small detail about me that you noticed recently?',
      category: aiContent.spark?.category || 'Connection & Joy',
      source: aiContent.source,
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
        source: aiContent.source,
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
      source: aiContent.source,
    });
  } catch (err: any) {
    console.error('Daily content generation error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate content' },
      { status: 500 }
    );
  }
}
