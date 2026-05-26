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

// Build month options for the next 3 years
function buildMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 2; i <= 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({ value, label: value });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

interface GoalSnapshot {
  targetDate: string;
  creditRange: string;
  savings: string;
  preApproval: string;
  hasRealtor: string;
  monthsAway: number;
}

function GoalCard({ goal }: { goal: GoalSnapshot }) {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const savingsNum = parseFloat(goal.savings.replace(/,/g, "")) || 0;

  const preApprovalLabel =
    goal.preApproval === "done" ? "Pre-approved" :
    goal.preApproval === "yes" ? "Pre-approval in progress" :
    "Pre-approval not started";

  const realtorLabel =
    goal.hasRealtor === "yes" ? "Have a realtor" :
    goal.hasRealtor === "looking" ? "Looking for a realtor" :
    "No realtor yet";

  return (
    <div className="border border-border/60 rounded-md p-4 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      <div>
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">target move-in</p>
        <p className="text-sm font-light text-foreground">{goal.targetDate}</p>
        <p className="text-[11px] text-muted-foreground">{goal.monthsAway} months from now</p>
      </div>
      <div>
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">credit range</p>
        <p className="text-sm font-light text-foreground">{goal.creditRange}</p>
      </div>
      <div>
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">current savings</p>
        <p className="text-sm font-light text-foreground">{savingsNum > 0 ? fmt(savingsNum) : "—"}</p>
      </div>
      <div>
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">pre-approval</p>
        <p className="text-sm font-light text-foreground">{preApprovalLabel}</p>
      </div>
      <div>
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">realtor</p>
        <p className="text-sm font-light text-foreground">{realtorLabel}</p>
      </div>
    </div>
  );
}

export default function TimelineBuilderPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
  const [goal, setGoal] = useState<GoalSnapshot | null>(null);

  const [targetDate, setTargetDate] = useState(MONTH_OPTIONS[5]?.value ?? "");
  const [creditRange, setCreditRange] = useState("720–759");
  const [savings, setSavings] = useState("");
  const [preApproval, setPreApproval] = useState("no");
  const [hasRealtor, setHasRealtor] = useState("no");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setStream(null);

      // Compute months away from today
      const now = new Date();
      const targetIdx = MONTH_OPTIONS.findIndex((o) => o.value === targetDate);
      const monthsAway = targetIdx >= 0 ? targetIdx + 2 : 6;

      setGoal({ targetDate, creditRange, savings, preApproval, hasRealtor, monthsAway });

      try {
        const res = await fetch("/api/tools/timeline-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetDate,
            creditRange,
            savings: savings.replace(/,/g, ""),
            preApprovalStarted: preApproval === "done" ? "Yes, already approved" : preApproval === "yes" ? "Yes, in progress" : "No",
            hasRealtor: hasRealtor === "yes" ? "Yes" : hasRealtor === "looking" ? "Looking / interviewing" : "No",
          }),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        setPhase("streaming");
        setStream(res.body);
      } catch {
        setPhase("input");
      }
    },
    [targetDate, creditRange, savings, preApproval, hasRealtor]
  );

  const handleReset = useCallback(() => {
    setPhase("input");
    setStream(null);
    setGoal(null);
  }, []);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title="Timeline Builder"
      description="Tell us your goal date and where you stand. Get a month-by-month action plan built for your situation."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Target move-in date</label>
                <select
                  className={inputClass}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                >
                  {MONTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
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
              <div>
                <label className={labelClass}>Current savings</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={savings}
                    onChange={(e) => setSavings(e.target.value)}
                    placeholder="25,000"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Pre-approval started?</label>
                <select
                  className={inputClass}
                  value={preApproval}
                  onChange={(e) => setPreApproval(e.target.value)}
                >
                  <option value="no">Not yet</option>
                  <option value="yes">Yes, in progress</option>
                  <option value="done">Yes, already have it</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Have a realtor?</label>
                <select
                  className={inputClass}
                  value={hasRealtor}
                  onChange={(e) => setHasRealtor(e.target.value)}
                >
                  <option value="no">No</option>
                  <option value="looking">Looking / interviewing</option>
                  <option value="yes">Yes, committed</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Build my plan
            </button>
          </form>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && goal && (
          <ResultsPanel onReset={handleReset} resetLabel="Change my timeline">
            <GoalCard goal={goal} />
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">your month-by-month plan</p>
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
