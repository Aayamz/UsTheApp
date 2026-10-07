import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import Logo from '@/components/Logo';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FriendSpacePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check if user is in any friend space
  let friendSpace = null;
  let members: { id: string; display_name: string | null; added_at: string }[] = [];

  try {
    const { data: memberRows } = await supabase
      .from('friend_space_members')
      .select('friend_space_id, display_name, added_at')
      .eq('user_id', user.id)
      .limit(1);

    if (memberRows && memberRows.length > 0) {
      const fsId = memberRows[0].friend_space_id;

      // Fetch space details
      const { data: fsData } = await supabase
        .from('friend_spaces')
        .select('id, name, created_at')
        .eq('id', fsId)
        .single();

      friendSpace = fsData;

      // Fetch co-members
      const { data: allMembers } = await supabase
        .from('friend_space_members')
        .select('id, display_name, added_at')
        .eq('friend_space_id', fsId);

      members = allMembers || [];
    }
  } catch (err) {
    console.error('Error loading friend space:', err);
  }

  // If user isn't in any friend space, redirect to invite page
  if (!friendSpace && members.length === 0) {
    redirect('/invite');
  }

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-start gap-6 px-6 py-10 bg-[#1F1324] text-[#F6EFE9] overflow-y-auto">
      <Logo size={44} showWordmark />

      {/* Header */}
      <div className="text-center space-y-1.5 max-w-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF8966]/15 border border-[#FF8966]/30 text-[#FF8966] text-xs font-semibold">
          <span>👥</span> Friend Space
        </div>
        <h1 className="text-2xl font-bold text-[#F6EFE9]">
          {friendSpace?.name || 'Friends Group'}
        </h1>
        <p className="text-sm text-[#C9B3D1] leading-relaxed">
          You are a connected friend in this space.
        </p>
      </div>

      {/* Isolation Info Card */}
      <div className="w-full max-w-xs bg-[#372A3E] border border-[#4F3C59] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-[#F6EFE9] flex items-center gap-2">
          🔒 Privacy Protection
        </h2>
        <p className="text-xs text-[#C9B3D1] leading-relaxed">
          The couple’s private scrapbook (Trail), daily prompts (Spark), decision swipe deck (Pick), and instant nudges are strictly private to the couple.
        </p>
      </div>

      {/* Members List */}
      <div className="w-full max-w-xs bg-[#372A3E] border border-[#4F3C59] rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-semibold text-[#C9B3D1] uppercase tracking-wider">
          Members ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1F1324]/50 border border-[#4F3C59]/50 text-xs text-[#F6EFE9]"
            >
              <div className="w-8 h-8 rounded-full bg-[#FF8966]/20 border border-[#FF8966]/40 flex items-center justify-center font-bold text-[#FF8966]">
                {(m.display_name?.[0] || 'F').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {m.display_name || 'Friend'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="w-full max-w-xs space-y-3 pt-2">
        <form action="/invite/create" method="POST" className="w-full">
          <button
            type="submit"
            className="w-full py-3.5 bg-[#FF8966] hover:bg-[#FF8966]/90 text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#FF8966]/20"
          >
            💕 Create My Own Couple Space
          </button>
        </form>

        <Link
          href="/invite"
          className="w-full py-3 bg-[#372A3E] border border-[#4F3C59] hover:bg-[#4F3C59]/60 text-[#F6EFE9] text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all"
        >
          🔑 Join Another Space with a Code
        </Link>
      </div>
    </div>
  );
}
