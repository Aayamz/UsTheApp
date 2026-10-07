'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Heart,
  Users,
  Copy,
  Share2,
  Check,
  Shield,
  EyeOff,
  ArrowRight,
  Lock,
  UserPlus,
} from 'lucide-react';

interface InviteHubProps {
  pairId: string;
  partnerInviteCode: string;
  friendInviteCode: string;
  hasPartner: boolean;
}

function useInviteUrl(code: string) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined' && code) {
      setUrl(`${window.location.origin}/join/${code}`);
    }
  }, [code]);
  return url;
}

function CopyShareButtons({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join me on U&! – ${label}`,
          text: `You've been invited! Tap to join:`,
          url,
        });
      } catch {}
    } else {
      await handleCopy();
    }
  };

  return (
    <div className="space-y-2 w-full">
      {/* URL display */}
      <div className="w-full rounded-xl bg-[#1F1324] border border-[#4F3C59] px-4 py-3 text-[11px] font-mono break-all text-[#FF8966] min-h-[44px] flex items-center">
        {url || 'Generating link…'}
      </div>

      <div className="flex gap-2 w-full">
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleShare}
            disabled={!url}
            className="flex-1 py-2.5 px-3 bg-[#FF8966] text-[#1F1324] hover:bg-[#FF8966]/90 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleCopy}
          disabled={!url}
          className="flex-1 py-2.5 px-3 bg-[#372A3E] border border-[#4F3C59] text-[#F6EFE9] hover:bg-[#4F3C59]/60 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied!
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

export default function InviteHub({
  pairId,
  partnerInviteCode,
  friendInviteCode,
  hasPartner,
}: InviteHubProps) {
  const router = useRouter();
  const partnerUrl = useInviteUrl(partnerInviteCode);
  const friendUrl = useInviteUrl(friendInviteCode);

  // Auto-detect when partner joins
  useEffect(() => {
    if (hasPartner) return; // Already has partner
    const channel = supabase
      .channel(`pair-${pairId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `id=eq.${pairId}` },
        (payload) => {
          if (payload.new.partner_id) {
            router.push('/');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pairId, hasPartner, router]);

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* ── PARTNER INVITE CARD ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl border border-[#FF8966]/40 bg-gradient-to-br from-[#372A3E] to-[#2A1F33] p-5 space-y-4 shadow-lg"
      >
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF8966]/8 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FF8966]/20 border border-[#FF8966]/40 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-[#FF8966]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[#F6EFE9] flex items-center gap-1.5">
              Partner Invite
              {hasPartner && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Connected ✓
                </span>
              )}
            </h2>
            <p className="text-xs text-[#C9B3D1] leading-relaxed mt-0.5">
              Your romantic partner only — creates your private couple bond.
            </p>
          </div>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 bg-[#1F1324]/60 border border-[#4F3C59] rounded-xl px-3 py-2">
          <Lock className="w-3.5 h-3.5 text-[#FF8966] shrink-0" />
          <p className="text-[11px] text-[#C9B3D1] leading-snug">
            <span className="text-[#F6EFE9] font-semibold">Strictly private</span> — only 2 people can join. Your entire Trail, Spark, Someday, Pick & Nudge space is shared only with them.
          </p>
        </div>

        {hasPartner ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-300 font-semibold">Your partner has joined your couple space!</span>
          </div>
        ) : (
          <>
            <CopyShareButtons url={partnerUrl} label="Partner Invite" />
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex items-center justify-center gap-1.5 text-[11px] text-[#F6EFE9]/50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF8966] animate-pulse" />
              Waiting for your partner to join…
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── FRIEND INVITE CARD ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="relative overflow-hidden rounded-3xl border border-[#4F3C59] bg-gradient-to-br from-[#2A1F33] to-[#1F1324] p-5 space-y-4 shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4F3C59]/60 border border-[#4F3C59] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#C9B3D1]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[#F6EFE9]">Friend Invite</h2>
            <p className="text-xs text-[#C9B3D1] leading-relaxed mt-0.5">
              For friends to join a separate shared space — not your couple space.
            </p>
          </div>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 bg-[#1F1324]/60 border border-[#4F3C59] rounded-xl px-3 py-2">
          <EyeOff className="w-3.5 h-3.5 text-[#C9B3D1] shrink-0" />
          <p className="text-[11px] text-[#C9B3D1] leading-snug">
            <span className="text-[#F6EFE9] font-semibold">Friends can&apos;t see</span> your Trail, Spark, Pick, Nudge, or private Someday capsules — they only access the shared friends group space.
          </p>
        </div>

        <CopyShareButtons url={friendUrl} label="Friend Invite" />
      </motion.div>

      {/* ── PRIVACY SUMMARY ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="flex items-start gap-3 bg-[#1F1324]/60 border border-[#4F3C59]/50 rounded-2xl p-4"
      >
        <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-[#F6EFE9]">100% Couple Privacy Guarantee</p>
          <p className="text-[11px] text-[#C9B3D1] leading-snug">
            Every space is database-level isolated. Invited friends are cryptographically prevented from accessing your couple&apos;s private data — even if they guess the URL.
          </p>
        </div>
      </motion.div>

      {/* Continue button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => router.push('/')}
        className="w-full py-3.5 bg-[#372A3E]/80 border border-[#4F3C59] text-[#F6EFE9] hover:bg-[#372A3E] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <span>Back to App</span>
        <ArrowRight className="w-4 h-4 text-[#FF8966]" />
      </motion.button>
    </div>
  );
}
