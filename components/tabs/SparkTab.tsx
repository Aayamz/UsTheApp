'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getDB, SparkPrompt } from '@/lib/db';
import { queueMutation } from '@/lib/sync';
import { syncSparkPrompts, submitSparkAnswer } from '@/lib/pairSync';
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

  const loadSparkData = async () => {
    try {
      const db = await getDB();
      const all = await db.getAll('spark_prompts');
      all.sort((a, b) => (a.date < b.date ? 1 : -1));
      setPrompts(all);
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
      setPrompts(updated);
      setLoading(false);
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const activePrompt = prompts.find((p) => p.date === todayStr) || prompts[0];

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

  const [generatingAi, setGeneratingAi] = useState(false);

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
        const newPrompt: SparkPrompt = {
          id: data.spark.id,
          date: data.spark.date,
          question: data.spark.question,
          category: data.spark.category,
          revealed: false,
        };
        const db = await getDB();
        await db.put('spark_prompts', newPrompt);
        setPrompts((prev) => [newPrompt, ...prev.filter((p) => p.date !== newPrompt.date)]);
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="p-3 bg-[#FF8966]/15 border border-[#FF8966]/40 rounded-2xl flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF8966] animate-spin" />
                  <span className="text-xs font-bold text-[#FF8966]">Both answered! Answers Revealed 🎉</span>
                </div>

                {/* Your Answer */}
                <div className="bg-[#1F1324] p-4 rounded-2xl border border-[#4F3C59]">
                  <span className="text-[11px] font-bold text-[#FF8966] block mb-1">Your Answer</span>
                  <p className="text-sm text-[#F6EFE9]">{activePrompt.userAnswer}</p>
                </div>

                {/* Partner Answer */}
                <div className="bg-[#1F1324] p-4 rounded-2xl border border-[#FF8966]/30">
                  <span className="text-[11px] font-bold text-[#C9B3D1] block mb-1">Partner's Answer</span>
                  <p className="text-sm text-[#F6EFE9] font-medium">{activePrompt.partnerAnswer}</p>
                </div>
              </motion.div>
            ) : activePrompt.userAnswer ? (
              /* WAITING FOR PARTNER STATE */
              <div className="space-y-4">
                <div className="bg-[#1F1324] p-4 rounded-2xl border border-[#4F3C59]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-[#FF8966]">Your Answer Saved</span>
                    <CheckCircle2 className="w-4 h-4 text-[#FF8966]" />
                  </div>
                  <p className="text-sm text-[#F6EFE9]">{activePrompt.userAnswer}</p>
                </div>

                <div className="p-4 bg-[#1F1324]/60 border border-[#4F3C59] rounded-2xl text-center space-y-2">
                  <div className="inline-flex items-center justify-center p-3 bg-[#372A3E] rounded-full text-[#FF8966] mb-1">
                    <Lock className="w-5 h-5 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F6EFE9]">Waiting for partner to answer</h3>
                  <p className="text-xs text-[#C9B3D1]">
                    Answers remain sealed privately until both of you complete today's prompt.
                  </p>
                </div>
              </div>
            ) : (
              /* INPUT FORM STATE */
              <form onSubmit={handleSubmitAnswer} className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={3}
                    required
                    placeholder="Write your private answer..."
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    className="w-full bg-[#1F1324] border border-[#4F3C59] rounded-2xl p-4 text-sm text-[#F6EFE9] focus:outline-none focus:border-[#FF8966] resize-none"
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-[#C9B3D1]">
                    <Lock className="w-3 h-3 text-[#FF8966]" />
                    Private until both respond
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Lock In Answer</span>
                </button>
              </form>
            )}
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
