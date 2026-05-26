"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { CalcLoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";

// ─── Math ────────────────────────────────────────────────────────────────────

interface RvBResult {
  breakEvenYear: number | null;
  buyTotalCost: number;
  rentTotalCost: number;
  winnerIsBuy: boolean;
  yearlyData: { year: number; buyCumulative: number; rentCumulative: number }[];
  closingCosts: number;
  homeValueAtEnd: number;
  loanAmountStart: number;
  conclusion: string;
}

function calcMonthlyPI(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function computeRvB(
  monthlyRent: number,
  homePrice: number,
  downPct: number,
  annualRate: number,
  yearsInHome: number,
  annualAppreciation: number,
  investmentReturn: number,
  effectiveTaxRate: number
): RvBResult {
  const downAmt = homePrice * (downPct / 100);
  const loanAmount = homePrice - downAmt;
  const termMonths = 30 * 12;
  const r = annualRate / 100 / 12;
  const monthlyPI = calcMonthlyPI(loanAmount, annualRate, termMonths);

  // Closing costs ~3% to start
  const closingCosts = homePrice * 0.03;

  // Annual carrying costs
  const annualTax = homePrice * 0.011;
  const annualInsurance = homePrice * 0.005;
  const annualMaintenance = homePrice * 0.01;
  const pmi = downPct < 20 ? (loanAmount * 0.0085) / 12 : 0;

  // Track loan balance
  let balance = loanAmount;
  let buyTotalCost = downAmt + closingCosts;
  let rentTotalCost = 0;

  // Investment portfolio — what the down payment would have become
  let investmentPortfolio = downAmt;

  const yearlyData: { year: number; buyCumulative: number; rentCumulative: number }[] = [];
  let breakEvenYear: number | null = null;

  for (let year = 1; year <= yearsInHome; year++) {
    for (let m = 0; m < 12; m++) {
      const interestPaid = balance * r;
      const principalPaid = monthlyPI - interestPaid;
      balance = Math.max(0, balance - principalPaid);

      // Tax deduction benefit (only interest portion)
      const monthlyTaxBenefit = interestPaid * (effectiveTaxRate / 100);

      const monthlyBuyCost =
        monthlyPI +
        pmi +
        (annualTax + annualInsurance + annualMaintenance) / 12 -
        monthlyTaxBenefit;

      buyTotalCost += monthlyBuyCost;

      // Rent grows at 3% per year
      const currentRent = monthlyRent * Math.pow(1.03, year - 1);
      rentTotalCost += currentRent;

      // Investment portfolio grows each month
      investmentPortfolio *= 1 + investmentReturn / 100 / 12;
      // Renter also invests the delta between buying costs and rent
    }

    // Home value at this point
    const currentHomeValue = homePrice * Math.pow(1 + annualAppreciation / 100, year);
    // Selling costs ~6% when you sell
    const sellProceeds = currentHomeValue * 0.94 - balance;

    // Net buy cost = total paid in - what you get back
    const netBuyCost = buyTotalCost - Math.max(0, sellProceeds);

    // Renter's net cost = rent paid - investment growth on down payment
    const investmentGain = investmentPortfolio - downAmt;
    const netRentCost = rentTotalCost - investmentGain;

    yearlyData.push({
      year,
      buyCumulative: netBuyCost,
      rentCumulative: netRentCost,
    });

    if (breakEvenYear === null && netBuyCost < netRentCost) {
      breakEvenYear = year;
    }
  }

  const lastYear = yearlyData[yearlyData.length - 1];
  const winnerIsBuy = lastYear.buyCumulative < lastYear.rentCumulative;

  let conclusion: string;
  if (winnerIsBuy && breakEvenYear !== null) {
    const margin = Math.abs(lastYear.rentCumulative - lastYear.buyCumulative);
    conclusion = `Over ${yearsInHome} years, buying comes out ahead by roughly ${margin.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}. You hit the break-even point around year ${breakEvenYear}. The longer you stay, the more the math tips toward buying.`;
  } else if (!winnerIsBuy) {
    const margin = Math.abs(lastYear.buyCumulative - lastYear.rentCumulative);
    conclusion = `Over ${yearsInHome} years with your numbers, renting and investing the difference comes out ahead by about ${margin.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}. ${breakEvenYear ? `Buying would catch up around year ${breakEvenYear} — if you stayed longer.` : "At your appreciation and investment return assumptions, buying never crosses over in this window."} That doesn't mean don't buy — but it does mean the financial case is weaker than the conventional wisdom suggests.`;
  } else {
    conclusion = `Buying comes out ahead, but only slightly. The two scenarios are close enough that personal factors — stability, flexibility, how much you value owning — matter more than the math.`;
  }

  const homeValueAtEnd = homePrice * Math.pow(1 + annualAppreciation / 100, yearsInHome);

  return {
    breakEvenYear,
    buyTotalCost: lastYear.buyCumulative,
    rentTotalCost: lastYear.rentCumulative,
    winnerIsBuy,
    yearlyData,
    closingCosts,
    homeValueAtEnd,
    loanAmountStart: loanAmount,
    conclusion,
  };
}

// ─── Simple comparison bar chart ─────────────────────────────────────────────

function ComparisonChart({
  data,
  years,
}: {
  data: { year: number; buyCumulative: number; rentCumulative: number }[];
  years: number;
}) {
  const W = 500, H = 160, padLeft = 44, padBottom = 24, padTop = 12, padRight = 10;
  const plotW = W - padLeft - padRight;
  const plotH = H - padBottom - padTop;

  const allVals = data.flatMap((d) => [d.buyCumulative, d.rentCumulative]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const toX = (yr: number) => padLeft + ((yr - 1) / (years - 1 || 1)) * plotW;
  const toY = (v: number) => padTop + plotH - ((v - minV) / range) * plotH;

  const buyPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(d.year)},${toY(d.buyCumulative)}`).join(" ");
  const rentPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(d.year)},${toY(d.rentCumulative)}`).join(" ");

  const yTicks = [minV, (minV + maxV) / 2, maxV];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={padLeft} y1={toY(v)} x2={W - padRight} y2={toY(v)} stroke="#e5e5e5" strokeWidth={0.5} />
          <text x={padLeft - 4} y={toY(v) + 3} fontSize={8} textAnchor="end" fill="#737373">
            {v < 0 ? "-" : ""}{Math.abs(v / 1000).toFixed(0)}k
          </text>
        </g>
      ))}
      {data.filter((d) => d.year % (years > 15 ? 5 : years > 8 ? 2 : 1) === 0).map((d) => (
        <text key={d.year} x={toX(d.year)} y={H - 6} fontSize={8} textAnchor="middle" fill="#737373">
          Yr {d.year}
        </text>
      ))}
      <path d={buyPath} fill="none" stroke="#0f0f0f" strokeWidth={1.5} />
      <path d={rentPath} fill="none" stroke="#a3a3a3" strokeWidth={1.5} strokeDasharray="4 2" />
      <circle cx={W - padRight - 8} cy={16} r={3} fill="#0f0f0f" />
      <text x={W - padRight} y={20} fontSize={8} fill="#737373">Buy (net)</text>
      <line x1={W - padRight - 12} y1={28} x2={W - padRight - 4} y2={28} stroke="#a3a3a3" strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={W - padRight} y={32} fontSize={8} fill="#737373">Rent (net)</text>
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

