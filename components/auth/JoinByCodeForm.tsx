'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { detectInviteType, joinPairByCode, joinAsFriend } from '@/lib/pairing';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';

export default function JoinByCodeForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await detectInviteType(supabase, code.trim());

      if (result.type === 'invalid') {
        setError('This invite code is not valid. Double-check the link or code and try again.');
        setLoading(false);
        return;
      }

      if (result.type === 'partner') {
        const joinResult = await joinPairByCode(supabase, code.trim(), userId);
        if (!joinResult) {
          setError('Could not join this couple space. The partner slot may already be taken.');
          setLoading(false);
          return;
        }
        router.push('/');
        router.refresh();
        return;
      }

      if (result.type === 'friend') {
        const joinResult = await joinAsFriend(supabase, code.trim(), userId);
        if (!joinResult) {
          setError('Could not join this friend space. Please try the link again.');
          setLoading(false);
          return;
        }
        // Friend joined — show confirmation (they have no main app space)
        router.push('/friend-joined');
        return;
      }
    } catch (err) {
      console.error('Join error:', err);
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit}
      className="w-full max-w-xs space-y-3"
    >
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#C9B3D1] uppercase tracking-wider flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          Enter Invite Code or Paste Link
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setError('');
            // Accept full URLs or bare codes
            const val = e.target.value.trim();
            // Extract code from URL if pasted
            const match = val.match(/\/join\/([a-zA-Z0-9]+)/);
            setCode(match ? match[1] : val);
          }}
          placeholder="e.g. abc12345 or paste invite link"
          className="w-full bg-[#372A3E] border border-[#4F3C59] focus:border-[#FF8966] rounded-xl px-4 py-3 text-sm text-[#F6EFE9] placeholder:text-[#C9B3D1]/50 outline-none transition-colors font-mono"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 leading-snug"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] hover:bg-[#FF8966]/90 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Joining…
          </>
        ) : (
          <>
            Join Space
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </motion.button>
    </motion.form>
  );
}
