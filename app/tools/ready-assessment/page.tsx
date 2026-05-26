"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { AILoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";
import StreamingText from "@/components/public/tools/StreamingText";

// ─── Quiz questions ───────────────────────────────────────────────────────────

interface Question {
  id: string;
  question: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    id: "savings_cushion",
    question: "After your down payment and closing costs, how much would you have left in savings?",
    options: [
      "Less than 1 month of expenses",
      "1–3 months of expenses",
      "3–6 months of expenses",
      "More than 6 months of expenses",
    ],
  },
  {
    id: "job_stability",
    question: "How stable is your employment situation right now?",
    options: [
      "Very stable — same employer 2+ years, no concerns",
      "Stable but recently started a new job (under 2 years)",
      "Self-employed or variable income",
      "I have some uncertainty about my employment",
    ],
  },
  {
    id: "credit_health",
    question: "What's your current credit score range?",
    options: [
      "760 or above",
      "700–759",
      "640–699",
      "Below 640",
    ],
  },
  {
    id: "debt_load",
    question: "What does your current monthly debt look like (car, student loans, credit cards)?",
    options: [
      "Less than 10% of my monthly gross income",
      "10–20% of my monthly gross income",
      "20–35% of my monthly gross income",
      "Over 35% — it's a lot",
    ],
  },
  {
    id: "timeline",
    question: "How flexible is your move-in timeline?",
    options: [
      "Very flexible — I'm targeting a window, not a hard date",
      "Somewhat flexible — within a few months",
      "Pretty fixed — I have a lease ending or a specific need",
      "Very fixed — I need to move by a specific date",
    ],
  },
  {
    id: "emotional_readiness",
    question: "How do you feel about being a homeowner right now?",
    options: [
      "Excited and ready — I've thought this through",
      "Mostly ready, some nerves about the financial commitment",
      "Uncertain — I'm not sure if it's the right time",
      "Mostly buying because I feel like I should, not because I want to",
    ],
  },
  {
    id: "local_market",
    question: "How well do you know the local market you want to buy in?",
    options: [
      "Very well — I've been researching for months",
      "Somewhat — I have a general sense of prices",
      "Not much — I'm early in the process",
      "I haven't picked a specific market yet",
    ],
  },
  {
    id: "down_payment",
    question: "What's your realistic down payment as a percent of the homes you're looking at?",
    options: [
      "20% or more",
      "10–19%",
      "5–9%",
      "Less than 5% (FHA, VA, or down payment assistance)",
    ],
  },
  {
    id: "housing_costs",
    question: "What would your estimated monthly housing costs be relative to your take-home pay?",
    options: [
      "Under 25% — very comfortable",
      "25–30% — manageable",
      "31–40% — a stretch but doable",
      "Over 40% — it's tight",
    ],
  },
  {
    id: "knowledge",
    question: "How familiar are you with the homebuying process itself?",
    options: [
      "Very familiar — I know what pre-approval, escrow, title, and DTI mean",
      "Somewhat — I understand the basics",
      "Not very — I know I need to get a mortgage but the details are fuzzy",
      "I'm starting from scratch",
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

type Phase = "quiz" | "loading" | "streaming" | "done";

export default function ReadyAssessmentPage() {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);

  const question = QUESTIONS[currentQ];
  const progress = (currentQ / QUESTIONS.length) * 100;

  const handleAnswer = useCallback(
    async (option: string) => {
      const newAnswers = { ...answers, [question.question]: option };
      setAnswers(newAnswers);

      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ((q) => q + 1);
      } else {
        // All questions answered — submit
        setPhase("loading");
        setStream(null);

        try {
          const res = await fetch("/api/tools/ready-assessment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: newAnswers }),
          });

          if (!res.ok || !res.body) throw new Error("Request failed");

          setPhase("streaming");
          setStream(res.body);
        } catch {
          setPhase("quiz");
        }
      }
    },
    [answers, currentQ, question]
  );

  const handleReset = useCallback(() => {
    setPhase("quiz");
    setCurrentQ(0);
    setAnswers({});
    setStream(null);
  }, []);

  const handleBack = useCallback(() => {
    if (currentQ > 0) setCurrentQ((q) => q - 1);
  }, [currentQ]);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title='"Am I Ready?" Assessment'
      description="10 questions. An honest verdict on where you actually stand."
    >
      <AnimatePresence mode="wait">
        {phase === "quiz" && (
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="max-w-xl"
          >
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] tracking-widests uppercase text-foreground/40">
                  Question {currentQ + 1} of {QUESTIONS.length}
                </span>
                <span className="text-[10px] tracking-widests uppercase text-foreground/40">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-[2px] w-full bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-foreground rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <h2 className="text-base md:text-lg font-light text-foreground mb-6 leading-snug">
              {question.question}
            </h2>

            <div className="space-y-2.5">
              {question.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className="w-full text-left border border-border rounded-md px-4 py-3 text-sm font-light text-foreground hover:border-foreground/40 hover:bg-muted/40 transition-all"
                >
                  {option}
                </button>
              ))}
            </div>

            {currentQ > 0 && (
              <button
                onClick={handleBack}
                className="mt-5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            )}
          </motion.div>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && (
          <ResultsPanel onReset={handleReset} resetLabel="Retake the assessment">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">your readiness verdict</p>
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
