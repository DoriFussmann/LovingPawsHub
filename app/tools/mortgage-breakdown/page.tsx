"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { CalcLoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";

// ─── Math ────────────────────────────────────────────────────────────────────

function calcMonthlyPI(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

interface Breakdown {
  principal: number;
  interest: number;
  pmi: number;
  taxes: number;
  insurance: number;
  total: number;
  loanAmount: number;
  downPaymentAmt: number;
  downPct: number;
  termMonths: number;
  annualRate: number;
}

function compute(
  homePrice: number,
  downPct: number,
  annualRate: number,
  termYears: number
): Breakdown {
  const downPaymentAmt = homePrice * (downPct / 100);
  const loanAmount = homePrice - downPaymentAmt;
  const termMonths = termYears * 12;
  const monthlyPI = calcMonthlyPI(loanAmount, annualRate, termMonths);

  // First month split
  const r = annualRate / 100 / 12;
  const firstInterest = loanAmount * r;
  const firstPrincipal = monthlyPI - firstInterest;

  const pmi = downPct < 20 ? (loanAmount * 0.0085) / 12 : 0;
  const taxes = (homePrice * 0.011) / 12;
  const insurance = (homePrice * 0.005) / 12;

  const total = monthlyPI + pmi + taxes + insurance;

  return {
    principal: firstPrincipal,
    interest: firstInterest,
    pmi,
    taxes,
    insurance,
    total,
    loanAmount,
    downPaymentAmt,
    downPct,
    termMonths,
    annualRate,
  };
}

// ─── Amortization ────────────────────────────────────────────────────────────

interface AmortPoint {
  month: number;
  balance: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
}

function buildAmortization(loanAmount: number, annualRate: number, termMonths: number): AmortPoint[] {
  const r = annualRate / 100 / 12;
  const payment = calcMonthlyPI(loanAmount, annualRate, termMonths);
  let balance = loanAmount;
  let cumPrincipal = 0;
  let cumInterest = 0;
  const points: AmortPoint[] = [{ month: 0, balance, cumulativePrincipal: 0, cumulativeInterest: 0 }];

  for (let m = 1; m <= termMonths; m++) {
    const interestPart = balance * r;
    const principalPart = payment - interestPart;
    balance = Math.max(0, balance - principalPart);
    cumPrincipal += principalPart;
    cumInterest += interestPart;
    if (m % 12 === 0 || m === termMonths) {
      points.push({ month: m, balance, cumulativePrincipal: cumPrincipal, cumulativeInterest: cumInterest });
    }
  }
  return points;
}

// ─── SVG Donut ───────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  label: string;
  color: string;
}

function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const cx = 80, cy = 80, r = 60, strokeWidth = 20;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const fraction = seg.value / total;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const arc = { ...seg, dash, gap, offset };
    offset += dash;
    return arc;
  });

  return (
    <svg viewBox="0 0 160 160" className="w-36 h-36 -rotate-90">
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset}
        />
      ))}
    </svg>
  );
}

// ─── Amortization SVG Chart ──────────────────────────────────────────────────

