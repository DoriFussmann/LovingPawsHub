"use client";

import { motion } from "framer-motion";

interface ResultsPanelProps {
  children: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

export default function ResultsPanel({
  children,
  onReset,
  resetLabel = "Start over",
}: ResultsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="border-t border-border/40 pt-10 mt-2">
        <div className="bg-muted/30 border border-border rounded-md p-6 md:p-8">
          {children}
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-6 text-xs font-light text-muted-foreground hover:text-foreground transition-colors tracking-wide"
          >
            ← {resetLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
