"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { AILoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";
import StreamingText from "@/components/public/tools/StreamingText";

type Phase = "input" | "loading" | "streaming" | "done";

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";
const labelClass = "block text-xs font-light text-muted-foreground mb-1";

const SCORE_TIERS = [
  { min: 800, max: 850, label: "Exceptional", desc: "Top-tier rates, every loan type" },
  { min: 740, max: 799, label: "Very good", desc: "Near-best rates, strong approval odds" },
  { min: 670, max: 739, label: "Good", desc: "Standard rates, most loans available" },
  { min: 580, max: 669, label: "Fair", desc: "Higher rates, FHA may be best option" },
  { min: 300, max: 579, label: "Poor", desc: "Very limited options, credit building first" },
];

const SCORE_MIN = 300;
const SCORE_MAX = 850;

function ScoreBar({ score }: { score: number }) {
  const tier =
    score >= 800 ? SCORE_TIERS[0]
    : score >= 740 ? SCORE_TIERS[1]
    : score >= 670 ? SCORE_TIERS[2]
    : score >= 580 ? SCORE_TIERS[3]
    : SCORE_TIERS[4];

  const fillPct = ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;

  // Zone boundaries as percentages
  const zones = [
    { label: "Poor", end: ((579 - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100 },
    { label: "Fair", end: ((669 - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100 },
    { label: "Good", end: ((739 - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100 },
    { label: "Very good", end: ((799 - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100 },
    { label: "Exceptional", end: 100 },
  ];

  return (
    <div className="mb-7">
      <div className="flex items-end gap-4 mb-3">
        <p className="text-4xl font-extralight tracking-tight">{score}</p>
        <div className="pb-1">
          <p className="text-sm font-light text-foreground">{tier.label}</p>
          <p className="text-xs text-muted-foreground">{tier.desc}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="relative h-2 w-full rounded-full bg-border overflow-hidden mb-1.5">
        {/* Segmented zone backgrounds */}
        {zones.map((zone, i) => {
          const prevEnd = i === 0 ? 0 : zones[i - 1].end;
          return (
            <div
              key={zone.label}
              className="absolute top-0 h-full"
              style={{
                left: `${prevEnd}%`,
                width: `${zone.end - prevEnd}%`,
                opacity: 0.18,
                background: i < 2 ? "var(--color-foreground)" : i === 2 ? "var(--color-foreground)" : "var(--color-foreground)",
              }}
            />
          );
        })}
        {/* Filled portion */}
        <div
          className="absolute top-0 left-0 h-full bg-foreground rounded-full transition-all"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="flex justify-between text-[9px] tracking-widest uppercase text-foreground/30 select-none">
        <span>300</span>
        <span>580</span>
        <span>670</span>
        <span>740</span>
        <span>800</span>
        <span>850</span>
      </div>
    </div>
  );
}

export default function CreditScoreTranslatorPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
  const [score, setScore] = useState("");
  const [submittedScore, setSubmittedScore] = useState(0);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const parsed = parseInt(score);
      setSubmittedScore(parsed);
      setPhase("loading");
      setStream(null);

      try {
        const res = await fetch("/api/tools/credit-score-translator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: parsed }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Request failed");
        }

        setPhase("streaming");
        setStream(res.body);
      } catch {
        setPhase("input");
      }
    },
    [score]
  );

  const handleReset = useCallback(() => {
    setPhase("input");
    setStream(null);
    setScore("");
  }, []);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title="Credit Score Translator"
      description="Enter your score. Get a straight-talk breakdown of what it means for your mortgage options."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-sm space-y-5">
            <div>
              <label className={labelClass}>Your credit score</label>
              <input
                className={inputClass}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="e.g. 720"
                type="number"
                min="300"
                max="850"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                FICO scores range from 300 to 850. Check Credit Karma, your bank app, or your credit card statements.
              </p>
            </div>

            <div className="border border-border/50 rounded-md p-4 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">score tiers</p>
              {SCORE_TIERS.map((t) => (
                <div key={t.label} className="flex items-center justify-between">
                  <span className="text-xs font-light text-muted-foreground">{t.min}–{t.max}</span>
                  <span className="text-xs font-light text-foreground">{t.label}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Translate my score
            </button>
          </form>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && (
          <ResultsPanel onReset={handleReset} resetLabel="Try a different score">
            <ScoreBar score={submittedScore} />
            <StreamingText
              stream={stream}
              onComplete={() => setPhase("done")}
            />
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