function AmortChart({ points, loanAmount }: { points: AmortPoint[]; loanAmount: number }) {
  const W = 500, H = 160, padLeft = 40, padBottom = 20, padTop = 10, padRight = 10;
  const plotW = W - padLeft - padRight;
  const plotH = H - padBottom - padTop;
  const maxMonth = points[points.length - 1].month;

  const toX = (m: number) => padLeft + (m / maxMonth) * plotW;
  const toY = (v: number) => padTop + plotH - (v / loanAmount) * plotH;

  const balancePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.month)},${toY(p.balance)}`).join(" ");
  const cumIntPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.month)},${toY(p.cumulativeInterest)}`).join(" ");

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: toY(f * loanAmount),
    label: `$${Math.round((f * loanAmount) / 1000)}k`,
  }));

  const xLabels = points
    .filter((p) => p.month % (maxMonth > 240 ? 120 : 60) === 0 && p.month > 0)
    .map((p) => ({ x: toX(p.month), label: `Yr ${p.month / 12}` }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yLabels.map((l) => (
        <g key={l.label}>
          <line x1={padLeft} y1={l.y} x2={W - padRight} y2={l.y} stroke="#e5e5e5" strokeWidth={0.5} />
          <text x={padLeft - 4} y={l.y + 3} fontSize={8} textAnchor="end" fill="#737373">
            {l.label}
          </text>
        </g>
      ))}
      {xLabels.map((l) => (
        <text key={l.label} x={l.x} y={H - 4} fontSize={8} textAnchor="middle" fill="#737373">
          {l.label}
        </text>
      ))}
      <path d={balancePath} fill="none" stroke="#0f0f0f" strokeWidth={1.5} />
      <path d={cumIntPath} fill="none" stroke="#d4d4d4" strokeWidth={1.5} strokeDasharray="4 2" />
      <g>
        <circle cx={padLeft + plotW - 6} cy={16} r={4} fill="#0f0f0f" />
        <text x={padLeft + plotW + 2} y={20} fontSize={8} fill="#737373">Remaining balance</text>
      </g>
      <g>
        <line x1={padLeft + plotW - 10} y1={28} x2={padLeft + plotW - 2} y2={28} stroke="#d4d4d4" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={padLeft + plotW + 2} y={32} fontSize={8} fill="#737373">Cumulative interest</text>
      </g>
    </svg>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";

const labelClass = "block text-xs font-light text-muted-foreground mb-1";

// ─── Component ───────────────────────────────────────────────────────────────

type Phase = "input" | "loading" | "results";

export default function MortgageBreakdownPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<Breakdown | null>(null);
  const [activeTab, setActiveTab] = useState<"breakdown" | "amortization">("breakdown");

  const [homePrice, setHomePrice] = useState("400000");
  const [downPct, setDownPct] = useState("10");
  const [rate, setRate] = useState("6.75");
  const [termYears, setTermYears] = useState("30");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setTimeout(() => {
        const r = compute(
          parseFloat(homePrice.replace(/,/g, "")),
          parseFloat(downPct),
          parseFloat(rate),
          parseInt(termYears)
        );
        setResult(r);
        setPhase("results");
      }, 1200);
    },
    [homePrice, downPct, rate, termYears]
  );

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const fmtDec = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  const COLORS = ["#0f0f0f", "#525252", "#a3a3a3", "#d4d4d4"];

  return (
    <ToolShell
      eyebrow="calculator"
      title="Mortgage Payment Breakdown"
      description="See exactly where your monthly payment goes every month."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Home price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={homePrice}
                    onChange={(e) => setHomePrice(e.target.value)}
                    placeholder="400,000"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Down payment (%)</label>
                <div className="relative">
                  <input
                    className={inputClass + " pr-6"}
                    value={downPct}
                    onChange={(e) => setDownPct(e.target.value)}
                    placeholder="10"
                    min="0"
                    max="100"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Interest rate (%)</label>
                <div className="relative">
                  <input
                    className={inputClass + " pr-6"}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="6.75"
                    step="0.01"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Loan term</label>
                <select
                  className={inputClass}
                  value={termYears}
                  onChange={(e) => setTermYears(e.target.value)}
                >
                  <option value="30">30 years</option>
                  <option value="20">20 years</option>
                  <option value="15">15 years</option>
                  <option value="10">10 years</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Calculate
            </button>
          </form>
        )}

        {phase === "loading" && <CalcLoader />}

        {phase === "results" && result && (
          <ResultsPanel onReset={() => setPhase("input")} resetLabel="Change inputs">
            <div className="mb-6">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">monthly payment</p>
              <p className="text-3xl font-extralight tracking-tight">{fmtDec(result.total)}</p>
              <p className="text-xs font-light text-muted-foreground mt-1">
                {fmt(result.downPaymentAmt)} down · {fmt(result.loanAmount)} loan · {termYears}-year fixed
              </p>
            </div>

            <div className="flex gap-2 mb-6 border-b border-border">
              {(["breakdown", "amortization"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-light pb-2 mr-2 tracking-wide border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "breakdown" ? "Payment breakdown" : "Amortization curve"}
                </button>
              ))}
            </div>

            {activeTab === "breakdown" && (
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <DonutChart
                  segments={[
                    { value: result.principal, label: "Principal", color: COLORS[0] },
                    { value: result.interest, label: "Interest", color: COLORS[1] },
                    ...(result.pmi > 0
                      ? [{ value: result.pmi, label: "PMI", color: COLORS[2] }]
                      : []),
                    { value: result.taxes, label: "Taxes", color: COLORS[result.pmi > 0 ? 3 : 2] },
                    { value: result.insurance, label: "Insurance", color: "#e5e5e5" },
                  ]}
                />
                <div className="flex-1 space-y-3">
                  {[
                    { label: "Principal", value: result.principal, note: "Equity you're building" },
                    { label: "Interest", value: result.interest, note: "Cost of borrowing" },
                    ...(result.pmi > 0
                      ? [{ label: "PMI", value: result.pmi, note: "Required until you reach 20% equity" }]
                      : []),
                    { label: "Est. property taxes", value: result.taxes, note: "~1.1% annually, varies by county" },
                    { label: "Est. homeowners insurance", value: result.insurance, note: "~0.5% annually, varies by insurer" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5"
                          style={{ background: COLORS[Math.min(i, COLORS.length - 1)] }}
                        />
                        <div>
                          <p className="text-sm font-light text-foreground">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.note}</p>
                        </div>
                      </div>
                      <p className="text-sm font-light text-foreground shrink-0">{fmtDec(item.value)}</p>
                    </div>
                  ))}
                  {result.pmi > 0 && (
                    <p className="text-[11px] text-muted-foreground border border-border/60 rounded-md px-3 py-2 mt-2">
                      PMI drops off once your balance reaches 80% of the original purchase price — roughly at month{" "}
                      {Math.round(
                        (result.termMonths *
                          Math.log(0.8) /
                          Math.log(1 - (result.annualRate / 100 / 12) * (result.loanAmount / (result.total - result.pmi - result.taxes - result.insurance))) || result.termMonths * 0.3)
                      )}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "amortization" && (() => {
              const points = buildAmortization(result.loanAmount, result.annualRate, result.termMonths);
              const lastPoint = points[points.length - 1];
              return (
                <div className="space-y-4">
                  <AmortChart points={points} loanAmount={result.loanAmount} />
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">loan amount</p>
                      <p className="text-base font-light">{fmt(result.loanAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">total interest</p>
                      <p className="text-base font-light">{fmt(lastPoint.cumulativeInterest)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">total paid</p>
                      <p className="text-base font-light">{fmt(result.loanAmount + lastPoint.cumulativeInterest)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
