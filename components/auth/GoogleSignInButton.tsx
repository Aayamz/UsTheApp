'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function GoogleSignInButton({ next = '/' }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      console.error('OAuth sign-in failed:', error.message);
      setLoading(false);
    }
    // On success, the browser navigates away to Google -- no further
    // state change needed here.
  };

  return (
    <motion.div whileTap={{ scale: 0.97 }}>
      <Button
        onClick={handleSignIn}
        disabled={loading}
        size="lg"
        className="w-full"
      >
        {loading ? 'Opening Google…' : 'Continue with Google'}
      </Button>
    </motion.div>
  );
}
