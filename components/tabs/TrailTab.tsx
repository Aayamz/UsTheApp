'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDB, TrailEntry } from '@/lib/db';
import { queueMutation } from '@/lib/sync';
import { Haptics } from '@/lib/haptics';
import { 
  Plus, 
  Calendar, 
  MapPin, 
  Heart, 
  Clock, 
  Sparkles, 
  X,
} from 'lucide-react';

export default function TrailTab() {
  const [entries, setEntries] = useState<TrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newType, setNewType] = useState<'moment' | 'countdown'>('moment');
  const [countdownDate, setCountdownDate] = useState('');

  const loadTrailData = async () => {
    try {
      const db = await getDB();
      const all = await db.getAll('trail_entries');
      // Sort newest first
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(all);
    } catch (e) {
      console.error('Failed loading trail entries:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrailData();
  }, []);

  const handleLike = async (id: string, currentLikes: number, currentlyLiked?: boolean) => {
    Haptics.lightTap();
    const isLiked = !currentlyLiked;
    const updatedLikes = isLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    // Optimistic UI update
    setEntries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, likesCount: updatedLikes, likedByMe: isLiked } : item
      )
    );

    const db = await getDB();
    const entry = await db.get('trail_entries', id);
    if (entry) {
      entry.likesCount = updatedLikes;
      entry.likedByMe = isLiked;
      await db.put('trail_entries', entry);
      await queueMutation('trail_entries', 'update', entry);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    Haptics.lightTap();
    const newEntry: TrailEntry = {
      id: `t-${Date.now()}`,
      type: newType,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      location: newLocation.trim() || undefined,
      imageUrl: newImage.trim() || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&auto=format&fit=crop&q=80',
      date: new Date().toISOString(),
      partner: 'You',
      likesCount: 1,
      countdownTarget: newType === 'countdown' ? (countdownDate ? new Date(countdownDate).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString()) : undefined,
    };

    // Optimistic insert
    setEntries((prev) => [newEntry, ...prev]);
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
    setNewImage('');

    const db = await getDB();
    await db.put('trail_entries', newEntry);
    await queueMutation('trail_entries', 'insert', newEntry);
  };

  // Preset sample images for quick add
  const sampleImages = [
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-24 safe-pt px-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between my-4">
        <div>
          <span className="text-xs font-semibold text-[#FF8966] tracking-wider uppercase">Our Memory Feed</span>
          <h1 className="text-2xl font-bold text-[#F6EFE9]">Trail</h1>
        </div>

        <button
          onClick={() => {
            Haptics.lightTap();
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FF8966] text-[#1F1324] text-xs font-bold rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Moment</span>
        </button>
      </div>

      {/* Content Feed */}
      {loading ? (
        <div className="space-y-4 my-6">
          <div className="h-44 bg-[#372A3E]/60 animate-pulse rounded-2xl border border-[#4F3C59]/40" />
          <div className="h-64 bg-[#372A3E]/60 animate-pulse rounded-2xl border border-[#4F3C59]/40" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 px-6 bg-[#372A3E]/40 border border-[#4F3C59]/50 rounded-3xl space-y-3 my-4">
          <div className="inline-flex p-3 bg-[#FF8966]/20 text-[#FF8966] rounded-full">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#F6EFE9]">No moments in Trail yet</h3>
          <p className="text-xs text-[#C9B3D1]">
            Tap "Add Moment" above to share your first photo memory or upcoming countdown.
          </p>
        </div>
      ) : (
        <div className="space-y-5 my-3">
          {entries.map((item) => {
            if (item.type === 'countdown' && item.countdownTarget) {
              const diffTime = new Date(item.countdownTarget).getTime() - Date.now();
              const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="contain-scroll-item relative overflow-hidden bg-gradient-to-br from-[#372A3E] to-[#25182C] border border-[#FF8966]/40 rounded-2xl p-5 shadow-xl"
                >
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF8966]/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF8966] bg-[#FF8966]/15 px-2.5 py-1 rounded-full border border-[#FF8966]/30">
                      <Clock className="w-3.5 h-3.5" />
                      Upcoming Countdown
                    </span>
                    <span className="text-xs text-[#C9B3D1]">Added by {item.partner}</span>
                  </div>

                  <h3 className="text-lg font-bold text-[#F6EFE9] mb-1">{item.title}</h3>
                  {item.description && <p className="text-xs text-[#C9B3D1] mb-4">{item.description}</p>}

                  {item.imageUrl && (
                    <div className="relative h-36 w-full rounded-xl overflow-hidden mb-4 border border-[#4F3C59]">
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1F1324]/80 to-transparent" />
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-[#1F1324]/60 rounded-xl px-4 py-3 border border-[#4F3C59]/60">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#FF8966]" />
                      <span className="text-xs text-[#F6EFE9] font-medium">
                        {new Date(item.countdownTarget).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-[#FF8966]">{daysLeft}</span>
                      <span className="text-xs font-semibold text-[#F6EFE9]">days left</span>
                    </div>
                  </div>
                </motion.div>
              );
            }

            // Standard Moment
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="contain-scroll-item bg-[#372A3E] border border-[#4F3C59] rounded-2xl overflow-hidden shadow-md"
              >
                {item.imageUrl && (
                  <div className="relative h-48 w-full">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 bg-[#1F1324]/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#4F3C59] text-[10px] font-semibold text-[#F6EFE9]">
                      By {item.partner}
                    </div>
                  </div>
                )}

                <div className="p-4">
                  <h3 className="text-base font-bold text-[#F6EFE9] mb-1">{item.title}</h3>
                  {item.description && <p className="text-xs text-[#C9B3D1] mb-3 leading-relaxed">{item.description}</p>}

                  <div className="flex items-center justify-between text-xs text-[#C9B3D1] pt-2 border-t border-[#4F3C59]/40">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#C9B3D1]/70">
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {item.location && (
                        <span className="flex items-center gap-1 text-[11px] text-[#FF8966]">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleLike(item.id, item.likesCount, item.likedByMe)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all active:scale-90 cursor-pointer ${
                        item.likedByMe
                          ? 'bg-[#FF8966]/20 border-[#FF8966] text-[#FF8966]'
                          : 'bg-[#1F1324] border-[#4F3C59] text-[#F6EFE9]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${item.likedByMe ? 'fill-[#FF8966] text-[#FF8966]' : 'text-[#FF8966]'}`} />
                      <span className="text-xs font-bold">{item.likesCount}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Moment Modal with High Z-Index & Extra Scroll Margin */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#1F1324]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 safe-pb"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto pb-14 mb-16 sm:mb-0"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[#4F3C59] pb-3 sticky top-0 bg-[#372A3E] z-10">
                <h3 className="text-lg font-bold text-[#F6EFE9]">Create Trail Entry</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-full text-[#C9B3D1] hover:text-[#F6EFE9] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEntry} className="space-y-4">
                {/* Entry Type selector */}
                <div className="grid grid-cols-2 gap-2 bg-[#1F1324] p-1 rounded-xl border border-[#4F3C59]">
                  <button
                    type="button"
                    onClick={() => setNewType('moment')}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      newType === 'moment' ? 'bg-[#FF8966] text-[#1F1324]' : 'text-[#C9B3D1]'
                    }`}
                  >
                    📸 Memory Moment
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('countdown')}
                    className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      newType === 'countdown' ? 'bg-[#FF8966] text-[#1F1324]' : 'text-[#C9B3D1]'
                    }`}
                  >
                    ⏳ Countdown Date
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder={newType === 'countdown' ? 'e.g. Vacation to Paris ✈️' : 'e.g. Picnic by the lake 🧺'}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                {newType === 'countdown' && (
                  <div>
                    <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Target Date</label>
                    <input
                      type="date"
                      required
                      value={countdownDate}
                      onChange={(e) => setCountdownDate(e.target.value)}
                      className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2.5 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Story / Note</label>
                  <textarea
                    rows={2}
                    placeholder="Write a tiny note about this memory..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1">Location (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Central Park, NY"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3.5 py-2 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                {/* Preset image select */}
                <div>
                  <label className="text-xs font-semibold text-[#C9B3D1] block mb-1.5">Cover Image</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {sampleImages.map((imgUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setNewImage(imgUrl)}
                        className={`h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          newImage === imgUrl ? 'border-[#FF8966] scale-105' : 'border-transparent'
                        }`}
                      >
                        <img src={imgUrl} alt="Preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <input
                    type="url"
                    placeholder="Or paste custom image URL..."
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-xl px-3 py-2 text-xs text-[#F6EFE9] focus:outline-none focus:border-[#FF8966]"
                  />
                </div>

                <div className="pt-3 pb-6">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-xl hover:brightness-110 active:scale-98 transition-all cursor-pointer shadow-xl"
                  >
                    Post to Trail 🌟
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
