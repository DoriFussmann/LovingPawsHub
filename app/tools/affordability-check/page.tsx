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

interface AffordabilityStats {
  backEndDTI: number;
  maxPriceByDTI: number;
  downPaymentNeeded: number;
  closingCostsNeeded: number;
  savingsLeft: number;
  monthlyGross: number;
}

function computeStats(grossIncome: number, monthlyDebt: number, savings: number): AffordabilityStats {
  const monthlyGross = grossIncome / 12;
  // Back-end DTI: existing debt as % of gross monthly income (without housing)
  const backEndDTI = monthlyGross > 0 ? (monthlyDebt / monthlyGross) * 100 : 0;

  // Max back-end DTI lenders allow is ~43%. Max housing payment = 43% of gross - existing debt
  const maxHousingPayment = monthlyGross * 0.43 - monthlyDebt;

  // Estimate max price: housing payment covers P&I (at ~7%), taxes (~1.1%/12), insurance (~0.5%/12)
  // Monthly non-P&I = price * (0.011 + 0.005) / 12 = price * 0.00133
  // P&I payment for $1 loan at 7% / 30yr ≈ 0.006653
  // maxHousingPayment = price * 0.9 * 0.006653 + price * 0.00133
  // maxHousingPayment = price * (0.9 * 0.006653 + 0.00133)
  const perDollar = 0.9 * 0.006653 + 0.00133;
  const maxPriceByDTI = perDollar > 0 ? Math.max(0, maxHousingPayment / perDollar) : 0;

  // Savings split: 10% down + 3% closing costs on that max price
  const downPaymentNeeded = maxPriceByDTI * 0.1;
  const closingCostsNeeded = maxPriceByDTI * 0.03;
  const savingsLeft = savings - downPaymentNeeded - closingCostsNeeded;

  return { backEndDTI, maxPriceByDTI, downPaymentNeeded, closingCostsNeeded, savingsLeft, monthlyGross };
}

function StatCard({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-4 ${highlight ? "border-foreground/20 bg-foreground/[0.03]" : "border-border"}`}>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">{label}</p>
      <p className="text-lg font-extralight text-foreground">{value}</p>
      {note && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{note}</p>}
    </div>
  );
}

export default function AffordabilityCheckPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
  const [stats, setStats] = useState<AffordabilityStats | null>(null);

  const [grossIncome, setGrossIncome] = useState("");
  const [monthlyDebt, setMonthlyDebt] = useState("");
  const [savings, setSavings] = useState("");
  const [location, setLocation] = useState("");
  const [creditRange, setCreditRange] = useState("720–759");

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setStream(null);

      const incomeNum = parseFloat(grossIncome.replace(/,/g, "")) || 0;
      const debtNum = parseFloat(monthlyDebt.replace(/,/g, "")) || 0;
      const savingsNum = parseFloat(savings.replace(/,/g, "")) || 0;
      setStats(computeStats(incomeNum, debtNum, savingsNum));

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
    setStats(null);
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

        {(phase === "streaming" || phase === "done") && stats && (
          <ResultsPanel onReset={handleReset} resetLabel="Change inputs">
            {/* Pre-computed snapshot cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
              <StatCard
                label="Max price (DTI rule)"
                value={fmt(stats.maxPriceByDTI)}
                note="Based on 43% back-end DTI at ~7% rate, 10% down"
                highlight
              />
              <StatCard
                label="Back-end DTI (debt only)"
                value={`${stats.backEndDTI.toFixed(1)}%`}
                note={
                  stats.backEndDTI < 20
                    ? "Healthy — gives you room for housing"
                    : stats.backEndDTI < 36
                    ? "Moderate — watch total DTI with housing added"
                    : "High — lenders will scrutinize this"
                }
              />
              <StatCard
                label="Savings after 10% down + closing"
                value={stats.savingsLeft >= 0 ? fmt(stats.savingsLeft) : `–${fmt(Math.abs(stats.savingsLeft))}`}
                note={
                  stats.savingsLeft >= 0
                    ? "Remaining reserve at max price estimate"
                    : "Shortfall at max price — lower price range needed"
                }
              />
            </div>

            <div className="border-t border-border/40 pt-5">
              <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">full assessment</p>
              <StreamingText
                stream={stream}
                onComplete={() => setPhase("done")}
              />
            </div>
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
