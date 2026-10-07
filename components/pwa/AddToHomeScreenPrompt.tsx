'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import Logo from '@/components/Logo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface AddToHomeScreenPromptProps {
  variant?: 'card' | 'hero' | 'banner';
  title?: string;
  subtitle?: string;
  className?: string;
  onInstalled?: () => void;
}

export default function AddToHomeScreenPrompt({
  variant = 'card',
  title = 'Add U& to your Home Screen',
  subtitle = 'Get the full app experience with instant launch, offline support, and haptic feedback.',
  className = '',
  onInstalled,
}: AddToHomeScreenPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [showGeneralGuide, setShowGeneralGuide] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIOSDevice = /ipad|iphone|ipod/i.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for Chrome/Android/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstalledSuccess(true);
      setDeferredPrompt(null);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 60, 40]);
      }
      onInstalled?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstalled]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setInstalledSuccess(true);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([50, 50, 100]);
        }
        onInstalled?.();
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowGeneralGuide(true);
    }
  };

  return (
    <>
      {/* ── MAIN PROMPT CONTAINER ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-3xl border border-[#FF8966]/40 bg-gradient-to-br from-[#372A3E] via-[#2A1F33] to-[#1F1324] p-5 shadow-xl text-[#F6EFE9] ${className}`}
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF8966]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#1F1324] border border-[#FF8966]/50 flex items-center justify-center shrink-0 shadow-inner">
            <Logo size={28} showWordmark={false} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-[#F6EFE9]">{title}</h3>
              <span className="text-[10px] font-semibold text-[#FF8966] bg-[#FF8966]/15 px-2 py-0.5 rounded-full border border-[#FF8966]/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> PWA
              </span>
            </div>
            <p className="text-xs text-[#C9B3D1] leading-relaxed mt-1">{subtitle}</p>
          </div>
        </div>

        {/* Status / Action Button */}
        <div className="mt-4 pt-3 border-t border-[#4F3C59]/60 flex items-center justify-between gap-3">
          {isInstalled || installedSuccess ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 w-full justify-center">
              <CheckCircle2 className="w-4 h-4" />
              <span>Installed on your Home Screen!</span>
            </div>
          ) : (
            <>
              <div className="text-[11px] text-[#C9B3D1] flex items-center gap-1.5 shrink">
                <Smartphone className="w-3.5 h-3.5 text-[#FF8966]" />
                <span>Works offline & full-screen</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleInstallClick}
                className="py-2.5 px-4 bg-[#FF8966] text-[#1F1324] hover:bg-[#FF8966]/90 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#FF8966]/20 cursor-pointer shrink-0"
              >
                {deferredPrompt ? (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Install App</span>
                  </>
                ) : isIOS ? (
                  <>
                    <Share className="w-3.5 h-3.5" />
                    <span>Add to Home Screen</span>
                  </>
                ) : (
                  <>
                    <PlusSquare className="w-3.5 h-3.5" />
                    <span>Add to Home Screen</span>
                  </>
                )}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* ── iOS INSTALL GUIDE MODAL ───────────────────────── */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => setShowIOSGuide(false)}
          >
            <motion.div
              initial={{ y: 100, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#1F1324] border border-[#FF8966]/40 rounded-3xl p-6 text-[#F6EFE9] space-y-5 shadow-2xl relative"
            >
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-2 text-[#C9B3D1] hover:text-[#F6EFE9] bg-[#372A3E] rounded-full border border-[#4F3C59]"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF8966]/20 border border-[#FF8966]/40 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#FF8966]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Add U& to iOS Home Screen</h3>
                  <p className="text-xs text-[#C9B3D1]">Follow these quick steps in Safari:</p>
                </div>
              </div>

              {/* Step by step guide */}
              <div className="space-y-3 bg-[#372A3E]/60 border border-[#4F3C59] rounded-2xl p-4 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF8966] text-[#1F1324] font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#F6EFE9] flex items-center gap-1.5">
                      Tap the <Share className="w-4 h-4 text-[#FF8966] inline" /> Share button
                    </p>
                    <p className="text-[#C9B3D1] text-[11px]">
                      Located at the bottom of your Safari screen (or top on iPad).
                    </p>
                  </div>
                </div>

                <div className="h-px bg-[#4F3C59]/60" />

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF8966] text-[#1F1324] font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#F6EFE9] flex items-center gap-1.5">
                      Select <PlusSquare className="w-4 h-4 text-[#FF8966] inline" /> Add to Home Screen
                    </p>
                    <p className="text-[#C9B3D1] text-[11px]">
                      Scroll down in the action menu until you see this option.
                    </p>
                  </div>
                </div>

                <div className="h-px bg-[#4F3C59]/60" />

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF8966] text-[#1F1324] font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#F6EFE9]">Tap "Add" in top right</p>
                    <p className="text-[#C9B3D1] text-[11px]">
                      U& will appear right on your home screen like a native app!
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-xl"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GENERAL INSTALL GUIDE MODAL (Chrome Desktop / Android / Edge) ───────────────────────── */}
      <AnimatePresence>
        {showGeneralGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => setShowGeneralGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#1F1324] border border-[#4F3C59] rounded-3xl p-6 text-[#F6EFE9] space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setShowGeneralGuide(false)}
                className="absolute top-4 right-4 p-2 text-[#C9B3D1] hover:text-[#F6EFE9] bg-[#372A3E] rounded-full border border-[#4F3C59]"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF8966]/20 border border-[#FF8966]/40 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-[#FF8966]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Install U& App</h3>
                  <p className="text-xs text-[#C9B3D1]">Add to your home screen or desktop:</p>
                </div>
              </div>

              <div className="space-y-3 bg-[#372A3E]/60 border border-[#4F3C59] rounded-2xl p-4 text-xs text-[#C9B3D1]">
                <p>
                  To install <strong className="text-[#F6EFE9]">U&</strong> on your device:
                </p>
                <ul className="list-disc list-inside space-y-1 text-left">
                  <li>
                    Look for the <strong className="text-[#FF8966]">Install icon</strong> in your browser's address bar.
                  </li>
                  <li>Or open your browser menu (⋮ or ⋯) and click <strong className="text-[#F6EFE9]">Install App</strong> or <strong className="text-[#F6EFE9]">Add to Home Screen</strong>.</li>
                </ul>
              </div>

              <button
                onClick={() => setShowGeneralGuide(false)}
                className="w-full py-3 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-xl"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
