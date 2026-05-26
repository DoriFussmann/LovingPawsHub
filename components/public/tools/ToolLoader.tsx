"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToolLoaderProps {
  labels?: string[];
}

const DEFAULT_CALC_LABELS = [
  "Running the numbers…",
  "Crunching your inputs…",
  "Building your breakdown…",
  "Almost there…",
];

const DEFAULT_AI_LABELS = [
  "Thinking through your situation…",
  "Pulling it all together…",
  "Putting it in plain English…",
  "Almost done…",
];

export function CalcLoader() {
  return <ToolLoader labels={DEFAULT_CALC_LABELS} />;
}

export function AILoader() {
  return <ToolLoader labels={DEFAULT_AI_LABELS} />;
}

export default function ToolLoader({ labels = DEFAULT_CALC_LABELS }: ToolLoaderProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const labelInterval = setInterval(() => {
      setStep((s) => (s + 1) % labels.length);
    }, 900);

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        return p + Math.random() * 8 + 2;
      });
    }, 300);

    return () => {
      clearInterval(labelInterval);
      clearInterval(progressInterval);
    };
  }, [labels.length]);

  return (
    <div className="py-12 flex flex-col items-center gap-6">
      <div className="w-full max-w-sm">
        <div className="h-[2px] w-full bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-foreground rounded-full"
            animate={{ width: `${Math.min(progress, 92)}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm font-light text-muted-foreground"
        >
          {labels[step]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
