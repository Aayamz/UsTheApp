'use client';

import React, { useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDB, PickCard, PickSwipe } from '@/lib/db';
import { queueMutation } from '@/lib/sync';
import { Haptics } from '@/lib/haptics';
import { 
  Heart, 
  X, 
  RotateCcw, 
  Sparkles, 
  Utensils, 
  Film, 
  MapPin, 
  Plane,
  CheckCircle2
} from 'lucide-react';

type DeckType = 'food' | 'movie' | 'plan' | 'travel';

const DECKS: { id: DeckType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'plan', label: 'Date Plans', icon: MapPin },
  { id: 'travel', label: 'Travel', icon: Plane },
];

export default function PickTab() {
  const [activeDeck, setActiveDeck] = useState<DeckType>('food');
  const [cards, setCards] = useState<PickCard[]>([]);
  const [swipes, setSwipes] = useState<Record<string, PickSwipe>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchCard, setMatchCard] = useState<PickCard | null>(null);
  const [matchedList, setMatchedList] = useState<PickCard[]>([]);
  const [showMatchesModal, setShowMatchesModal] = useState(false);

  const loadDeckData = async () => {
    try {
      const db = await getDB();
      const allCards = await db.getAllFromIndex('pick_cards', 'by-deck', activeDeck);
      const allSwipes = await db.getAll('pick_swipes');

      const swipeMap: Record<string, PickSwipe> = {};
      allSwipes.forEach((s) => {
        swipeMap[s.cardId] = s;
      });

      setCards(allCards);
      setSwipes(swipeMap);

      // Collect matched cards
      const matches = allCards.filter((c) => swipeMap[c.id]?.matched);
      setMatchedList(matches);

      // Find first unswiped index by user
      const firstUnswiped = allCards.findIndex((c) => !swipeMap[c.id]?.userSwipe);
      setCurrentIndex(firstUnswiped >= 0 ? firstUnswiped : allCards.length);
    } catch (e) {
      console.error('Failed loading pick deck:', e);
    }
  };

  useEffect(() => {
    loadDeckData();
  }, [activeDeck]);

  const currentCard = cards[currentIndex];

  // React Spring setup for active card drag physics per AGENTS.md
  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    config: { friction: 35, tension: 400 },
  }));

  // Bind drag gesture with @use-gesture/react
  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx], direction: [xDir] }) => {
      const trigger = vx > 0.2 || Math.abs(mx) > 120;
      const dir = xDir < 0 ? -1 : 1;

      if (!down && trigger) {
        // Fly card offscreen
        const swipeDir = dir === 1 ? 'right' : 'left';
        api.start({
          x: (window.innerWidth + 200) * dir,
          rotate: dir * 25,
          scale: 1,
          config: { friction: 30, tension: 200 },
        });
        handleSwipe(swipeDir);
      } else {
        // Spring back to center during active drag
        api.start({
          x: down ? mx : 0,
          y: down ? my : 0,
          rotate: down ? mx / 15 : 0,
          scale: down ? 1.03 : 1,
          immediate: down,
        });
      }
    },
    { filterTaps: true }
  );

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!currentCard) return;

    Haptics.lightTap();

    const existingSwipe = swipes[currentCard.id] || { cardId: currentCard.id, matched: false, timestamp: new Date().toISOString() };
    const isMatch = direction === 'right' && existingSwipe.partnerSwipe === 'right';

    const newSwipe: PickSwipe = {
      ...existingSwipe,
      userSwipe: direction,
      matched: isMatch,
      timestamp: new Date().toISOString(),
    };

    const updatedSwipes = { ...swipes, [currentCard.id]: newSwipe };
    setSwipes(updatedSwipes);

    const db = await getDB();
    await db.put('pick_swipes', newSwipe);
    await queueMutation('pick_swipes', 'insert', newSwipe);

    if (isMatch) {
      Haptics.pickMatch();
      setMatchCard(currentCard);
      setMatchedList((prev) => [...prev, currentCard]);
    }

    // Advance to next card after spring animation finishes
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      api.start({ x: 0, y: 0, rotate: 0, scale: 1, immediate: true });
    }, 200);
  };

  const handleResetDeck = () => {
    Haptics.lightTap();
    setCurrentIndex(0);
    api.start({ x: 0, y: 0, rotate: 0, scale: 1, immediate: true });
  };

  const [generatingAi, setGeneratingAi] = useState(false);

  const handleGenerateAiCards = async () => {
    Haptics.lightTap();
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/generate-daily', { method: 'POST' });
      const data = await res.json();
      if (data.pick_cards && data.pick_cards.length > 0) {
        const db = await getDB();
        for (const card of data.pick_cards) {
          const cardObj: PickCard = {
            id: card.id,
            deck: card.deck,
            title: card.title,
            description: card.description,
            image: card.image,
            tags: card.tags,
            rating: '4.9 ★',
          };
          await db.put('pick_cards', cardObj);
        }
        await loadDeckData();
      }
    } catch (e) {
      console.error('Failed generating AI cards:', e);
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden pb-24 safe-pt px-4 max-w-md mx-auto w-full flex flex-col justify-between">
      {/* Top Deck Selector */}
      <div className="my-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-semibold text-[#FF8966] tracking-wider uppercase">Decide Together</span>
            <h1 className="text-2xl font-bold text-[#F6EFE9]">Pick Deck</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateAiCards}
              disabled={generatingAi}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8966]/15 hover:bg-[#FF8966]/25 border border-[#FF8966]/40 rounded-full text-xs font-bold text-[#FF8966] transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
              <span>{generatingAi ? 'Generating...' : 'Groq AI ✨'}</span>
            </button>

            <button
              onClick={() => setShowMatchesModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#372A3E] border border-[#4F3C59] rounded-full text-xs font-bold text-[#F6EFE9] active:scale-95 cursor-pointer"
            >
              <span>Matches ({matchedList.length})</span>
            </button>
          </div>
        </div>

        {/* Deck Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DECKS.map((d) => {
            const Icon = d.icon;
            const isActive = activeDeck === d.id;
            return (
              <button
                key={d.id}
                onClick={() => {
                  Haptics.lightTap();
                  setActiveDeck(d.id);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#FF8966] text-[#1F1324] shadow-md scale-105'
                    : 'bg-[#372A3E] text-[#C9B3D1] border border-[#4F3C59]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{d.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Swipe Deck Container */}
      <div className="relative flex-1 my-2 flex items-center justify-center">
        {currentCard ? (
          <div className="relative w-full h-[380px] sm:h-[420px] max-w-sm">
            {/* Background card peek preview */}
            {cards[currentIndex + 1] && (
              <div className="absolute inset-0 bg-[#2A1B30] border border-[#4F3C59] rounded-3xl p-5 scale-95 opacity-50 translate-y-3 pointer-events-none" />
            )}

            {/* Active Card with Hardware Acceleration & Spring Physics */}
            <animated.div
              {...bind()}
              style={{
                x,
                y,
                rotate,
                scale,
                transform: x.to((xVal) => `translate3d(${xVal}px, ${y.get()}px, 0px) rotate(${rotate.get()}deg)`),
              }}
              className="absolute inset-0 bg-[#372A3E] border border-[#FF8966]/40 rounded-3xl overflow-hidden shadow-2xl touch-none select-none cursor-grab active:cursor-grabbing gpu-layer flex flex-col justify-between"
            >
              {/* Card Image */}
              <div className="relative h-60 w-full overflow-hidden">
                <img
                  src={currentCard.image}
                  alt={currentCard.title}
                  className="w-full h-full object-cover pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#372A3E] via-transparent to-transparent" />
                
                {currentCard.rating && (
                  <span className="absolute top-3 right-3 bg-[#1F1324]/80 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-[#FF8966] border border-[#4F3C59]">
                    {currentCard.rating}
                  </span>
                )}
              </div>

              {/* Card Information */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {currentCard.tags.map((t, idx) => (
                      <span key={idx} className="text-[10px] font-semibold text-[#FF8966] bg-[#FF8966]/15 px-2 py-0.5 rounded-full border border-[#FF8966]/30">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-xl font-bold text-[#F6EFE9] mb-1">{currentCard.title}</h3>
                  <p className="text-xs text-[#C9B3D1] line-clamp-2">{currentCard.description}</p>
                </div>

                <div className="text-[11px] text-[#C9B3D1]/60 flex items-center justify-between pt-2 border-t border-[#4F3C59]/40">
                  <span>Swipe Right to Like • Left to Pass</span>
                  {swipes[currentCard.id]?.partnerSwipe === 'right' && (
                    <span className="text-[#FF8966] font-bold animate-pulse">Partner liked this! 💕</span>
                  )}
                </div>
              </div>
            </animated.div>
          </div>
        ) : (
          /* Empty Deck Finished State */
          <div className="text-center p-8 bg-[#372A3E]/80 border border-[#4F3C59] rounded-3xl max-w-sm w-full space-y-4">
            <div className="inline-flex p-4 bg-[#FF8966]/20 text-[#FF8966] rounded-full">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#F6EFE9]">You've seen all choices in {activeDeck}!</h3>
            <p className="text-xs text-[#C9B3D1]">
              Switch category above or restart the deck to swipe again.
            </p>

            <button
              onClick={handleResetDeck}
              className="px-4 py-2.5 bg-[#FF8966] text-[#1F1324] font-bold text-xs rounded-full flex items-center justify-center gap-2 mx-auto active:scale-95 cursor-pointer shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Deck</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Manual Control Action Buttons */}
      {currentCard && (
        <div className="flex items-center justify-center gap-6 my-2">
          <button
            onClick={() => handleSwipe('left')}
            className="w-14 h-14 rounded-full bg-[#1F1324] border border-[#FF5A5A]/50 flex items-center justify-center text-[#FF5A5A] shadow-lg hover:scale-110 active:scale-90 transition-transform cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF8966] to-[#FF6B4A] text-[#1F1324] flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-transform cursor-pointer"
          >
            <Heart className="w-8 h-8 fill-[#1F1324]" />
          </button>
        </div>
      )}

      {/* Full Screen Match Overlay Modal */}
      <AnimatePresence>
        {matchCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] bg-[#1F1324]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="space-y-6 max-w-xs"
            >
              <div className="inline-flex p-4 bg-[#FF8966] text-[#1F1324] rounded-full shadow-2xl animate-bounce">
                <Sparkles className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-3xl font-extrabold text-[#F6EFE9] mb-1">It's a Match! 🎉</h2>
                <p className="text-sm text-[#FF8966] font-semibold">You and your partner both picked this!</p>
              </div>

              <div className="bg-[#372A3E] border border-[#FF8966] rounded-3xl p-4 shadow-xl text-left">
                <img src={matchCard.image} alt={matchCard.title} className="w-full h-40 object-cover rounded-2xl mb-3" />
                <h3 className="text-lg font-bold text-[#F6EFE9]">{matchCard.title}</h3>
                <p className="text-xs text-[#C9B3D1]">{matchCard.description}</p>
              </div>

              <button
                onClick={() => setMatchCard(null)}
                className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-transform cursor-pointer"
              >
                Keep Swiping ✨
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Matches Drawer Modal */}
      <AnimatePresence>
        {showMatchesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#1F1324]/85 backdrop-blur-md flex items-end justify-center p-4 safe-pb"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#372A3E] border border-[#4F3C59] rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto pb-14 mb-16 sm:mb-0"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[#4F3C59] pb-3 sticky top-0 bg-[#372A3E] z-10">
                <h3 className="text-lg font-bold text-[#F6EFE9]">Our Mutual Matches 💕</h3>
                <button
                  onClick={() => setShowMatchesModal(false)}
                  className="p-1 rounded-full text-[#C9B3D1] hover:text-[#F6EFE9] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {matchedList.length === 0 ? (
                <p className="text-xs text-[#C9B3D1] text-center py-6">No mutual matches yet! Swipe right to match.</p>
              ) : (
                <div className="space-y-3">
                  {matchedList.map((card) => (
                    <div key={card.id} className="flex items-center gap-3 p-3 bg-[#1F1324] border border-[#4F3C59] rounded-2xl">
                      <img src={card.image} alt={card.title} className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-[#F6EFE9]">{card.title}</h4>
                        <p className="text-xs text-[#C9B3D1] line-clamp-1">{card.description}</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-[#FF8966]" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
