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

const SAMPLE_SPACES: GroupSpace[] = [
  { id: 'g-1', name: '💕 Couple Space: You & Alex', type: 'couple', memberCount: 2 },
  { id: 'g-2', name: '🎉 Anniversary 2026 Group', type: 'group', memberCount: 5 },
];

export default function NavigationShell() {
  const [activeTab, setActiveTab] = useState<TabType>('trail');
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeSpace, setActiveSpace] = useState<GroupSpace>(SAMPLE_SPACES[0]);

  const [currentUser, setCurrentUser] = useState<UserProfileInfo>({
    name: 'You',
    email: 'creator@u-and-me.app',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    role: 'creator',
    roleLabel: 'Creator / Admin 👑',
    isOnline: true,
  });

  useEffect(() => {
    seedInitialDataIfEmpty().catch((err) => console.log('Database seed skipped:', err));

    // Fetch user from Supabase Auth if available
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const email = data.user.email || 'user@u-and-me.app';
        const displayName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0];
        const avatarUrl = data.user.user_metadata?.avatar_url || currentUser.avatar;

        setCurrentUser({
          name: displayName,
          email,
          avatar: avatarUrl,
          role: 'creator',
          roleLabel: 'Creator / Admin 👑',
          isOnline: true,
        });
      }
    });
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
        onlineCount={2}
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
        allSpaces={SAMPLE_SPACES}
        onSelectSpace={(space) => {
          setActiveSpace(space);
          setProfileOpen(false);
        }}
      />
    </div>
  );
}
