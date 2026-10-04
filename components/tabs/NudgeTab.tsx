'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDB, NudgeRecord } from '@/lib/db';
import { queueMutation } from '@/lib/sync';
import { Haptics } from '@/lib/haptics';
import { Heart, Sparkles, Send, Clock, Check } from 'lucide-react';

const EMOJI_PRESETS = [
  { emoji: '💖', label: 'Thinking of you' },
  { emoji: '☕', label: 'Coffee break?' },
  { emoji: '🌙', label: 'Goodnight sweetie' },
  { emoji: '⚡', label: 'Missing you right now' },
];

export default function NudgeTab() {
  const [nudges, setNudges] = useState<NudgeRecord[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_PRESETS[0]);
  const [isSending, setIsSending] = useState(false);
  const [ripples, setRipples] = useState<number[]>([]);
  const [lastSentText, setLastSentText] = useState<string | null>(null);

  const loadNudges = async () => {
    try {
      const db = await getDB();
      const all = await db.getAll('nudges');
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNudges(all);
    } catch (e) {
      console.error('Failed loading nudges:', e);
    }
  };

  useEffect(() => {
    loadNudges();
  }, []);

  const handleSendNudge = async () => {
    Haptics.nudgeSent();
    setIsSending(true);

    // Add ripple animation timestamp
    setRipples((prev) => [...prev, Date.now()]);

    const newNudge: NudgeRecord = {
      id: `n-${Date.now()}`,
      sender: 'You',
      emoji: selectedEmoji.emoji,
      label: selectedEmoji.label,
      timestamp: new Date().toISOString(),
      viewed: true,
    };

    setLastSentText(`Sent ${selectedEmoji.emoji} Nudge to your partner!`);

    // Optimistic state insert
    setNudges((prev) => [newNudge, ...prev]);

    const db = await getDB();
    await db.put('nudges', newNudge);
    await queueMutation('nudges', 'insert', newNudge);

    setTimeout(() => {
      setIsSending(false);
    }, 400);

    setTimeout(() => {
      setLastSentText(null);
    }, 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 safe-pt px-4 max-w-md mx-auto w-full flex flex-col justify-between">
      {/* Top Header */}
      <div className="my-4 text-center">
        <span className="text-xs font-semibold text-[#FF8966] tracking-wider uppercase">Instant Connection</span>
        <h1 className="text-2xl font-bold text-[#F6EFE9] mb-1">Nudge</h1>
        <p className="text-xs text-[#C9B3D1]">One tap to let Alex know they are on your mind</p>
      </div>

      {/* Main Single-Tap Center Button */}
      <div className="relative flex flex-col items-center justify-center my-6">
        {/* Animated Ripple Effects */}
        {ripples.map((id) => (
          <motion.div
            key={id}
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute w-44 h-44 rounded-full border-2 border-[#FF8966] pointer-events-none"
          />
        ))}

        {/* Pulse Heart Button */}
        <motion.button
          onClick={handleSendNudge}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          className="relative w-48 h-48 rounded-full bg-gradient-to-br from-[#FF8966] via-[#FF6B4A] to-[#E05238] shadow-[0_0_50px_rgba(255,137,102,0.4)] flex flex-col items-center justify-center text-[#1F1324] cursor-pointer group border-4 border-[#F6EFE9]/20"
        >
          <motion.div
            animate={{ scale: isSending ? [1, 1.25, 1] : [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            className="flex flex-col items-center justify-center"
          >
            <span className="text-4xl mb-1">{selectedEmoji.emoji}</span>
            <span className="text-base font-extrabold tracking-tight">NUDGE</span>
          </motion.div>
        </motion.button>

        {/* Feedback message */}
        <AnimatePresence>
          {lastSentText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 px-4 py-2 bg-[#FF8966]/20 border border-[#FF8966]/40 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#FF8966]"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{lastSentText}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preset Emotion Picker */}
      <div className="space-y-4 my-2">
        <div className="grid grid-cols-2 gap-2">
          {EMOJI_PRESETS.map((preset, idx) => {
            const isSelected = selectedEmoji.emoji === preset.emoji;
            return (
              <button
                key={idx}
                onClick={() => {
                  Haptics.lightTap();
                  setSelectedEmoji(preset);
                }}
                className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF8966] text-[#1F1324] border-[#FF8966] scale-102 shadow-md'
                    : 'bg-[#372A3E] text-[#F6EFE9] border-[#4F3C59] hover:border-[#FF8966]/50'
                }`}
              >
                <span className="text-lg">{preset.emoji}</span>
                <span className="truncate">{preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* Nudge Activity Log */}
        <div className="bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#C9B3D1]">
            <span className="font-bold text-[#F6EFE9]">Recent Nudges</span>
            <Clock className="w-3.5 h-3.5" />
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {nudges.map((n) => (
              <div key={n.id} className="flex items-center justify-between text-xs p-2 bg-[#1F1324] rounded-xl border border-[#4F3C59]/50">
                <div className="flex items-center gap-2">
                  <span className="text-base">{n.emoji}</span>
                  <div>
                    <span className="font-bold text-[#F6EFE9]">{n.sender}: </span>
                    <span className="text-[#C9B3D1]">{n.label}</span>
                  </div>
                </div>
                <span className="text-[10px] text-[#C9B3D1]/60">
                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
