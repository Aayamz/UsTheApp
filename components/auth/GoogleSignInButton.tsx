'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucbcjjrtexvlenoglorw.supabase.co';

export default function GoogleSignInButton({
  next = '/',
  inviteCode,
}: {
  next?: string;
  inviteCode?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = () => {
    setLoading(true);

    if (typeof window !== 'undefined') {
      if (inviteCode) {
        try {
          localStorage.setItem('pending_invite_code', inviteCode);
          document.cookie = `pending_invite_code=${inviteCode}; path=/; max-age=3600; SameSite=Lax`;
        } catch (e) {
          console.error('Error saving pending invite code:', e);
        }
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;

      // Synchronous navigation -- executes directly on user gesture, bypassing iOS WebKit gesture expiration
      window.location.href = authUrl;
    }
  };

  return (
    <motion.div whileTap={{ scale: 0.97 }}>
      <Button
        onClick={handleSignIn}
        disabled={loading}
        size="lg"
        className="w-full cursor-pointer"
      >
        {loading ? 'Opening Google…' : 'Continue with Google'}
      </Button>
    </motion.div>
  );
}


