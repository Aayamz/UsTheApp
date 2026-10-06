import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateDailyContent } from '@/lib/ai-generator';

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
      const content = await generateDailyContent();

      await supabase.from('spark_prompts').upsert({
        id: `s-${pair.id}-${today}`,
        pair_id: pair.id,
        date: today,
        question: content.spark.question,
        category: content.spark.category,
        source: content.source,
      });

      const fallbackImages: Record<string, string> = {
        food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
        movie: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
        plan: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        travel: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
      };

      const cardRows = (content.pick_cards ?? []).map((c: any, i: number) => ({
        id: `p-${pair.id}-${today}-${i}`,
        pair_id: pair.id,
        date: today,
        deck: c.deck || 'food',
        title: c.title,
        description: c.description,
        tags: c.tags ?? [],
        image: fallbackImages[c.deck || 'food'] || fallbackImages.food,
        source: content.source,
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
