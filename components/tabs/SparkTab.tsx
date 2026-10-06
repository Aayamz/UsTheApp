'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getDB, SparkPrompt } from '@/lib/db';
import { queueMutation } from '@/lib/sync';
import { syncSparkPrompts, submitSparkAnswer, getActivePairId, fetchAndSaveSpark } from '@/lib/pairSync';
import { Haptics } from '@/lib/haptics';
import { 
  Flame, 
  Lock, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Calendar,
} from 'lucide-react';

export default function SparkTab() {
  const [prompts, setPrompts] = useState<SparkPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerInput, setAnswerInput] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const loadSparkData = async () => {
    try {
      const db = await getDB();
      const all = await db.getAll('spark_prompts');
      all.sort((a, b) => (a.date < b.date ? 1 : -1));
      
      const uniqueByDate = new Map<string, SparkPrompt>();
      all.forEach((item) => {
        if (!uniqueByDate.has(item.date) || item.userAnswer || item.partnerAnswer) {
          uniqueByDate.set(item.date, item);
        }
      });
      setPrompts(Array.from(uniqueByDate.values()));
    } catch (e) {
      console.error('Failed loading spark prompts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSparkData();
    let cleanup: (() => void) | undefined;
    syncSparkPrompts((updated) => {
      const uniqueByDate = new Map<string, SparkPrompt>();
      updated.forEach((item) => {
        if (!uniqueByDate.has(item.date) || item.userAnswer || item.partnerAnswer) {
          uniqueByDate.set(item.date, item);
        }
      });
      setPrompts(Array.from(uniqueByDate.values()));
      setLoading(false);
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultPrompt: SparkPrompt = {
    id: `s-${todayStr}`,
    date: todayStr,
    question: 'What is one small detail about me that you noticed recently?',
    category: 'Connection & Joy',
    revealed: false,
  };

  const activePrompt = prompts.find((p) => p.date === todayStr) || prompts[0] || defaultPrompt;

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || !activePrompt) return;

    Haptics.lightTap();
    const text = answerInput.trim();
    setAnswerInput('');

    const updated = await submitSparkAnswer(activePrompt.id, text);
    if (updated) {
      setPrompts((prev) =>
        prev.map((item) => (item.id === activePrompt.id ? updated : item))
      );
    }
  };

  const handleGenerateAiPrompt = async () => {
    Haptics.lightTap();
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/generate-daily', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Failed to generate AI content');
        return;
      }
      if (data.spark) {
        const pairId = await getActivePairId();
        if (pairId) {
          const freshPrompts = await fetchAndSaveSpark(pairId);
          if (freshPrompts) {
            const uniqueByDate = new Map<string, SparkPrompt>();
            freshPrompts.forEach((item) => {
              if (!uniqueByDate.has(item.date) || item.userAnswer || item.partnerAnswer) {
                uniqueByDate.set(item.date, item);
              }
            });
            setPrompts(Array.from(uniqueByDate.values()));
          }
        }
      }
    } catch (e: any) {
      console.error('AI generation failed:', e);
      alert(e.message || 'AI generation failed');
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 safe-pt px-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="my-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-[#FF8966] tracking-wider uppercase">Daily Connection</span>
          <h1 className="text-2xl font-bold text-[#F6EFE9]">Spark</h1>
        </div>

        <button
          onClick={handleGenerateAiPrompt}
          disabled={generatingAi}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8966]/15 hover:bg-[#FF8966]/25 border border-[#FF8966]/40 rounded-full text-xs font-bold text-[#FF8966] transition-all active:scale-95 cursor-pointer"
        >
          <Sparkles className={`w-4 h-4 text-[#FF8966] ${generatingAi ? 'animate-spin' : ''}`} />
          <span>{generatingAi ? 'Generating...' : 'Groq AI ✨'}</span>
        </button>
      </div>

      {loading ? (
        <div className="h-72 bg-[#372A3E]/60 animate-pulse rounded-3xl border border-[#4F3C59]/40 my-4" />
      ) : activePrompt ? (
        <div className="space-y-6">
          {/* Main Interactive Daily Card */}
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative overflow-hidden bg-gradient-to-b from-[#372A3E] via-[#2F1F35] to-[#25182C] border border-[#FF8966]/40 rounded-3xl p-6 shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF8966]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between text-xs text-[#C9B3D1] mb-3">
              <span className="px-2.5 py-1 bg-[#1F1324] rounded-full border border-[#4F3C59] font-medium text-[#FF8966]">
                {activePrompt.category}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {activePrompt.date}
              </span>
            </div>

            <h2 className="text-xl font-bold text-[#F6EFE9] leading-snug mb-6">
              "{activePrompt.question}"
            </h2>

            {/* Answer State Container */}
            {activePrompt.revealed ? (
              /* REVEALED STATE (Both Answered!) */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-2 border-t border-[#FF8966]/30"
              >
                <div className="flex items-center gap-1.5 text-xs text-[#FF8966] font-bold bg-[#FF8966]/15 py-1.5 px-3 rounded-full border border-[#FF8966]/30 w-fit">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Both answered! Answers Revealed 🎉</span>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#1F1324]/80 p-4 rounded-2xl border border-[#4F3C59]">
                    <span className="text-[11px] font-bold text-[#FF8966] block mb-1 uppercase tracking-wider">Your Answer</span>
                    <p className="text-sm text-[#F6EFE9]">{activePrompt.userAnswer || 'No answer submitted'}</p>
                  </div>

                  <div className="bg-[#1F1324]/80 p-4 rounded-2xl border border-[#4F3C59]">
                    <span className="text-[11px] font-bold text-[#C9B3D1] block mb-1 uppercase tracking-wider">Partner's Answer</span>
                    <p className="text-sm text-[#F6EFE9]">{activePrompt.partnerAnswer || 'No answer submitted'}</p>
                  </div>
                </div>
              </motion.div>
            ) : activePrompt.userAnswer ? (
              /* USER SUBMITTED, WAITING FOR PARTNER */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-2 border-t border-[#4F3C59]/50"
              >
                <div className="bg-[#1F1324]/80 p-4 rounded-2xl border border-[#4F3C59] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[#FF8966] block uppercase tracking-wider mb-0.5">Your Answer Saved</span>
                    <p className="text-sm text-[#F6EFE9] font-medium">{activePrompt.userAnswer}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[#FF8966]" />
                </div>

                <div className="text-center py-6 px-4 bg-[#1F1324]/50 border border-[#4F3C59]/40 rounded-2xl space-y-2">
                  <div className="inline-flex p-2.5 bg-[#FF8966]/10 text-[#FF8966] rounded-full mb-1">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#F6EFE9]">Waiting for partner to answer</h4>
                  <p className="text-xs text-[#C9B3D1] max-w-xs mx-auto">
                    Answers remain sealed privately until both of you complete today's prompt.
                  </p>
                </div>
              </motion.div>
            ) : (
              /* UNANSWERED STATE - FORM INPUT */
              <form onSubmit={handleSubmitAnswer} className="space-y-3 pt-2">
                <textarea
                  rows={3}
                  required
                  placeholder="Type your honest answer here... (kept hidden until partner responds)"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-4 text-sm text-[#F6EFE9] placeholder-[#C9B3D1]/50 focus:outline-none focus:border-[#FF8966] transition-colors resize-none"
                />

                <button
                  type="submit"
                  disabled={!answerInput.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FF8966] to-[#FF6B4A] text-[#1F1324] font-bold text-sm rounded-2xl shadow-xl hover:brightness-110 active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Answer Privately</span>
                </button>
              </form>
            )}
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
