"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { AILoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";
import StreamingText from "@/components/public/tools/StreamingText";

// ─── Questions ────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    id: "housing",
    question: "What's your current living situation?",
    options: [
      "Own a house with a yard",
      "Rent a house or townhome",
      "Own or rent an apartment — pet-friendly confirmed",
      "Renting — haven't checked my lease yet",
    ],
  },
  {
    id: "time_alone",
    question: "How many hours per day would your pet be home alone?",
    options: [
      "Under 4 hours — I work from home or part-time",
      "4–6 hours on a typical day",
      "7–9 hours regularly",
      "More than 9 hours most days",
    ],
  },
  {
    id: "budget",
    question: "How confident are you in your ability to cover ongoing pet costs ($1,000–$3,000+/year)?",
    options: [
      "Very comfortable — I've budgeted for it",
      "Comfortable enough — I can manage",
      "It would be a stretch, but doable",
      "I'm not sure I can afford it consistently",
    ],
  },
  {
    id: "emergency_fund",
    question: "Could you cover an unexpected vet bill of $1,000–$3,000?",
    options: [
      "Yes, I have savings set aside or pet insurance",
      "Probably — I'd find a way",
      "It would be very difficult",
      "No — that would be a real hardship",
    ],
  },
  {
    id: "experience",
    question: "What's your experience with pet ownership?",
    options: [
      "Experienced — I've owned pets as an adult before",
      "Some experience growing up, but first time as the primary caretaker",
      "No direct experience, but I've done a lot of research",
      "This is completely new territory for me",
    ],
  },
  {
    id: "activity",
    question: "How active are you on a typical day?",
    options: [
      "Very active — daily exercise, outdoor activities",
      "Moderately active — regular walks, some outdoor time",
      "Mostly sedentary — I prefer low-key activities",
      "It varies a lot depending on the week",
    ],
  },
  {
    id: "household",
    question: "Who lives in your household?",
    options: [
      "Just me — I make all the decisions",
      "Partner or roommate — both on board with getting a pet",
      "Family with children — kids are excited",
      "Family with children — still working out the logistics",
    ],
  },
  {
    id: "travel",
    question: "How often do you travel or spend nights away from home?",
    options: [
      "Rarely — a few nights a year at most",
      "Occasionally — maybe once a month",
      "Frequently — multiple times a month",
      "Very frequently — often more than a week at a time",
    ],
  },
  {
    id: "long_term",
    question: "How stable is your living situation for the next 5–10 years?",
    options: [
      "Very stable — no major moves or life changes expected",
      "Fairly stable — some changes possible but manageable",
      "Somewhat uncertain — job or move possible in the next few years",
      "Quite uncertain — my life situation could change significantly",
    ],
  },
  {
    id: "reason",
    question: "What's driving your decision to get a pet right now?",
    options: [
      "I've wanted one for a long time and I'm ready",
      "I'm lonely or looking for companionship",
      "I saw a specific animal and fell in love",
      "Someone else in my household is pushing for it",
    ],
  },
];

const QUESTION_SHORT_LABELS: Record<string, string> = {
  housing: "Living situation",
  time_alone: "Hours home alone",
  budget: "Annual cost confidence",
  emergency_fund: "Emergency vet fund",
  experience: "Prior pet experience",
  activity: "Activity level",
  household: "Household",
  travel: "Travel frequency",
  long_term: "Life stability",
  reason: "Motivation",
};

// ─── Component ────────────────────────────────────────────────────────────────

type Phase = "quiz" | "loading" | "streaming" | "done";

export default function AdoptionReadinessPage() {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  const question = QUESTIONS[currentQ];
  const progress = (currentQ / QUESTIONS.length) * 100;

  const handleAnswer = useCallback(
    async (option: string) => {
      const newAnswers = { ...answers, [question.question]: option };
      setAnswers(newAnswers);

      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ((q) => q + 1);
      } else {
        setPhase("loading");
        setStream(null);

        try {
          const res = await fetch("/api/tools/adoption-readiness", {
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
    setShowAnswers(false);
  }, []);

  const handleBack = useCallback(() => {
    if (currentQ > 0) setCurrentQ((q) => q - 1);
  }, [currentQ]);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title='"Am I Ready?" Pet Quiz'
      description="10 questions. An honest verdict on whether your lifestyle and situation are a real fit for a new pet."
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
          <ResultsPanel onReset={handleReset} resetLabel="Retake the quiz">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">your readiness verdict</p>
            <StreamingText stream={stream} onComplete={() => setPhase("done")} />

            {phase === "done" && (
              <div className="mt-8 border-t border-border/40 pt-5">
                <button
                  onClick={() => setShowAnswers((v) => !v)}
                  className="flex items-center gap-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{showAnswers ? "▲" : "▼"}</span>
                  <span>{showAnswers ? "Hide" : "Review"} your answers</span>
                </button>

                {showAnswers && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 divide-y divide-border/40"
                  >
                    {QUESTIONS.map((q) => {
                      const answer = answers[q.question];
                      if (!answer) return null;
                      return (
                        <div key={q.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-6">
                          <p className="text-[11px] font-light text-muted-foreground shrink-0 sm:w-48">
                            {QUESTION_SHORT_LABELS[q.id] ?? q.id}
                          </p>
                          <p className="text-[11px] font-light text-foreground">{answer}</p>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            )}
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
