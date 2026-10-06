'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function GoogleSignInButton({
  next = '/',
  inviteCode,
}: {
  next?: string;
  inviteCode?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);

    if (inviteCode && typeof window !== 'undefined') {
      try {
        localStorage.setItem('pending_invite_code', inviteCode);
        document.cookie = `pending_invite_code=${inviteCode}; path=/; max-age=3600; SameSite=Lax`;
      } catch (e) {
        console.error('Error saving pending invite code:', e);
      }
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error('OAuth sign-in failed:', error.message);
      setLoading(false);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
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

