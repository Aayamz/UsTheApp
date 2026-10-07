'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/Logo';
import { Lock, Send, Users, ShieldCheck, Heart, Sparkles, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Haptics } from '@/lib/haptics';

interface Member {
  id: string;
  display_name: string | null;
  added_at: string;
}

interface FriendSpaceViewProps {
  friendSpaceId: string;
  spaceName: string;
  coupleNames: string;
  members: Member[];
  currentUserId: string;
}

export default function FriendSpaceView({
  friendSpaceId,
  spaceName,
  coupleNames,
  members,
  currentUserId,
}: FriendSpaceViewProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [unlockDateStr, setUnlockDateStr] = useState('');
  const [eventName, setEventName] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSendWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSending(true);
    Haptics.lightTap();

    try {
      const unlockTarget = unlockDateStr
        ? new Date(unlockDateStr).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      const { error } = await supabase.rpc('send_friend_time_capsule', {
        p_friend_space_id: friendSpaceId,
        p_title: title.trim(),
        p_content: content.trim(),
        p_unlock_date: unlockTarget,
        p_event_name: eventName.trim() || 'Friend Wish',
      });

      if (error) throw error;

      Haptics.capsuleUnlock();
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        setShowSendModal(false);
        setTitle('');
        setContent('');
        setUnlockDateStr('');
        setEventName('');
      }, 2000);
    } catch (err) {
      console.error('Failed to send wish:', err);
      alert('Failed to send wish. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-start gap-6 px-6 py-8 bg-[#1F1324] text-[#F6EFE9] overflow-y-auto max-w-md mx-auto">
      {/* App Header */}
      <div className="w-full flex items-center justify-between border-b border-[#4F3C59]/40 pb-4">
        <Logo size={36} showWordmark />
        <button
          onClick={handleSignOut}
          className="text-xs text-[#C9B3D1] hover:text-[#F6EFE9] transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Hero Welcome Header */}
      <div className="text-center space-y-2 w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF8966]/15 border border-[#FF8966]/30 text-[#FF8966] text-xs font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>Connected Friend Space</span>
        </div>
        <h1 className="text-2xl font-bold text-[#F6EFE9] leading-tight">
          {coupleNames ? `${coupleNames}'s Space` : spaceName}
        </h1>
        <p className="text-xs text-[#C9B3D1] leading-relaxed max-w-xs mx-auto">
          You are a connected friend in this space. You can send sealed time capsules & wishes to the couple!
        </p>
      </div>

      {/* Primary Action Card: Send Wish / Time Capsule */}
      <div className="w-full bg-gradient-to-b from-[#372A3E] to-[#2B1F32] border border-[#FF8966]/30 rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-[#FF8966]">
          <Heart className="w-24 h-24" />
        </div>

        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 text-[#FF8966] font-bold text-xs">
            <Sparkles className="w-4 h-4" />
            <span>Friend Contribution</span>
          </div>
          <h2 className="text-base font-bold text-[#F6EFE9]">
            Send a Sealed Wish or Capsule 🔒
          </h2>
          <p className="text-xs text-[#C9B3D1]">
            Write a secret wish or letter for the couple. It will be sealed into their Someday timeline until the date you choose!
          </p>
        </div>

        <button
          onClick={() => {
            Haptics.lightTap();
            setShowSendModal(true);
          }}
          className="w-full py-3.5 bg-[#FF8966] hover:bg-[#FF8966]/90 text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF8966]/20 transition-all active:scale-98 cursor-pointer relative z-10"
        >
          <Lock className="w-4 h-4" />
          <span>Seal & Send Wish to Couple</span>
        </button>
      </div>

      {/* Connected Members */}
      <div className="w-full bg-[#372A3E]/70 border border-[#4F3C59] rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#C9B3D1] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#FF8966]" />
            <span>Space Members ({members.length})</span>
          </h2>
        </div>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#1F1324]/60 border border-[#4F3C59]/40 text-xs text-[#F6EFE9]"
            >
              <div className="w-8 h-8 rounded-full bg-[#FF8966]/20 border border-[#FF8966]/40 flex items-center justify-center font-bold text-[#FF8966]">
                {(m.display_name?.[0] || 'F').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {m.display_name || 'Friend'}
                </p>
                <p className="text-[10px] text-[#C9B3D1]">
                  Connected Friend
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="w-full bg-[#372A3E]/40 border border-[#4F3C59]/50 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#FF8966] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h3 className="font-bold text-[#F6EFE9]">Couple Space Privacy</h3>
          <p className="text-[#C9B3D1] leading-relaxed text-[11px]">
            The couple’s daily prompts, decision swipes, scrapbook photos, and nudges remain private to them. Your presence in this friend space allows you to participate in group time capsules and celebration events.
          </p>
        </div>
      </div>

      {/* Discreet Secondary Link */}
      <div className="pt-2 text-center">
        <a
          href="/invite"
          className="text-xs text-[#C9B3D1]/60 hover:text-[#C9B3D1] transition-colors underline"
        >
          Have another invite code? Click here
        </a>
      </div>

      {/* Send Wish Modal */}
      <AnimatePresence>
        {showSendModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#1F1324]/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto"
            >
              {sentSuccess ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-14 h-14 bg-[#FF8966]/20 text-[#FF8966] rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F6EFE9]">Wish Sealed & Sent! 🔒</h3>
                  <p className="text-xs text-[#C9B3D1]">
                    Your capsule wish has been added to the couple's Someday time capsules.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4 border-b border-[#4F3C59] pb-3">
                    <h3 className="text-lg font-bold text-[#F6EFE9] flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#FF8966]" />
                      <span>Seal Wish for Couple</span>
                    </h3>
                    <button
                      onClick={() => setShowSendModal(false)}
                      className="text-xs text-[#C9B3D1] hover:text-[#F6EFE9]"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSendWish} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">
                        Wish Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Happy Wedding Anniversary! 🎉"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">
                        Group Event / Tag (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Wedding 2026, Birthday Wish"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">
                        Unlock Date
                      </label>
                      <input
                        type="date"
                        required
                        value={unlockDateStr}
                        onChange={(e) => setUnlockDateStr(e.target.value)}
                        className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                      />
                      <p className="text-[10px] text-[#C9B3D1] mt-1">
                        The couple can only unseal and read your letter on or after this date.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">
                        Secret Letter / Wish
                      </label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Write your secret wish or note for the couple..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-3.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full py-3.5 bg-[#FF8966] hover:bg-[#FF8966]/90 disabled:opacity-50 text-[#1F1324] font-bold text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{sending ? 'Sealing Wish...' : 'Seal & Send Wish 🔒'}</span>
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
