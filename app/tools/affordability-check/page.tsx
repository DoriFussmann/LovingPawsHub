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

const CREDIT_RANGES = [
  "760+",
  "720–759",
  "680–719",
  "640–679",
  "600–639",
  "580–599",
  "Below 580",
];

export default function AffordabilityCheckPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);

  const [grossIncome, setGrossIncome] = useState("");
  const [monthlyDebt, setMonthlyDebt] = useState("");
  const [savings, setSavings] = useState("");
  const [location, setLocation] = useState("");
  const [creditRange, setCreditRange] = useState("720–759");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setStream(null);

      try {
        const res = await fetch("/api/tools/affordability-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grossIncome: grossIncome.replace(/,/g, ""),
            monthlyDebt: monthlyDebt.replace(/,/g, ""),
            savings: savings.replace(/,/g, ""),
            location,
            creditRange,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        setPhase("streaming");
        setStream(res.body);
      } catch {
        setPhase("input");
      }
    },
    [grossIncome, monthlyDebt, savings, location, creditRange]
  );

  const handleReset = useCallback(() => {
    setPhase("input");
    setStream(null);
  }, []);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title="Affordability Reality Check"
      description="Not just math — an honest assessment of what you can actually afford and where you stand."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Gross annual income</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={grossIncome}
                    onChange={(e) => setGrossIncome(e.target.value)}
                    placeholder="90,000"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Monthly debt payments</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={monthlyDebt}
                    onChange={(e) => setMonthlyDebt(e.target.value)}
                    placeholder="350"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Car, student loans, credit cards (min. payment)</p>
              </div>
              <div>
                <label className={labelClass}>Available savings</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={savings}
                    onChange={(e) => setSavings(e.target.value)}
                    placeholder="40,000"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Total you can put toward down payment + closing costs</p>
              </div>
              <div>
                <label className={labelClass}>Credit score range</label>
                <select
                  className={inputClass}
                  value={creditRange}
                  onChange={(e) => setCreditRange(e.target.value)}
                >
                  {CREDIT_RANGES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Target city / state</label>
                <input
                  className={inputClass}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX or suburbs of Chicago"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Check my affordability
            </button>
          </form>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && (
          <ResultsPanel onReset={handleReset} resetLabel="Change inputs">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">your affordability assessment</p>
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
