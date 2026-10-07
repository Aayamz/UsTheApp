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
import { startGlobalPairSync } from '@/lib/pairSync';

export default function NavigationShell() {
  const [activeTab, setActiveTab] = useState<TabType>('trail');
  const [profileOpen, setProfileOpen] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<NudgeRecord | null>(null);

  // Couple space is the ONLY space - friends have their own separate space
  const [coupleSpace, setCoupleSpace] = useState<GroupSpace>({
    id: '',
    name: '💕 Your Private Space',
    type: 'couple',
    memberCount: 1,
  });

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

      const email = authData.user.email || 'user@u-and-me.app';
      const displayName =
        authData.user.user_metadata?.full_name ||
        authData.user.user_metadata?.name ||
        email.split('@')[0];
      const avatarUrl = authData.user.user_metadata?.avatar_url || '';

      // Fetch user's Couple Pair ONLY - no friend spaces in main shell
      const { ensurePairForUser } = await import('@/lib/pairing');
      const couplePair = await ensurePairForUser(supabase, authData.user.id);

      // Determine if user is creator or partner
      const isCreatorInCouple = couplePair.created_by === authData.user.id;
      const partnerId = isCreatorInCouple ? couplePair.partner_id : couplePair.created_by;

      // Find partner name
      let partnerName: string | null = null;
      if (partnerId && partnerId !== authData.user.id) {
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', partnerId)
          .maybeSingle();

        if (partnerProfile?.display_name) {
          partnerName = partnerProfile.display_name;
        }
      }

      // Build Private Couple Space (STRICTLY 2 members max)
      const coupleSpaceTitle = partnerName
        ? `💕 ${displayName} & ${partnerName}`
        : `💕 Your Private Space`;

      const updatedCoupleSpace: GroupSpace = {
        id: couplePair.id,
        name: coupleSpaceTitle,
        type: 'couple',
        memberCount: partnerName ? 2 : 1,
      };

      setCoupleSpace(updatedCoupleSpace);

      // Determine user role
      const role: 'creator' | 'partner' = isCreatorInCouple ? 'creator' : 'partner';
      const roleLabel = isCreatorInCouple ? 'Creator / Admin 👑' : 'Partner 💖';

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
    }, 8000);

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
        activeSpaceName={coupleSpace.name}
        onlineCount={coupleSpace.memberCount}
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

      {/* Profile & Invite Drawer Modal */}
      <ProfileDrawer
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={currentUser}
        activeSpace={coupleSpace}
        allSpaces={[coupleSpace]}
        onSelectSpace={() => {
          // Only one space (couple space) - no switching
          setProfileOpen(false);
        }}
      />
    </div>
  );
}
