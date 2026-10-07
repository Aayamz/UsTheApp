'use client';

import { useEffect, useState } from 'react';
import motion from 'framer-motion';
import Link from 'next/link';
import Logo from '@/components/Logo';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import AddToHomeScreenPrompt from '@/components/pwa/AddToHomeScreenPrompt';
import { Heart, Users, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface JoinInviteViewProps {
  code: string;
  user: any | null;
  inviteType: 'partner' | 'friend' | 'invalid';
  joinStatus: 'not_authenticated' | 'joined_partner' | 'joined_friend' | 'already_partner' | 'already_friend' | 'partner_claimed' | 'failed' | 'invalid';
}

export default function JoinInviteView({
  code,
  user,
  inviteType,
  joinStatus,
}: JoinInviteViewProps) {
  const [hapticTriggered, setHapticTriggered] = useState(false);

  useEffect(() => {
    if (!hapticTriggered && (joinStatus === 'joined_partner' || joinStatus === 'joined_friend')) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 60, 40]);
      }
      setHapticTriggered(true);
    }
  }, [joinStatus, hapticTriggered]);

  const isPartner = inviteType === 'partner';
  const isFriend = inviteType === 'friend';

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center px-6 py-10 bg-[#1F1324] text-[#F6EFE9] overflow-y-auto">
      <div className="w-full max-w-md space-y-6 flex flex-col items-center text-center">

        {/* ── LOGO ────────────────────────────────────────── */}
        <Logo size={48} showWordmark />

        {/* ── STATE 1: UNAUTHENTICATED (NEED SIGN IN) ──────── */}
        {!user && (
          <div className="w-full space-y-5">
            {/* Header info */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#372A3E] border border-[#4F3C59] text-xs font-semibold text-[#FF8966]">
                {isFriend ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-[#FF8966]" /> Friend Group Invite
                  </>
                ) : (
                  <>
                    <Heart className="w-3.5 h-3.5 text-[#FF8966]" /> Private Couple Invite
                  </>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isFriend ? "You've been invited to a Friend Space!" : "You've been invited to U&!"}
              </h1>
              <p className="text-sm text-[#C9B3D1] max-w-xs mx-auto leading-relaxed">
                {isFriend
                  ? 'Join to view shared group event capsules and group moments.'
                  : 'Connect with your partner in a private space for just the two of you.'}
              </p>
            </div>

            {/* 1. Add to Home Screen Prompt Banner */}
            <AddToHomeScreenPrompt
              title="Step 1: Add U& to Home Screen"
              subtitle="Install our app for the best experience, instant opening, and home screen access."
            />

            {/* 2. Sign In Action */}
            <div className="bg-[#372A3E]/60 border border-[#4F3C59] rounded-3xl p-5 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#FF8966] text-[#1F1324] font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="text-sm font-bold text-[#F6EFE9]">Sign in to Accept Invite</h3>
              </div>
              <p className="text-xs text-[#C9B3D1] leading-relaxed">
                Continue with Google to accept your invite and enter your space.
              </p>
              <div className="pt-2">
                <GoogleSignInButton next={`/join/${code}`} inviteCode={code} />
              </div>
            </div>

            {/* Privacy note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#C9B3D1]/70">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Private & Isolated Space Guarantee</span>
            </div>
          </div>
        )}

        {/* ── STATE 2: JOINED AS PARTNER SUCCESS ────────────── */}
        {user && (joinStatus === 'joined_partner' || joinStatus === 'already_partner') && (
          <div className="w-full space-y-5">
            <div className="space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Heart className="w-8 h-8 fill-emerald-400 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                {joinStatus === 'joined_partner' ? 'Couple Space Connected! 💕' : 'You are Connected! 💕'}
              </h1>
              <p className="text-sm text-[#C9B3D1] max-w-xs mx-auto leading-relaxed">
                Your private couple bond is active. Your Trail, Spark, Pick, Someday, and Nudge spaces are now shared.
              </p>
            </div>

            {/* Add to Home Screen Prompt Card */}
            <AddToHomeScreenPrompt
              title="Add U& to Home Screen"
              subtitle="Quick tip: Add U& to your home screen so you can launch your couple space with one tap!"
            />

            {/* Continue to app CTA */}
            <Link
              href="/"
              className="w-full py-4 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all hover:bg-[#FF8966]/90 shadow-lg shadow-[#FF8966]/20 cursor-pointer"
            >
              <span>Enter Couple Space</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ── STATE 3: JOINED AS FRIEND SUCCESS ─────────────── */}
        {user && (joinStatus === 'joined_friend' || joinStatus === 'already_friend') && (
          <div className="w-full space-y-5">
            <div className="space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Users className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">You&apos;re in! 🎉</h1>
              <p className="text-sm text-[#C9B3D1] max-w-xs mx-auto leading-relaxed">
                You&apos;ve joined the friend space! You can view group event capsules and group moments.
              </p>
            </div>

            {/* Add to Home Screen Prompt Card */}
            <AddToHomeScreenPrompt
              title="Add U& to Home Screen"
              subtitle="Add U& to your home screen to easily check shared group capsules anytime."
            />

            {/* Continue to Friend Space CTA */}
            <Link
              href="/friend-space"
              className="w-full py-4 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all hover:bg-[#FF8966]/90 shadow-lg shadow-[#FF8966]/20 cursor-pointer"
            >
              <span>Go to Friend Space</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ── STATE 4: PARTNER SLOT CLAIMED ─────────────────── */}
        {user && joinStatus === 'partner_claimed' && (
          <div className="w-full space-y-5">
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <AlertCircle className="w-7 h-7 text-amber-400" />
              </div>
              <h1 className="text-xl font-bold">This partner invite is already claimed</h1>
              <p className="text-sm text-[#C9B3D1] max-w-xs mx-auto leading-relaxed">
                This couple space already has two partners connected. Ask your friend for their friend invite link instead!
              </p>
            </div>

            <AddToHomeScreenPrompt />

            <Link
              href="/"
              className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2"
            >
              Go to Home App
            </Link>
          </div>
        )}

        {/* ── STATE 5: INVALID OR FAILED ────────────────────── */}
        {user && (joinStatus === 'invalid' || joinStatus === 'failed') && (
          <div className="w-full space-y-5">
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <h1 className="text-xl font-bold">This invite link is invalid</h1>
              <p className="text-sm text-[#C9B3D1] max-w-xs mx-auto leading-relaxed">
                Please ask your partner or friend for a fresh invite link.
              </p>
            </div>

            <AddToHomeScreenPrompt />

            <Link
              href="/"
              className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2"
            >
              Go to Home
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
