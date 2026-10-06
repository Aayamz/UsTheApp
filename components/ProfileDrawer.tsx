'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfileInfo } from './TopHeaderBar';
import { Haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { 
  X, 
  Crown, 
  Heart, 
  Users, 
  LogOut, 
  ShieldCheck, 
  Check, 
  Radio,
  UserPlus,
  Share2,
  Copy
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

interface PartnerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isOnline: boolean;
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
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Query partner profile & pair invite code from Supabase
    const fetchProfileAndPair = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('pair_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profile?.pair_id) {
        const { data: pair } = await supabase
          .from('pairs')
          .select('id, created_by, partner_id, invite_code')
          .eq('id', profile.pair_id)
          .maybeSingle();

        if (pair) {
          setInviteCode(pair.invite_code || '');

          const partnerId = pair.created_by === userData.user.id ? pair.partner_id : pair.created_by;
          if (partnerId) {
            const { data: partnerProfile } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', partnerId)
              .maybeSingle();

            setPartner({
              id: partnerId,
              displayName: partnerProfile?.display_name || 'Partner',
              avatarUrl: partnerProfile?.avatar_url,
              isOnline: true,
            });
          } else {
            setPartner(null);
          }
        }
      }
    };

    fetchProfileAndPair().catch((e) => console.log('Error fetching partner:', e));
  }, [isOpen]);

  const handleSignOut = async () => {
    Haptics.lightTap();
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error (navigating away regardless):', err);
    } finally {
      window.location.href = '/login';
    }
  };

  const inviteUrl = inviteCode && typeof window !== 'undefined'
    ? `${window.location.origin}/join/${inviteCode}`
    : '';

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    Haptics.lightTap();
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleShareLink = async () => {
    if (!inviteUrl) return;
    Haptics.lightTap();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on U&!',
          text: "Let's connect on U&! Tap the link to join me:",
          url: inviteUrl,
        });
      } catch (err) {
        // Share cancelled
      }
    } else {
      await handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-[#1F1324]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 safe-pb"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto pb-12 mb-14 sm:mb-0 space-y-6"
          >
            {/* Header close */}
            <div className="flex items-center justify-between border-b border-[#4F3C59] pb-3">
              <div className="flex items-center gap-2">
                <Logo size={28} showWordmark />
                <span className="text-xs text-[#C9B3D1]">Account & Group</span>
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

            {/* Invite Partner & Friends Card */}
            <div className="bg-[#1F1324] border border-[#FF8966]/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FF8966]">
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Partner & Friends</span>
                </div>
                {inviteCode && (
                  <span className="text-[10px] font-mono bg-[#372A3E] text-[#F6EFE9] px-2 py-0.5 rounded-full border border-[#4F3C59]">
                    Code: {inviteCode}
                  </span>
                )}
              </div>

              <p className="text-xs text-[#C9B3D1] leading-relaxed">
                Share this invite link with your partner or friends to pair up and connect instantly.
              </p>

              {inviteUrl && (
                <div className="flex items-center gap-2">
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={handleShareLink}
                      className="flex-1 py-2 px-3 bg-[#FF8966] text-[#1F1324] hover:bg-[#FF8966]/90 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  )}

                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2 px-3 bg-[#372A3E] border border-[#4F3C59] text-[#F6EFE9] hover:bg-[#4F3C59]/50 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#FF8966]" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              )}
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
                  Connected Space Members
                </span>
              </div>

              <div className="space-y-2">
                {/* You */}
                <div className="flex items-center justify-between p-3 bg-[#1F1324] border border-[#4F3C59] rounded-2xl text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-[#FF8966]/20 flex items-center justify-center text-xs font-bold text-[#F6EFE9]">
                        {currentUser.avatar ? (
                          <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          currentUser.name.charAt(0)
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1F1324]" />
                    </div>
                    <div>
                      <span className="font-bold text-[#F6EFE9] block">{currentUser.name} (You)</span>
                      <span className="text-[10px] text-[#C9B3D1]">{currentUser.roleLabel}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Active Now
                  </span>
                </div>

                {/* Partner / Friend */}
                {partner ? (
                  <div className="flex items-center justify-between p-3 bg-[#1F1324] border border-[#4F3C59] rounded-2xl text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-[#FF8966]/20 flex items-center justify-center text-xs font-bold text-[#F6EFE9]">
                          {partner.avatarUrl ? (
                            <img src={partner.avatarUrl} alt={partner.displayName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            partner.displayName.charAt(0)
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1F1324]" />
                      </div>
                      <div>
                        <span className="font-bold text-[#F6EFE9] block">{partner.displayName}</span>
                        <span className="text-[10px] text-[#C9B3D1]">Connected Member 💖</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Active Now
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-[#1F1324]/50 border border-dashed border-[#4F3C59] rounded-2xl text-xs text-[#C9B3D1]">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#FF8966]" />
                      <span>Waiting for partner or friends to join...</span>
                    </div>
                  </div>
                )}
              </div>
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
