'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Haptics } from '@/lib/haptics';
import Logo from '@/components/Logo';
import { Users, Crown, Heart, ShieldCheck, UserPlus } from 'lucide-react';

export interface UserProfileInfo {
  name: string;
  email: string;
  avatar: string;
  role: 'creator' | 'partner' | 'friend';
  roleLabel: string;
  isOnline: boolean;
}

interface TopHeaderBarProps {
  user: UserProfileInfo;
  activeSpaceName: string;
  onlineCount: number;
  onOpenProfile: () => void;
}

export default function TopHeaderBar({
  user,
  activeSpaceName,
  onlineCount,
  onOpenProfile,
}: TopHeaderBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#1F1324]/95 backdrop-blur-md border-b border-[#4F3C59]/50 px-4 py-2 flex items-center justify-between safe-pt max-w-md mx-auto w-full">
      {/* Brand Icon Logo */}
      <div className="flex items-center gap-2">
        <Logo size={32} />

        {/* Active Group / Space Indicator Pill */}
        <button
          onClick={() => {
            Haptics.lightTap();
            onOpenProfile();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#372A3E] border border-[#4F3C59] rounded-full text-xs text-[#F6EFE9] hover:border-[#FF8966]/40 transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#FF8966] animate-pulse" />
          <span className="font-medium text-[11px] truncate max-w-[110px] sm:max-w-[150px]">
            {activeSpaceName}
          </span>
        </button>
      </div>

      {/* Right Side: Quick Invite Button + Profile Avatar */}
      <div className="flex items-center gap-2">
        {/* Quick Invite Button */}
        <button
          onClick={() => {
            Haptics.lightTap();
            onOpenProfile();
          }}
          className="flex items-center gap-1 text-[11px] font-bold text-[#FF8966] bg-[#FF8966]/15 hover:bg-[#FF8966]/25 border border-[#FF8966]/40 px-2.5 py-1 rounded-full transition-all active:scale-95 cursor-pointer"
          title="Invite partner or friends"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite</span>
        </button>

        {/* Profile Avatar Button */}
        <button
          onClick={() => {
            Haptics.lightTap();
            onOpenProfile();
          }}
          className="relative p-0.5 rounded-full bg-gradient-to-tr from-[#FF8966] to-[#4F3C59] active:scale-95 transition-transform cursor-pointer"
          title={`${user.name} (${user.roleLabel})`}
        >
          <div className="w-8 h-8 rounded-full bg-[#1F1324] flex items-center justify-center text-sm font-bold text-[#F6EFE9] overflow-hidden border border-[#1F1324]">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          {/* Online green indicator dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1F1324]" />
        </button>
      </div>
    </header>
  );
}
