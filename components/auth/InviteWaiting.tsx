'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function InviteWaiting({
  pairId,
  inviteCode,
}: {
  pairId: string;
  inviteCode: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setInviteUrl(`${window.location.origin}/join/${inviteCode}`);
    }
  }, [inviteCode]);

  useEffect(() => {
    // Listen for the partner claiming this pair, then jump straight in --
    // no need to make anyone hit refresh.
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pairId, router]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs text-center">
      <p className="text-sm text-[#F6EFE9]/70">
        Send this link to her -- once she signs in with it, you&apos;re paired.
      </p>

      <div className="w-full rounded-xl bg-[#372A3E] px-4 py-3 text-sm break-all min-h-[44px] flex items-center justify-center text-[#F6EFE9]">
        {inviteUrl || 'Loading invite link...'}
      </div>

      <motion.div whileTap={{ scale: 0.97 }} className="w-full">
        <Button onClick={handleCopy} size="lg" className="w-full" disabled={!inviteUrl}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </Button>
      </motion.div>

      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-xs text-[#F6EFE9]/50"
      >
        Waiting for her to join…
      </motion.div>
    </div>
  );
}
