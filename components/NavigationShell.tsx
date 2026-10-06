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
import { seedInitialDataIfEmpty } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { joinPairByCode } from '@/lib/pairing';

export default function NavigationShell() {
  const [activeTab, setActiveTab] = useState<TabType>('trail');
  const [profileOpen, setProfileOpen] = useState(false);
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

      // Query pairs where user is creator or partner
      const { data: userPairs } = await supabase
        .from('pairs')
        .select('id, created_by, partner_id')
        .or(`created_by.eq.${authData.user.id},partner_id.eq.${authData.user.id}`)
        .order('created_at', { ascending: false });

      let partnerName: string | null = null;
      let isCreator = true;

      const activePair =
        userPairs?.find((p) => p.partner_id !== null) ||
        userPairs?.[0] ||
        null;

      if (activePair) {
        // Keep profile.pair_id synced to active pair
        await supabase
          .from('profiles')
          .update({ pair_id: activePair.id })
          .eq('id', authData.user.id);

        isCreator = activePair.created_by === authData.user.id;
        const partnerId = isCreator ? activePair.partner_id : activePair.created_by;

        if (partnerId && partnerId !== authData.user.id) {
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', partnerId)
            .maybeSingle();

          if (partnerProfile) {
            partnerName = partnerProfile.display_name || 'Partner';
          }
        }
      }

      setCurrentUser({
        name: displayName,
        email,
        avatar: avatarUrl,
        role: isCreator ? 'creator' : 'partner',
        roleLabel: isCreator ? 'Creator / Admin 👑' : 'Partner 💖',
        isOnline: true,
      });

      const spaceTitle = partnerName
        ? `💕 Couple Space: ${displayName} & ${partnerName}`
        : `💕 Private Space: ${displayName}`;

      const updatedSpaces: GroupSpace[] = [
        {
          id: 'g-1',
          name: spaceTitle,
          type: 'couple',
          memberCount: partnerName ? 2 : 1,
        },
        { id: 'g-2', name: '🎉 Group Event Capsules', type: 'group', memberCount: 1 },
      ];
      setSpaces(updatedSpaces);
      setActiveSpace(updatedSpaces[0]);
    };

    fetchUserData().catch((e) => console.log('Error fetching user data:', e));

    const interval = setInterval(() => {
      fetchUserData().catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
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
        onSelectSpace={(space) => {
          setActiveSpace(space);
          setProfileOpen(false);
        }}
      />
    </div>
  );
}
