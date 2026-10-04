'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Haptics } from '@/lib/haptics';
import { Users, Crown, Heart, ShieldCheck } from 'lucide-react';

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
  const getRoleIcon = () => {
    switch (user.role) {
      case 'creator':
        return <Crown className="w-3 h-3 text-[#FF8966]" />;
      case 'partner':
        return <Heart className="w-3 h-3 text-[#FF8966]" />;
      case 'friend':
        return <Users className="w-3 h-3 text-[#C9B3D1]" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#1F1324]/90 backdrop-blur-md border-b border-[#4F3C59]/50 px-4 py-2.5 flex items-center justify-between safe-pt max-w-md mx-auto w-full">
      {/* Brand Logotype: U in Ivory, & in Coral */}
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-xl tracking-tight">
          <span className="text-[#F6EFE9]">U</span>
          <span className="text-[#FF8966]">&</span>
        </span>

        {/* Active Group / Space Indicator Pill */}
        <button
          onClick={() => {
            Haptics.lightTap();
            onOpenProfile();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#372A3E] border border-[#4F3C59] rounded-full text-xs text-[#F6EFE9] hover:border-[#FF8966]/40 transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#FF8966] animate-pulse" />
          <span className="font-medium text-[11px] truncate max-w-[130px] sm:max-w-[170px]">
            {activeSpaceName}
          </span>
        </button>
      </div>

      {/* Right Side: Profile Avatar with Online Dot & Role Badge */}
      <div className="flex items-center gap-2">
        {/* Live Online Badge */}
        <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FF8966] bg-[#FF8966]/10 px-2 py-0.5 rounded-full border border-[#FF8966]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{onlineCount} Online</span>
        </div>

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
