'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfileInfo } from './TopHeaderBar';
import { Haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  X, 
  Crown, 
  Heart, 
  Users, 
  LogOut, 
  ShieldCheck, 
  Check, 
  UserCheck, 
  Sparkles,
  Radio
} from 'lucide-react';

export interface GroupSpace {
  id: string;
  name: string;
  type: 'couple' | 'group';
  memberCount: number;
}

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfileInfo;
  activeSpace: GroupSpace;
  allSpaces: GroupSpace[];
  onSelectSpace: (space: GroupSpace) => void;
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  currentUser,
  activeSpace,
  allSpaces,
  onSelectSpace,
}: ProfileDrawerProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    Haptics.lightTap();
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Mock list of connected users in the active space with real presence status
  const connectedMembers = [
    {
      id: 'm-1',
      name: currentUser.name + ' (You)',
      role: currentUser.role,
      roleLabel: currentUser.role === 'creator' ? 'Creator / Admin 👑' : 'Partner 💖',
      isOnline: true,
      avatar: currentUser.avatar,
    },
    {
      id: 'm-2',
      name: 'Alex',
      role: 'partner',
      roleLabel: 'Beloved Partner 💖',
      isOnline: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'm-3',
      name: 'Maya',
      role: 'friend',
      roleLabel: 'Event Friend 👥',
      isOnline: false,
      lastSeen: '12m ago',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#1F1324]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6"
          >
            {/* Header close */}
            <div className="flex items-center justify-between border-b border-[#4F3C59] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-[#F6EFE9]">U& Account & Group</span>
              </div>
              <button
                onClick={() => {
                  Haptics.lightTap();
                  onClose();
                }}
                className="p-1 rounded-full text-[#C9B3D1] hover:text-[#F6EFE9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Currently Logged In User Card */}
            <div className="bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#FF8966]/20 border border-[#FF8966]/50 flex items-center justify-center text-lg font-bold text-[#F6EFE9] overflow-hidden">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#1F1324]" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#F6EFE9] flex items-center gap-1.5">
                    {currentUser.name}
                    {currentUser.role === 'creator' ? (
                      <Crown className="w-4 h-4 text-[#FF8966]" />
                    ) : (
                      <Heart className="w-4 h-4 text-[#FF8966]" />
                    )}
                  </h3>
                  <p className="text-xs text-[#C9B3D1]">{currentUser.email}</p>
                  
                  {/* Role Badge */}
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF8966] bg-[#FF8966]/15 px-2 py-0.5 rounded-full border border-[#FF8966]/30 mt-1">
                    <ShieldCheck className="w-3 h-3" />
                    {currentUser.roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Group / Space Switcher */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#C9B3D1] uppercase tracking-wider block mb-1">
                Active Group Space
              </span>

              <div className="space-y-2">
                {allSpaces.map((space) => {
                  const isSelected = activeSpace.id === space.id;
                  return (
                    <button
                      key={space.id}
                      onClick={() => {
                        Haptics.lightTap();
                        onSelectSpace(space);
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF8966]/15 border-[#FF8966] text-[#F6EFE9]'
                          : 'bg-[#1F1324] border-[#4F3C59] text-[#C9B3D1] hover:border-[#FF8966]/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {space.type === 'couple' ? (
                          <Heart className="w-4 h-4 text-[#FF8966]" />
                        ) : (
                          <Users className="w-4 h-4 text-[#FF8966]" />
                        )}
                        <div>
                          <span className="text-sm font-bold text-[#F6EFE9] block">{space.name}</span>
                          <span className="text-[10px] text-[#C9B3D1]">
                            {space.type === 'couple' ? 'Private Couple Space' : `Group Event • ${space.memberCount} members`}
                          </span>
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-[#FF8966]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Presence List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#C9B3D1] uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  Currently Connected Members
                </span>
                <span className="text-[10px] text-[#FF8966] font-semibold">2 Online</span>
              </div>

              <div className="space-y-2">
                {connectedMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-[#1F1324] border border-[#4F3C59] rounded-2xl text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full object-cover border border-[#4F3C59]" />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1F1324] ${
                            m.isOnline ? 'bg-emerald-500' : 'bg-gray-500'
                          }`}
                        />
                      </div>
                      <div>
                        <span className="font-bold text-[#F6EFE9] block">{m.name}</span>
                        <span className="text-[10px] text-[#C9B3D1]">{m.roleLabel}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {m.isOnline ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Active Now
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#C9B3D1]/60">{m.lastSeen}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Identifiers Explanation Box */}
            <div className="p-4 bg-[#1F1324]/80 border border-[#4F3C59] rounded-2xl text-xs space-y-2">
              <span className="font-bold text-[#FF8966] block">Space Roles & Identifiers:</span>
              <ul className="space-y-1 text-[#C9B3D1] text-[11px] leading-relaxed">
                <li>👑 <strong>Creator / Admin:</strong> Created the app space and invite link.</li>
                <li>💖 <strong>Partner:</strong> Loved one with full shared access to Trail, Spark, Pick & Nudges.</li>
                <li>👥 <strong>Group Friends:</strong> Invited friends connected to specific Someday event capsules.</li>
              </ul>
            </div>

            {/* Logout / Switch Account Button */}
            <button
              onClick={handleSignOut}
              disabled={loggingOut}
              className="w-full py-3.5 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/40 text-red-300 font-bold text-xs rounded-2xl hover:bg-red-500/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out / Switch Account'}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
