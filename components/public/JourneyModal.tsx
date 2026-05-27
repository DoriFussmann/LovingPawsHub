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
    id: "pet_type",
    question: "Are you a cat person, a dog person — or both?",
    options: [
      "Dog person — dogs are my world",
      "Cat person — cats are my world",
      "Both! I have (or want) cats and dogs",
      "I'm thinking about getting my very first pet",
    ],
  },
  {
    id: "current_pets",
    question: "Do you currently have pets at home?",
    options: [
      "Yes — one cat or a few cats",
      "Yes — one dog or a few dogs",
      "Yes — multiple pets (mix of cats, dogs, or others)",
      "Not yet, but I'm seriously considering it",
    ],
  },
  {
    id: "adoption",
    question: "Are you thinking about adopting or getting a new pet soon?",
    options: [
      "I'm actively looking to adopt right now",
      "I'm thinking about it but haven't committed yet",
      "I already have my pet(s) — not looking to add more",
      "Not in my plans at the moment",
    ],
  },
  {
    id: "pet_age",
    question: "What life stage is your pet (or the one you're interested in)?",
    options: [
      "Kitten or puppy — under 1 year old",
      "Young adult — 1 to 4 years old",
      "Adult — 5 to 9 years old",
      "Senior — 10 years and older",
    ],
  },
  {
    id: "concern",
    question: "What's your biggest pet care question right now?",
    options: [
      "Nutrition — what to feed them and how often",
      "Health and vet care — checkups, vaccines, and signs to watch for",
      "Behavior and training — getting them to listen (or just understand them better)",
      "General wellness — keeping them happy, active, and thriving long-term",
    ],
  },
];

const LOADER_LABELS = [
  "Thinking about your pet…",
  "Finding the most relevant articles…",
  "Putting it all together…",
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
                  personalized pet care
                </p>
                <h2 className="text-lg font-light text-foreground leading-snug">
                  Let&apos;s find the right articles for you
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
                        your pet care profile
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
