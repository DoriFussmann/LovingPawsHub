"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import ToolLoader from "@/components/public/tools/ToolLoader";

// ─── Questions ───────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    id: "stage",
    question: "Where are you right now in your homebuying journey?",
    options: [
      "Just starting to think about it — still early",
      "Actively researching — learning everything I can",
      "Ready to start taking action (lenders, agents, showings)",
      "I've started but feel stuck or overwhelmed",
    ],
  },
  {
    id: "reason",
    question: "What's your main reason for being here today?",
    options: [
      "I want to understand the full process from start to finish",
      "I'm trying to figure out if I can actually afford it",
      "I need help with credit, savings, or finances",
      "I don't know where to start — I need a clear roadmap",
    ],
  },
  {
    id: "timeline",
    question: "What's your target timeline to buy?",
    options: [
      "Within the next 3 months",
      "3–6 months from now",
      "6–12 months from now",
      "1–2 years away, or I'm not sure yet",
    ],
  },
  {
    id: "situation",
    question: "What's your current living situation?",
    options: [
      "Renting — my lease gives me flexibility",
      "Renting — I'm locked in for a while",
      "Living with family or friends",
      "I own and need to sell or coordinate timing",
    ],
  },
  {
    id: "concern",
    question: "What's your biggest concern right now?",
    options: [
      "Whether I can actually afford a home in my area",
      "My credit score or financial history",
      "Understanding the process — there's too much I don't know",
      "Finding the right home, neighborhood, or market",
    ],
  },
  {
    id: "lender",
    question: "Have you started talking to a lender or gotten pre-approved?",
    options: [
      "Yes — I'm pre-approved and ready to shop",
      "I've talked to a lender but haven't applied yet",
      "No — I haven't started that process yet",
      "I don't really understand what pre-approval means",
    ],
  },
  {
    id: "help",
    question: "What kind of help are you most hoping to find here?",
    options: [
      "Step-by-step guidance on what to do next",
      "Clear explanations of the financial side — loans, costs, budgets",
      "Honest answers to questions I'm embarrassed to ask",
      "Practical checklists or tools I can act on today",
    ],
  },
];

const LOADER_LABELS = [
  "Mapping your journey…",
  "Finding the right starting points…",
  "Putting it together…",
  "Almost ready…",
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  HUB: "hub",
  FAQ: "faq",
  COMPARISON: "comparison",
  RISK: "risk",
  GUIDE: "guide",
  CORE: "core",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecommendedArticle {
  title: string;
  content_type: string;
  core_id: string;
  bridge_id: string;
  slug: string;
  reason: string;
}

interface JourneyResult {
  assessment: string;
  articles: RecommendedArticle[];
}

type Phase = "quiz" | "loading" | "results" | "error";

// ─── Props ───────────────────────────────────────────────────────────────────

interface JourneyModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JourneyModal({ open, onClose }: JourneyModalProps) {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<JourneyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const progress = (currentQ / QUESTIONS.length) * 100;
  const question = QUESTIONS[currentQ];

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhase("quiz");
      setCurrentQ(0);
      setAnswers({});
      setResult(null);
      setErrorMsg("");
    }
  }, [open]);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleAnswer = useCallback(
    async (option: string) => {
      const newAnswers = { ...answers, [question.question]: option };
      setAnswers(newAnswers);

      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ((q) => q + 1);
        return;
      }

      // Last question — submit
      setPhase("loading");

      try {
        const res = await fetch("/api/tools/journey-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: newAnswers }),
        });

        if (!res.ok) throw new Error("Request failed");

        const data: JourneyResult = await res.json();
        setResult(data);
        setPhase("results");
      } catch {
        setErrorMsg("Something went wrong. Please try again.");
        setPhase("error");
      }
    },
    [answers, currentQ, question]
  );

  const handleBack = useCallback(() => {
    if (currentQ > 0) setCurrentQ((q) => q - 1);
  }, [currentQ]);

  const handleReset = useCallback(() => {
    setPhase("quiz");
    setCurrentQ(0);
    setAnswers({});
    setResult(null);
    setErrorMsg("");
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative bg-background border border-border rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-8">
                <p className="text-[10px] tracking-widest uppercase text-foreground/30 mb-2">
                  your first home journey
                </p>
                <h2 className="text-lg font-light text-foreground leading-snug">
                  Let&apos;s find where to start
                </h2>
              </div>

              {/* Content area */}
              <AnimatePresence mode="wait">
                {/* ── Quiz ── */}
                {phase === "quiz" && (
                  <motion.div
                    key={currentQ}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Progress bar */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] tracking-widest uppercase text-foreground/40">
                          Question {currentQ + 1} of {QUESTIONS.length}
                        </span>
                        <span className="text-[10px] tracking-widest uppercase text-foreground/40">
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

                    <p className="text-base font-light text-foreground mb-6 leading-snug">
                      {question.question}
                    </p>

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

                {/* ── Loading ── */}
                {phase === "loading" && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ToolLoader labels={LOADER_LABELS} />
                  </motion.div>
                )}

                {/* ── Results ── */}
                {phase === "results" && result && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* Assessment */}
                    <div className="bg-muted/30 border border-border rounded-md p-5 mb-6">
                      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
                        your starting point
                      </p>
                      <p className="text-sm font-light text-foreground/90 leading-relaxed">
                        {result.assessment}
                      </p>
                    </div>

                    {/* Article recommendations */}
                    {result.articles.length > 0 && (
                      <div>
                        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">
                          recommended reads for you
                        </p>
                        <div className="space-y-0 divide-y divide-border/40">
                          {result.articles.map((article, i) => (
                            <motion.div
                              key={article.slug}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.1 + i * 0.1 }}
                              className="py-4 first:pt-0 last:pb-0"
                            >
                              <div className="flex items-start gap-3">
                                <span className="shrink-0 mt-0.5 text-[9px] tracking-widest uppercase font-medium text-muted-foreground/50 border border-border/50 rounded px-1.5 py-0.5">
                                  {CONTENT_TYPE_LABELS[article.content_type] ?? article.content_type.toLowerCase()}
                                </span>
                                <div>
                                  <Link
                                    href={`/${article.core_id}/${article.bridge_id}/${article.slug}`}
                                    onClick={onClose}
                                    className="text-sm font-light text-foreground hover:text-foreground/70 transition-colors leading-snug block mb-1"
                                  >
                                    {article.title}
                                  </Link>
                                  <p className="text-[11px] font-light text-muted-foreground italic leading-relaxed">
                                    {article.reason}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reset */}
                    <button
                      onClick={handleReset}
                      className="mt-8 text-xs font-light text-muted-foreground hover:text-foreground transition-colors tracking-wide"
                    >
                      ← Start over
                    </button>
                  </motion.div>
                )}

                {/* ── Error ── */}
                {phase === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="py-8 text-center"
                  >
                    <p className="text-sm font-light text-muted-foreground mb-4">
                      {errorMsg}
                    </p>
                    <button
                      onClick={handleReset}
                      className="text-xs font-light text-foreground hover:text-foreground/70 transition-colors underline underline-offset-4"
                    >
                      Try again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
