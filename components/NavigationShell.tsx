'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomTabBar, { TabType } from './BottomTabBar';
import TrailTab from './tabs/TrailTab';
import SparkTab from './tabs/SparkTab';
import SomedayTab from './tabs/SomedayTab';
import PickTab from './tabs/PickTab';
import NudgeTab from './tabs/NudgeTab';
import { seedInitialDataIfEmpty } from '@/lib/db';

export default function NavigationShell() {
  const [activeTab, setActiveTab] = useState<TabType>('trail');

  useEffect(() => {
    // Seed initial IndexedDB cache on client mount for instant paint
    seedInitialDataIfEmpty().catch((err) => console.log('Database seed skipped:', err));
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
      {/* Dynamic Tab View Container with Framer Motion AnimatePresence */}
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

      {/* Fixed Bottom Navigation Bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
