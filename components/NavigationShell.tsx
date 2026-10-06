'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomTabBar, { TabType } from './BottomTabBar';
import TopHeaderBar, { UserProfileInfo } from './TopHeaderBar';
import ProfileDrawer, { GroupSpace } from './ProfileDrawer';
import TrailTab from './tabs/TrailTab';
import SparkTab from './tabs/SparkTab';
import SomedayTab from './tabs/SomedayTab';
import PickTab from './tabs/PickTab';
import NudgeTab from './tabs/NudgeTab';
import { seedInitialDataIfEmpty, NudgeRecord } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { joinPairByCode } from '@/lib/pairing';
import { startGlobalPairSync } from '@/lib/pairSync';
import { Bell } from 'lucide-react';

export default function NavigationShell() {
  const [activeTab, setActiveTab] = useState<TabType>('trail');
  const [profileOpen, setProfileOpen] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<NudgeRecord | null>(null);

  const [spaces, setSpaces] = useState<GroupSpace[]>([
    { id: 'g-1', name: '💕 Couple Space: You & Partner', type: 'couple', memberCount: 2 },
    { id: 'g-2', name: '🎉 Group Event Capsules', type: 'group', memberCount: 1 },
  ]);
  const [activeSpace, setActiveSpace] = useState<GroupSpace>(spaces[0]);

  const [currentUser, setCurrentUser] = useState<UserProfileInfo>({
    name: 'You',
    email: 'user@u-and-me.app',
    avatar: '',
    role: 'creator',
    roleLabel: 'Creator / Admin 👑',
    isOnline: true,
  });

  useEffect(() => {
    seedInitialDataIfEmpty().catch((err) => console.log('Database seed skipped:', err));

    // Start global persistent Realtime synchronization for active pair
    let cleanupSync: (() => void) | undefined;
    startGlobalPairSync((nudge) => {
      setNudgeToast(nudge);
      setTimeout(() => setNudgeToast(null), 4000);
    }).then((unsub) => {
      cleanupSync = unsub;
    });

    // Fetch user and partner from Supabase Auth & DB
    const fetchUserData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      // Auto-claim pending invite if user logged in via invite link
      if (typeof window !== 'undefined') {
        let pendingCode = localStorage.getItem('pending_invite_code');
        if (!pendingCode) {
          const match = document.cookie.match(/(?:^|; )pending_invite_code=([^;]*)/);
          if (match) pendingCode = decodeURIComponent(match[1]);
        }

        if (pendingCode) {
          try {
            await joinPairByCode(supabase, pendingCode, authData.user.id);
            localStorage.removeItem('pending_invite_code');
            document.cookie = 'pending_invite_code=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          } catch (e) {
            console.error('Error auto-claiming pending invite:', e);
          }
        }
      }

      const email = authData.user.email || 'user@u-and-me.app';
      const displayName =
        authData.user.user_metadata?.full_name ||
        authData.user.user_metadata?.name ||
        email.split('@')[0];
      const avatarUrl = authData.user.user_metadata?.avatar_url || '';

      // 1. Fetch own pairs
      const { data: ownPairs } = await supabase
        .from('pairs')
        .select('id, created_by, partner_id, invite_code')
        .or(`created_by.eq.${authData.user.id},partner_id.eq.${authData.user.id}`);

      // 2. Fetch joined friend spaces
      const { data: memberRows } = await supabase
        .from('space_members')
        .select('space_id')
        .eq('user_id', authData.user.id);

      let joinedPairs: any[] = [];
      if (memberRows && memberRows.length > 0) {
        const spaceIds = memberRows.map((m) => m.space_id);
        const { data: friendPairsData } = await supabase
          .from('pairs')
          .select('id, created_by, partner_id, invite_code')
          .in('id', spaceIds);
        if (friendPairsData) joinedPairs = friendPairsData;
      }

      // Combine into unique pair list
      const pairMap = new Map<string, any>();
      (ownPairs || []).forEach((p) => pairMap.set(p.id, p));
      joinedPairs.forEach((p) => pairMap.set(p.id, p));
      let allPairs = Array.from(pairMap.values());

      if (allPairs.length === 0) {
        const { ensurePairForUser } = await import('@/lib/pairing');
        const createdPair = await ensurePairForUser(supabase, authData.user.id);
        if (createdPair) allPairs = [createdPair];
      }

      // Filter out duplicate empty standalone pairs if user has a partnered/joined space
      const populatedPairs = allPairs.filter(
        (p) => p.partner_id !== null || p.created_by !== authData.user.id
      );
      const activePairsList = populatedPairs.length > 0 ? populatedPairs : [allPairs[0]];

      // Get user profile to check active pair_id preference
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('pair_id')
        .eq('id', authData.user.id)
        .maybeSingle();

      // Build GroupSpace items for each active pair
      const spaceItems: GroupSpace[] = [];
      for (const pair of activePairsList) {
        const { data: friendMembers } = await supabase
          .from('space_members')
          .select('user_id')
          .eq('space_id', pair.id)
          .eq('role', 'friend');

        const friendUserIds = (friendMembers || []).map((fm) => fm.user_id);
        const hasFriendMembers = friendUserIds.length > 0;

        const memberIds = new Set<string>();
        if (pair.created_by) memberIds.add(pair.created_by);
        if (pair.partner_id) memberIds.add(pair.partner_id);
        friendUserIds.forEach((id) => memberIds.add(id));

        const memberIdArray = Array.from(memberIds);
        const { data: memberProfiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', memberIdArray);

        const namesMap = new Map<string, string>();
        (memberProfiles || []).forEach((p) => {
          if (p.display_name) namesMap.set(p.id, p.display_name);
        });

        const names = memberIdArray.map((id) =>
          id === authData.user.id ? displayName : namesMap.get(id) || 'Member'
        );

        let spaceName = '';
        let spaceType: 'couple' | 'group' = 'couple';

        if (hasFriendMembers || memberIdArray.length >= 3) {
          spaceType = 'group';
          spaceName = `🎉 Friends Space: ${names.join(', ')}`;
        } else if (memberIdArray.length === 2) {
          spaceType = 'couple';
          spaceName = `💕 Couple Space: ${names.join(' & ')}`;
        } else {
          spaceType = 'couple';
          spaceName = `💕 Private Space: ${displayName}`;
        }

        spaceItems.push({
          id: pair.id,
          name: spaceName,
          type: spaceType,
          memberCount: memberIdArray.length,
        });
      }

      setSpaces(spaceItems);

      // Determine active space (preserve existing selection if valid)
      let activeItem: GroupSpace | undefined;
      setActiveSpace((prevActive) => {
        activeItem = spaceItems.find((s) => s.id === prevActive?.id);
        if (!activeItem && userProfile?.pair_id) {
          activeItem = spaceItems.find((s) => s.id === userProfile.pair_id);
        }
        if (!activeItem) {
          activeItem = spaceItems[0];
        }
        return activeItem;
      });

      // Determine user role in active space
      const targetActiveId = activeItem?.id || userProfile?.pair_id || activePairsList[0]?.id;
      const activePairObj = activePairsList.find((p) => p.id === targetActiveId);
      let role: 'creator' | 'partner' | 'friend' = 'creator';
      let roleLabel = 'Creator / Admin 👑';

      if (activePairObj) {
        if (activePairObj.created_by === authData.user.id) {
          role = 'creator';
          roleLabel = 'Creator / Admin 👑';
        } else if (activePairObj.partner_id === authData.user.id) {
          role = 'partner';
          roleLabel = 'Partner 💖';
        } else {
          role = 'friend';
          roleLabel = 'Friend Member 🥳';
        }
      }

      setCurrentUser({
        name: displayName,
        email,
        avatar: avatarUrl,
        role,
        roleLabel,
        isOnline: true,
      });
    };

    fetchUserData().catch((e) => console.log('Error fetching user data:', e));

    const interval = setInterval(() => {
      fetchUserData().catch(() => {});
    }, 4000);

    return () => {
      clearInterval(interval);
      if (cleanupSync) cleanupSync();
    };
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'trail':
        return <TrailTab key="trail" />;
      case 'spark':
        return <SparkTab key="spark" />;
      case 'someday':
        return <SomedayTab key="someday" />;
      case 'pick':
        return <PickTab key="pick" />;
      case 'nudge':
        return <NudgeTab key="nudge" />;
      default:
        return <TrailTab key="trail" />;
    }
  };

  return (
    <div className="relative h-full w-full bg-[#1F1324] text-[#F6EFE9] flex flex-col justify-between overflow-hidden">
      {/* Top Header Bar */}
      <TopHeaderBar
        user={currentUser}
        activeSpaceName={activeSpace.name}
        onlineCount={activeSpace.memberCount}
        onOpenProfile={() => setProfileOpen(true)}
      />

      {/* Floating Incoming Nudge Toast Banner */}
      <AnimatePresence>
        {nudgeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-16 left-4 right-4 z-50 max-w-md mx-auto bg-gradient-to-r from-[#FF8966] to-[#E56F4A] text-[#1F1324] px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-[#FFF0E6]/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">{nudgeToast.emoji}</span>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#1F1324]/80">Nudge Received</span>
                <p className="text-xs font-bold text-[#1F1324] leading-tight">
                  {nudgeToast.sender}: {nudgeToast.label}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('nudge');
                setNudgeToast(null);
              }}
              className="px-3 py-1 bg-[#1F1324] text-[#F6EFE9] text-[11px] font-bold rounded-full shadow hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              View
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Tab View Container */}
      <main className="flex-1 relative w-full h-full overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 w-full h-full flex flex-col overflow-hidden"
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Navigation Bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Profile & Group Drawer Modal */}
      <ProfileDrawer
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={currentUser}
        activeSpace={activeSpace}
        allSpaces={spaces}
        onSelectSpace={async (space) => {
          setActiveSpace(space);
          setProfileOpen(false);
          const { data: authData } = await supabase.auth.getUser();
          if (authData.user) {
            await supabase.from('profiles').upsert({
              id: authData.user.id,
              pair_id: space.id,
            });
            startGlobalPairSync().catch(() => {});
          }
        }}
      />
    </div>
  );
}
