'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Check, Copy, Share2 } from 'lucide-react';

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
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on U&!',
          text: "Let's connect on U&! Tap the link to join me:",
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      await handleCopy();
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xs text-center">
      <p className="text-sm text-[#F6EFE9]/80 leading-relaxed">
        Send this link to your partner or friends — once they sign in with it, you&apos;re connected!
      </p>

      <div className="w-full rounded-xl bg-[#372A3E] border border-[#4F3C59] px-4 py-3 text-xs font-mono break-all min-h-[44px] flex items-center justify-center text-[#FF8966]">
        {inviteUrl || 'Loading invite link...'}
      </div>

      <div className="w-full flex flex-col gap-2.5">
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <motion.div whileTap={{ scale: 0.97 }} className="w-full">
            <Button
              onClick={handleShare}
              size="lg"
              className="w-full bg-[#FF8966] text-[#1F1324] hover:bg-[#FF8966]/90 font-bold flex items-center justify-center gap-2 cursor-pointer"
              disabled={!inviteUrl}
            >
              <Share2 className="w-4 h-4" />
              <span>Share Invite Link</span>
            </Button>
          </motion.div>
        )}

        <motion.div whileTap={{ scale: 0.97 }} className="w-full">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="lg"
            className="w-full border-[#4F3C59] text-[#F6EFE9] hover:bg-[#372A3E] flex items-center justify-center gap-2 cursor-pointer"
            disabled={!inviteUrl}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Invite Link'}</span>
          </Button>
        </motion.div>
      </div>

      <div className="pt-2 w-full flex flex-col items-center gap-3">
        <Link
          href="/"
          className="w-full py-3 px-4 bg-[#372A3E]/80 border border-[#4F3C59] text-[#F6EFE9] rounded-xl text-xs font-bold hover:bg-[#372A3E] transition-all flex items-center justify-center gap-2"
        >
          <span>Continue to App</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#FF8966]" />
        </Link>

        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-xs text-[#F6EFE9]/50"
        >
          Waiting for them to join…
        </motion.div>
      </div>
    </div>
  );
}