type Phase = "input" | "loading" | "results";

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";
const labelClass = "block text-xs font-light text-muted-foreground mb-1";

export default function RentVsBuyPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<RvBResult | null>(null);

  const [rent, setRent] = useState("2500");
  const [homePrice, setHomePrice] = useState("400000");
  const [downPct, setDownPct] = useState("10");
  const [rate, setRate] = useState("6.75");
  const [years, setYears] = useState("7");
  const [appreciation, setAppreciation] = useState("3");
  const [investReturn, setInvestReturn] = useState("7");
  const [taxRate, setTaxRate] = useState("22");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setTimeout(() => {
        const r = computeRvB(
          parseFloat(rent.replace(/,/g, "")),
          parseFloat(homePrice.replace(/,/g, "")),
          parseFloat(downPct),
          parseFloat(rate),
          parseInt(years),
          parseFloat(appreciation),
          parseFloat(investReturn),
          parseFloat(taxRate)
        );
        setResult(r);
        setPhase("results");
      }, 1400);
    },
    [rent, homePrice, downPct, rate, years, appreciation, investReturn, taxRate]
  );

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <ToolShell
      eyebrow="calculator"
      title="Rent vs. Buy (Honest Edition)"
      description="The real math over your timeline. If renting wins, this will say so."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Current monthly rent</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input className={inputClass + " pl-6"} value={rent} onChange={(e) => setRent(e.target.value)} placeholder="2,500" required />
                </div>
              </div>
              <div>
                <label className={labelClass}>Target home price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input className={inputClass + " pl-6"} value={homePrice} onChange={(e) => setHomePrice(e.target.value)} placeholder="400,000" required />
                </div>
              </div>
              <div>
                <label className={labelClass}>Down payment (%)</label>
                <div className="relative">
                  <input className={inputClass + " pr-6"} value={downPct} onChange={(e) => setDownPct(e.target.value)} placeholder="10" required />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Interest rate (%)</label>
                <div className="relative">
                  <input className={inputClass + " pr-6"} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="6.75" required />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Years you plan to stay</label>
                <input className={inputClass} value={years} onChange={(e) => setYears(e.target.value)} placeholder="7" required />
              </div>
              <div>
                <label className={labelClass}>Expected annual appreciation (%)</label>
                <div className="relative">
                  <input className={inputClass + " pr-6"} value={appreciation} onChange={(e) => setAppreciation(e.target.value)} placeholder="3" required />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Investment return if renting (%)</label>
                <div className="relative">
                  <input className={inputClass + " pr-6"} value={investReturn} onChange={(e) => setInvestReturn(e.target.value)} placeholder="7" required />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Effective tax rate (%)</label>
                <div className="relative">
                  <input className={inputClass + " pr-6"} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="22" required />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Buying costs include closing costs, mortgage P&I, taxes, insurance, and maintenance. Renting costs include rent (growing 3%/yr) minus investment returns on the down payment.
            </p>
            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Run the numbers
            </button>
          </form>
        )}

        {phase === "loading" && <CalcLoader />}

        {phase === "results" && result && (
          <ResultsPanel onReset={() => setPhase("input")} resetLabel="Change inputs">
            <div className="mb-6">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-light mb-4 ${
                result.winnerIsBuy
                  ? "bg-foreground text-background"
                  : "border border-border text-foreground"
              }`}>
                {result.winnerIsBuy ? "Buying wins" : "Renting wins"} over {years} years
              </div>
              <p className="text-sm font-light text-foreground leading-relaxed max-w-2xl">
                {result.conclusion}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">net buy cost</p>
                <p className="text-lg font-extralight">{fmt(result.buyTotalCost)}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">net rent cost</p>
                <p className="text-lg font-extralight">{fmt(result.rentTotalCost)}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">break-even year</p>
                <p className="text-lg font-extralight">
                  {result.breakEvenYear ? `Year ${result.breakEvenYear}` : "Beyond window"}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">home value then</p>
                <p className="text-lg font-extralight">{fmt(result.homeValueAtEnd)}</p>
              </div>
            </div>

            <ComparisonChart data={result.yearlyData} years={parseInt(years)} />

            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
              Net costs account for equity built, investment returns on the down payment alternative, and selling costs (~6%). This is a simplified model — it doesn't include your specific tax situation, rent control, or local market conditions.
            </p>
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
