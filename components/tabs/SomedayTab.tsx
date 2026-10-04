'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDB, SomedayCapsule } from '@/lib/db';
import { queueMutation } from '@/lib/sync';
import { Haptics } from '@/lib/haptics';
import { 
  Lock, 
  Unlock, 
  Plus, 
  Calendar, 
  Clock, 
  Users, 
  Sparkles, 
  X,
  FileText,
  Image as ImageIcon,
  Mic,
  Gift
} from 'lucide-react';

export default function SomedayTab() {
  const [capsules, setCapsules] = useState<SomedayCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openedCapsuleId, setOpenedCapsuleId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [unlockDateStr, setUnlockDateStr] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'voice'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [eventName, setEventName] = useState('');

  const loadCapsules = async () => {
    try {
      const db = await getDB();
      const all = await db.getAll('someday_capsules');
      all.sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());
      setCapsules(all);
    } catch (e) {
      console.error('Failed loading capsules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapsules();
  }, []);

  const handleCreateCapsule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    Haptics.lightTap();

    // Default unlock date if not provided: 30 days from today
    const unlockTarget = unlockDateStr 
      ? new Date(unlockDateStr).toISOString() 
      : new Date(Date.now() + 30 * 86400000).toISOString();

    const newCapsule: SomedayCapsule = {
      id: `c-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      unlockDate: unlockTarget,
      mediaType,
      mediaUrl: mediaUrl.trim() || (mediaType === 'image' ? 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&auto=format&fit=crop&q=80' : undefined),
      sealedBy: 'You',
      isUnlocked: false,
      createdAt: new Date().toISOString(),
      isEventScoped: Boolean(eventName.trim()),
      eventName: eventName.trim() || undefined,
      contributors: [
        {
          id: `u-${Date.now()}`,
          name: 'You',
          avatar: '💖',
          addedAt: new Date().toISOString(),
          messageSnippet: content.slice(0, 30) + '...',
        },
      ],
    };

    setCapsules((prev) => [...prev, newCapsule]);
    setShowCreateModal(false);
    setTitle('');
    setContent('');
    setUnlockDateStr('');
    setEventName('');

    const db = await getDB();
    await db.put('someday_capsules', newCapsule);
    await queueMutation('someday_capsules', 'insert', newCapsule);
  };

  const handleUnlockTap = async (capsule: SomedayCapsule) => {
    Haptics.capsuleUnlock();

    const updatedCapsule = { ...capsule, isUnlocked: true };
    setOpenedCapsuleId(capsule.id);

    setCapsules((prev) =>
      prev.map((c) => (c.id === capsule.id ? updatedCapsule : c))
    );

    const db = await getDB();
    await db.put('someday_capsules', updatedCapsule);
    await queueMutation('someday_capsules', 'update', updatedCapsule);
  };

  // Contribute note to existing capsule event
  const handleContribute = async (capsuleId: string) => {
    Haptics.lightTap();
    const db = await getDB();
    const capsule = await db.get('someday_capsules', capsuleId);
    if (capsule) {
      const newContrib = {
        id: `u-${Date.now()}`,
        name: 'Alex',
        avatar: '🌿',
        addedAt: new Date().toISOString(),
        messageSnippet: 'Added secret photo + letter for unlock day!',
      };
      capsule.contributors.push(newContrib);
      await db.put('someday_capsules', capsule);
      setCapsules((prev) => prev.map((c) => (c.id === capsuleId ? { ...c, contributors: capsule.contributors } : c)));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 safe-pt px-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="my-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-[#FF8966] tracking-wider uppercase">Future Time Capsules</span>
          <h1 className="text-2xl font-bold text-[#F6EFE9]">Someday</h1>
        </div>

        <button
          onClick={() => {
            Haptics.lightTap();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FF8966] text-[#1F1324] text-xs font-bold rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Seal Capsule</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 my-4">
          <div className="h-44 bg-[#372A3E]/60 animate-pulse rounded-3xl border border-[#4F3C59]/40" />
        </div>
      ) : (
        <div className="space-y-5 my-3">
          {capsules.map((item) => {
            const isTargetReached = new Date(item.unlockDate).getTime() <= Date.now();
            const isOpenable = isTargetReached && !item.isUnlocked;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden border rounded-3xl p-5 shadow-xl transition-all ${
                  item.isUnlocked
                    ? 'bg-gradient-to-b from-[#372A3E] to-[#2A1B30] border-[#FF8966]/40'
                    : isTargetReached
                    ? 'bg-gradient-to-r from-[#4A3252] via-[#372A3E] to-[#4A3252] border-[#FF8966] animate-pulse'
                    : 'bg-[#372A3E] border-[#4F3C59]'
                }`}
              >
                {/* Event Scoped Badge */}
                {item.isEventScoped && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#FF8966] bg-[#FF8966]/15 px-3 py-1 rounded-full border border-[#FF8966]/30 w-fit mb-3">
                    <Users className="w-3.5 h-3.5" />
                    <span>Group Event: {item.eventName}</span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#F6EFE9]">{item.title}</h3>
                    <p className="text-xs text-[#C9B3D1]">Sealed by {item.sealedBy} • {new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className={`p-2.5 rounded-2xl ${item.isUnlocked ? 'bg-[#FF8966]/20 text-[#FF8966]' : 'bg-[#1F1324] text-[#C9B3D1]'}`}>
                    {item.isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                </div>

                {/* Contributors Avatars */}
                <div className="flex items-center justify-between my-3 pt-3 border-t border-[#4F3C59]/50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#C9B3D1]">Contributors:</span>
                    <div className="flex -space-x-1.5">
                      {item.contributors.map((c) => (
                        <div
                          key={c.id}
                          title={c.name}
                          className="w-7 h-7 rounded-full bg-[#1F1324] border border-[#FF8966]/40 flex items-center justify-center text-xs shadow"
                        >
                          {c.avatar}
                        </div>
                      ))}
                    </div>
                  </div>

                  {!item.isUnlocked && (
                    <button
                      onClick={() => handleContribute(item.id)}
                      className="text-[11px] font-bold text-[#FF8966] hover:underline cursor-pointer"
                    >
                      + Add Note
                    </button>
                  )}
                </div>

                {/* Unlocked State vs Sealed State */}
                {item.isUnlocked ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 pt-3 border-t border-[#FF8966]/30 space-y-3"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-[#FF8966] font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>Capsule Unsealed!</span>
                    </div>

                    <p className="text-sm text-[#F6EFE9] leading-relaxed bg-[#1F1324]/80 p-4 rounded-2xl border border-[#4F3C59]">
                      "{item.content}"
                    </p>

                    {item.mediaUrl && item.mediaType === 'image' && (
                      <div className="rounded-2xl overflow-hidden border border-[#4F3C59] max-h-56">
                        <img src={item.mediaUrl} alt="Capsule Memory" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </motion.div>
                ) : isOpenable ? (
                  /* Target Date Reached: Tap to Unseal Button */
                  <div className="mt-4 pt-3 border-t border-[#FF8966]/40 text-center">
                    <p className="text-xs text-[#FF8966] font-bold mb-3 animate-bounce">
                      ✨ Unlock Date Has Arrived!
                    </p>
                    <button
                      onClick={() => handleUnlockTap(item)}
                      className="w-full py-3.5 bg-gradient-to-r from-[#FF8966] to-[#FF6B4A] text-[#1F1324] font-bold text-sm rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Gift className="w-5 h-5" />
                      <span>Tap to Unseal Capsule</span>
                    </button>
                  </div>
                ) : (
                  /* Sealed Locked State */
                  <div className="mt-3 pt-3 border-t border-[#4F3C59]/40 flex items-center justify-between text-xs text-[#C9B3D1]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#FF8966]" />
                      Unlocks: {new Date(item.unlockDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="bg-[#1F1324] px-2.5 py-1 rounded-full text-[10px] border border-[#4F3C59] font-medium">
                      Sealed 🔒
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Capsule Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#1F1324]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[#4F3C59] pb-3">
                <h3 className="text-lg font-bold text-[#F6EFE9]">Compose Time Capsule</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-full text-[#C9B3D1] hover:text-[#F6EFE9] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCapsule} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Capsule Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Open on our 5th anniversary 💍"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Unlock Date</label>
                  <input
                    type="date"
                    required
                    value={unlockDateStr}
                    onChange={(e) => setUnlockDateStr(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Group Event Scope (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Maya's Wedding Party 2026"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Secret Message / Letter</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Write a message for your future selves to open..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-3.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Seal & Lock Capsule 🔒</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
