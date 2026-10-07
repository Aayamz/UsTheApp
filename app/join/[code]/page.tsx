import { createSupabaseServerClient } from '@/lib/supabase-server';
import { detectInviteType, joinPairByCode, joinAsFriend } from '@/lib/pairing';
import JoinInviteView from '@/components/auth/JoinInviteView';

export const dynamic = 'force-dynamic';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Detect invite type before requiring login so we can show correct UI
  const inviteType = await detectInviteType(supabase, code);

  let joinStatus:
    | 'not_authenticated'
    | 'joined_partner'
    | 'joined_friend'
    | 'already_partner'
    | 'already_friend'
    | 'partner_claimed'
    | 'failed'
    | 'invalid' = 'not_authenticated';

  if (!user) {
    joinStatus = 'not_authenticated';
  } else if (inviteType.type === 'partner') {
    const pair = inviteType.pair;
    if (pair?.created_by === user.id || pair?.partner_id === user.id) {
      joinStatus = 'already_partner';
    } else if (pair?.partner_id && pair.partner_id !== user.id) {
      joinStatus = 'partner_claimed';
    } else {
      const joinResult = await joinPairByCode(supabase, code, user.id);
      if (joinResult) {
        joinStatus = 'joined_partner';
      } else {
        joinStatus = 'failed';
      }
    }
  } else if (inviteType.type === 'friend') {
    const pair = inviteType.pair;
    if (pair?.created_by === user.id || pair?.partner_id === user.id) {
      joinStatus = 'already_friend';
    } else {
      const joinResult = await joinAsFriend(supabase, code, user.id);
      if (joinResult) {
        joinStatus = 'joined_friend';
      } else {
        joinStatus = 'failed';
      }
    }
  } else {
    joinStatus = 'invalid';
  }

  return (
    <JoinInviteView
      code={code}
      user={user}
      inviteType={inviteType.type}
      joinStatus={joinStatus}
    />
  );
}
