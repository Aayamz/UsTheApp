import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import FriendSpaceView from '@/components/friend/FriendSpaceView';

export const dynamic = 'force-dynamic';

export default async function FriendSpacePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let friendSpaceId = '';
  let spaceName = 'Friends Group';
  let coupleNames = '';
  let members: { id: string; display_name: string | null; added_at: string }[] = [];

  try {
    // 1. Fetch space details via RPC (bypasses strict RLS)
    const { data: detailsJson } = await supabase.rpc('get_friend_space_details', {
      p_user_id: user.id,
    });

    if (detailsJson) {
      friendSpaceId = detailsJson.friend_space_id;
      spaceName = detailsJson.name || 'Friends Group';

      const cName = detailsJson.creator_name;
      const pName = detailsJson.partner_name;
      if (cName && pName) {
        coupleNames = `${cName} & ${pName}`;
      } else if (cName) {
        coupleNames = cName;
      }
    }

    // Fallback: If RPC not yet applied, query friend_space_members directly
    if (!friendSpaceId) {
      const { data: memberRows } = await supabase
        .from('friend_space_members')
        .select('friend_space_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberRows && memberRows.length > 0) {
        friendSpaceId = memberRows[0].friend_space_id;
      }
    }

    // 2. Fetch space members
    if (friendSpaceId) {
      const { data: memberList } = await supabase
        .from('friend_space_members')
        .select('id, display_name, added_at')
        .eq('friend_space_id', friendSpaceId);

      members = memberList || [];
    }
  } catch (err) {
    console.error('Error fetching friend space page:', err);
  }

  // If user is not in any friend space, redirect to invite page
  if (!friendSpaceId) {
    redirect('/invite');
  }

  return (
    <FriendSpaceView
      friendSpaceId={friendSpaceId}
      spaceName={spaceName}
      coupleNames={coupleNames}
      members={members}
      currentUserId={user.id}
    />
  );
}
