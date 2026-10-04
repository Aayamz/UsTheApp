'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Haptics } from '@/lib/haptics';
import { 
  Sparkles, 
  Flame, 
  Lock, 
  Layers, 
  HeartHandshake 
} from 'lucide-react';

export type TabType = 'trail' | 'spark' | 'someday' | 'pick' | 'nudge';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const TABS: TabConfig[] = [
  { id: 'trail', label: 'Trail', icon: Sparkles },
  { id: 'spark', label: 'Spark', icon: Flame, badge: 'Daily' },
  { id: 'someday', label: 'Someday', icon: Lock },
  { id: 'pick', label: 'Pick', icon: Layers },
  { id: 'nudge', label: 'Nudge', icon: HeartHandshake },
];

interface BottomTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const handleTabClick = (tabId: TabType) => {
    if (tabId === activeTab) return;
    Haptics.lightTap();

    // Use View Transitions API if supported per AGENTS.md
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        onTabChange(tabId);
      });
    } else {
      onTabChange(tabId);
    }
  };

  return (
    <nav 
      aria-label="Bottom tab navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#1F1324]/95 backdrop-blur-md border-t border-[#4F3C59]/60 safe-pb px-3 pt-2"
    >
      <div className="max-w-md mx-auto flex items-center justify-between relative">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="relative flex-1 flex flex-col items-center justify-center py-2 group cursor-pointer focus:outline-none"
            >
              {/* Active animated pill background */}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-x-1 top-0 bottom-0 bg-[#372A3E] rounded-2xl border border-[#FF8966]/30 -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}

              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-6 h-6 transition-all duration-200 ${
                    isActive 
                      ? 'text-[#FF8966] scale-110 drop-shadow-[0_0_8px_rgba(255,137,102,0.4)]' 
                      : 'text-[#C9B3D1]/70 group-hover:text-[#F6EFE9]'
                  }`}
                />
                
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.5 text-[9px] font-bold bg-[#FF8966] text-[#1F1324] rounded-full animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] font-medium tracking-tight mt-1 transition-colors duration-200 ${
                  isActive ? 'text-[#F6EFE9] font-bold' : 'text-[#C9B3D1]/60'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
