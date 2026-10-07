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
  LogOut, 
  ShieldCheck, 
  Check, 
  Radio,
  UserPlus,
  Share2,
  Copy,
  Lock,
  Users,
  EyeOff,
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

interface MemberProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  roleLabel: string;
}

function InviteCard({
  label,
  sublabel,
  url,
  code,
  icon: Icon,
  accentColor,
  privacyNote,
}: {
  label: string;
  sublabel: string;
  url: string;
  code: string;
  icon: React.ElementType;
  accentColor: string;
  privacyNote: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!url) return;
    Haptics.lightTap();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!url) return;
    Haptics.lightTap();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Join me on U& – ${label}`, text: `You've been invited!`, url });
      } catch {}
    } else {
      await handleCopy();
    }
  };

  return (
    <div className="bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${accentColor}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#F6EFE9]">{label}</span>
            <p className="text-[10px] text-[#C9B3D1]">{sublabel}</p>
          </div>
        </div>
        {code && (
          <span className="text-[9px] font-mono bg-[#372A3E] text-[#F6EFE9] px-2 py-0.5 rounded-full border border-[#4F3C59]">
            {code}
          </span>
        )}
      </div>

      <p className="text-[10px] text-[#C9B3D1] leading-snug bg-[#372A3E]/60 rounded-xl px-2.5 py-2">
        {privacyNote}
      </p>

      <div className="flex gap-1.5">
        {typeof navigator !== 'undefined' && 'share' in navigator && url && (
          <button
            onClick={handleShare}
            className="flex-1 py-1.5 px-2.5 bg-[#FF8966] text-[#1F1324] hover:bg-[#FF8966]/90 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <Share2 className="w-3 h-3" />
            Share
          </button>
        )}
        <button
          onClick={handleCopy}
          disabled={!url}
          className="flex-1 py-1.5 px-2.5 bg-[#372A3E] border border-[#4F3C59] text-[#F6EFE9] hover:bg-[#4F3C59]/50 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#FF8966]" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  currentUser,
  activeSpace,
}: ProfileDrawerProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [connectedPartner, setConnectedPartner] = useState<MemberProfile | null>(null);
  const [partnerInviteCode, setPartnerInviteCode] = useState('');
  const [friendInviteCode, setFriendInviteCode] = useState('');
  const [partnerInviteUrl, setPartnerInviteUrl] = useState('');
  const [friendInviteUrl, setFriendInviteUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchProfileAndPair = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const targetPairId = activeSpace?.id;
      let pair: any = null;

      if (targetPairId && targetPairId !== 'g-1' && targetPairId !== 'g-2') {
        const { data: foundPair } = await supabase
          .from('pairs')
          .select('id, created_by, partner_id, invite_code, friend_invite_code')
          .eq('id', targetPairId)
          .maybeSingle();
        pair = foundPair;
      }

      if (!pair) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('pair_id')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (userProfile?.pair_id) {
          const { data: foundPair } = await supabase
            .from('pairs')
            .select('id, created_by, partner_id, invite_code, friend_invite_code')
            .eq('id', userProfile.pair_id)
            .maybeSingle();
          pair = foundPair;
        }
      }

      if (!pair) {
        const { data: userPairs } = await supabase
          .from('pairs')
          .select('id, created_by, partner_id, invite_code, friend_invite_code')
          .or(`created_by.eq.${userData.user.id},partner_id.eq.${userData.user.id}`)
          .order('created_at', { ascending: false });

        pair = userPairs?.[0] || null;
      }

      if (pair) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setPartnerInviteCode(pair.invite_code || '');
        setFriendInviteCode(pair.friend_invite_code || '');
        setPartnerInviteUrl(pair.invite_code ? `${origin}/join/${pair.invite_code}` : '');
        setFriendInviteUrl(pair.friend_invite_code ? `${origin}/join/${pair.friend_invite_code}` : '');

        // Fetch partner profile only (not friends)
        const partnerId =
          pair.created_by === userData.user.id ? pair.partner_id : pair.created_by;

        if (partnerId && partnerId !== userData.user.id) {
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', partnerId)
            .maybeSingle();

          if (partnerProfile) {
            setConnectedPartner({
              id: partnerProfile.id,
              displayName: partnerProfile.display_name || 'Partner',
              avatarUrl: partnerProfile.avatar_url,
              roleLabel: pair.created_by === partnerProfile.id ? 'Space Creator 👑' : 'Connected Partner 💖',
            });
          } else {
            setConnectedPartner(null);
          }
        } else {
          setConnectedPartner(null);
        }
      }
    };

    fetchProfileAndPair().catch((e) => console.log('Error fetching space details:', e));

    const interval = setInterval(() => {
      fetchProfileAndPair().catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, activeSpace]);

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
            className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl relative max-h-[88vh] overflow-y-auto pb-12 mb-14 sm:mb-0 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#4F3C59] pb-3">
              <div className="flex items-center gap-2">
                <Logo size={28} showWordmark />
                <span className="text-xs text-[#C9B3D1]">Account & Space</span>
              </div>
              <button
                onClick={() => { Haptics.lightTap(); onClose(); }}
                className="p-1 rounded-full text-[#C9B3D1] hover:text-[#F6EFE9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current User Card */}
            <div className="bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-4 flex items-center gap-3">
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
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF8966] bg-[#FF8966]/15 px-2 py-0.5 rounded-full border border-[#FF8966]/30 mt-1">
                  <ShieldCheck className="w-3 h-3" />
                  {currentUser.roleLabel}
                </span>
              </div>
            </div>

            {/* Private Space Badge */}
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#FF8966]/10 to-[#1F1324]/60 border border-[#FF8966]/30 rounded-2xl px-4 py-3">
              <Lock className="w-4 h-4 text-[#FF8966] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#F6EFE9]">{activeSpace.name}</p>
                <p className="text-[10px] text-[#C9B3D1]">
                  Private couple space · {activeSpace.memberCount === 2 ? 'Both partners connected ✓' : 'Waiting for partner…'}
                </p>
              </div>
            </div>

            {/* Partner Presence */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#C9B3D1] uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Connected Space Members
              </span>

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

                {/* Partner */}
                {connectedPartner ? (
                  <div className="flex items-center justify-between p-3 bg-[#1F1324] border border-[#4F3C59] rounded-2xl text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-[#FF8966]/20 flex items-center justify-center text-xs font-bold text-[#F6EFE9]">
                          {connectedPartner.avatarUrl ? (
                            <img src={connectedPartner.avatarUrl} alt={connectedPartner.displayName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            connectedPartner.displayName.charAt(0)
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1F1324]" />
                      </div>
                      <div>
                        <span className="font-bold text-[#F6EFE9] block">{connectedPartner.displayName}</span>
                        <span className="text-[10px] text-[#C9B3D1]">{connectedPartner.roleLabel}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Paired ❤️
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-[#1F1324]/50 border border-dashed border-[#4F3C59] rounded-2xl text-xs text-[#C9B3D1]">
                    <UserPlus className="w-4 h-4 text-[#FF8966]" />
                    <span>Invite your partner to connect…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invite Section (two separate cards) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#C9B3D1] uppercase tracking-wider">Invite Links</span>
                <button
                  onClick={() => { onClose(); router.push('/invite'); }}
                  className="text-[10px] font-bold text-[#FF8966] hover:underline cursor-pointer"
                >
                  Open Full Invite Page →
                </button>
              </div>

              {/* Partner invite */}
              <InviteCard
                label="Partner Invite"
                sublabel={connectedPartner ? 'Already connected ✓' : 'For your romantic partner only'}
                url={partnerInviteUrl}
                code={partnerInviteCode}
                icon={Heart}
                accentColor="bg-[#FF8966]/20 border border-[#FF8966]/40 text-[#FF8966]"
                privacyNote="🔒 Gives full access to your private couple space (Trail, Spark, Pick, Nudge, Someday). 2 partners max."
              />

              {/* Friend invite */}
              <InviteCard
                label="Friend Invite"
                sublabel="Separate space — friends cannot see your couple data"
                url={friendInviteUrl}
                code={friendInviteCode}
                icon={Users}
                accentColor="bg-[#4F3C59]/60 border border-[#4F3C59] text-[#C9B3D1]"
                privacyNote="👁️‍🗨️ Friends join a separate shared group space. They CANNOT see your Trail, Spark, Pick, Nudge, or private Someday capsules."
              />
            </div>

            {/* Logout Button */}
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
