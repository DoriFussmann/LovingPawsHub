"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { CalcLoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";

// ─── State transfer tax rates (buyer's share) ─────────────────────────────
// Values are percentage of purchase price. 0 = no transfer tax.
const STATE_TRANSFER_TAX: Record<string, { rate: number; note?: string }> = {
  AL: { rate: 0.001 },
  AK: { rate: 0 },
  AZ: { rate: 0 },
  AR: { rate: 0.0033 },
  CA: { rate: 0.0011 },
  CO: { rate: 0.0001 },
  CT: { rate: 0.0075 },
  DC: { rate: 0.011 },
  DE: { rate: 0.02 },
  FL: { rate: 0.007 },
  GA: { rate: 0.001 },
  HI: { rate: 0.002 },
  ID: { rate: 0 },
  IL: { rate: 0.001 },
  IN: { rate: 0 },
  IA: { rate: 0.0016 },
  KS: { rate: 0 },
  KY: { rate: 0.001 },
  LA: { rate: 0 },
  ME: { rate: 0.0044 },
  MD: { rate: 0.005 },
  MA: { rate: 0.00456 },
  MI: { rate: 0.0075 },
  MN: { rate: 0.0033 },
  MS: { rate: 0 },
  MO: { rate: 0 },
  MT: { rate: 0 },
  NE: { rate: 0.00225 },
  NV: { rate: 0.0051 },
  NH: { rate: 0.015 },
  NJ: { rate: 0.01 },
  NM: { rate: 0 },
  NY: { rate: 0.004 },
  NC: { rate: 0.002 },
  ND: { rate: 0 },
  OH: { rate: 0.001 },
  OK: { rate: 0.0075 },
  OR: { rate: 0.001 },
  PA: { rate: 0.01 },
  RI: { rate: 0.0228 },
  SC: { rate: 0.004 },
  SD: { rate: 0 },
  TN: { rate: 0.0037 },
  TX: { rate: 0 },
  UT: { rate: 0 },
  VT: { rate: 0.015 },
  VA: { rate: 0.001 },
  WA: { rate: 0.0128 },
  WV: { rate: 0.0022 },
  WI: { rate: 0.003 },
  WY: { rate: 0 },
};

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DC", "D.C."],
  ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as [string, string][];

// ─── Cost computation ────────────────────────────────────────────────────────

type CostCategory = "Lender fees" | "Title & settlement" | "Prepaid & escrow" | "Taxes & credits";

interface LineItem {
  name: string;
  explanation: string;
  low: number;
  high: number;
  negotiable?: boolean;
  category: CostCategory;
}

const CATEGORIES: CostCategory[] = ["Lender fees", "Title & settlement", "Prepaid & escrow", "Taxes & credits"];

function computeClosingCosts(
  price: number,
  state: string,
  loanType: string,
  firstTimeBuyer: boolean
): LineItem[] {
  const loan = price * 0.9; // assume 10% down for estimates

  const items: LineItem[] = [
    {
      name: "Loan origination fee",
      explanation: "What the lender charges to process and underwrite your loan. Usually 0.5–1% of the loan amount. Negotiate this — it's not fixed.",
      low: loan * 0.005,
      high: loan * 0.01,
      negotiable: true,
      category: "Lender fees",
    },
    {
      name: "Appraisal",
      explanation: "A licensed appraiser inspects the home and gives the bank their own independent opinion of value. Required on almost every purchase.",
      low: 450,
      high: 750,
      category: "Lender fees",
    },
    {
      name: "Credit report fee",
      explanation: "The lender pulls your credit report from all three bureaus and charges you for it. Small but unavoidable.",
      low: 25,
      high: 75,
      category: "Lender fees",
    },
    {
      name: "Title search",
      explanation: "A title company researches the property's ownership history to make sure there are no liens, unpaid taxes, or competing claims to ownership.",
      low: 200,
      high: 400,
      category: "Title & settlement",
    },
    {
      name: "Owner's title insurance",
      explanation: "A one-time premium that protects you (not the bank) if a title problem surfaces after closing. Optional but strongly recommended.",
      low: price * 0.003,
      high: price * 0.005,
      negotiable: true,
      category: "Title & settlement",
    },
    {
      name: "Lender's title insurance",
      explanation: "Required by the bank — this policy protects their investment, not yours. Separate from owner's title insurance.",
      low: loan * 0.002,
      high: loan * 0.004,
      category: "Title & settlement",
    },
    {
      name: "Escrow / settlement fee",
      explanation: "The escrow company or closing attorney coordinates the entire closing — holds funds, prepares documents, and ensures the transfer happens correctly.",
      low: 500,
      high: 1200,
      negotiable: true,
      category: "Title & settlement",
    },
    {
      name: "Recording fees",
      explanation: "The county charges a fee to officially record the deed and mortgage in public records. Varies by county.",
      low: 100,
      high: 350,
      category: "Title & settlement",
    },
    {
      name: "Prepaid interest",
      explanation: "Mortgage interest is paid in arrears, so at closing you pay the interest that accrues from your closing date to the end of that month.",
      low: (loan * 0.0675) / 365 * 1,
      high: (loan * 0.0675) / 365 * 30,
      category: "Prepaid & escrow",
    },
    {
      name: "Homeowners insurance (prepaid)",
      explanation: "Lenders require you to prepay 12 months of homeowners insurance at closing and deposit 2 months into escrow as a cushion.",
      low: price * 0.005 * (14 / 12),
      high: price * 0.008 * (14 / 12),
      category: "Prepaid & escrow",
    },
    {
      name: "Property tax (escrow deposit)",
      explanation: "Your lender collects 2–3 months of estimated property taxes upfront and holds them in escrow to ensure taxes are paid on time.",
      low: (price * 0.008) / 12 * 2,
      high: (price * 0.015) / 12 * 3,
      category: "Prepaid & escrow",
    },
  ];

  // Transfer tax
  const taxInfo = STATE_TRANSFER_TAX[state] ?? { rate: 0.001 };
  if (taxInfo.rate > 0) {
    items.push({
      name: "Transfer tax",
      explanation: `${state} charges a transfer tax when real estate changes hands. This is split between buyer and seller in some states; in others it falls entirely on the buyer.`,
      low: price * taxInfo.rate * 0.5,
      high: price * taxInfo.rate,
      category: "Taxes & credits",
    });
  }

  // Loan-type specific
  if (loanType === "fha") {
    items.push({
      name: "FHA upfront mortgage insurance premium (UFMIP)",
      explanation: "FHA loans require an upfront premium of 1.75% of the loan amount at closing. This can be rolled into the loan, but it still affects your loan balance.",
      low: loan * 0.0175,
      high: loan * 0.0175,
      category: "Lender fees",
    });
  }

  if (loanType === "va") {
    items.push({
      name: "VA funding fee",
      explanation: "VA loans don't require PMI, but the VA charges a one-time funding fee instead. First-time use with no down payment is 2.15% of the loan amount.",
      low: loan * 0.0115,
      high: loan * 0.0215,
      category: "Lender fees",
    });
  }

  // First-time buyer discount
  if (firstTimeBuyer) {
    items.push({
      name: "First-time buyer assistance (potential credit)",
      explanation: "Many states and counties offer closing cost assistance grants or credits for first-time buyers. This is an estimate — check your state HFA website for programs you actually qualify for.",
      low: -7500,
      high: -1500,
      category: "Taxes & credits",
    });
  }

  return items;
}

// ─── Component ───────────────────────────────────────────────────────────────

type Phase = "input" | "loading" | "results";

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";
const labelClass = "block text-xs font-light text-muted-foreground mb-1";

export default function ClosingCostEstimatorPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [items, setItems] = useState<LineItem[]>([]);

  const [price, setPrice] = useState("400000");
  const [state, setState] = useState("CA");
  const [loanType, setLoanType] = useState("conventional");
  const [firstTime, setFirstTime] = useState("yes");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setTimeout(() => {
        const result = computeClosingCosts(
          parseFloat(price.replace(/,/g, "")),
          state,
          loanType,
          firstTime === "yes"
        );
        setItems(result);
        setPhase("results");
      }, 1300);
    },
    [price, state, loanType, firstTime]
  );

  const fmt = (n: number) =>
    Math.abs(n) < 1
      ? "$0"
      : (n < 0 ? "-" : "") +
        Math.abs(n).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });

  const totalLow = items.reduce((s, i) => s + i.low, 0);
  const totalHigh = items.reduce((s, i) => s + i.high, 0);

  // Cash to close = closing costs + 10% down payment (matching the assumption in computeClosingCosts)
  const parsedPrice = parseFloat(price.replace(/,/g, "")) || 0;
  const downPayment = parsedPrice * 0.1;
  const cashToCloseLow = totalLow + downPayment;
  const cashToCloseHigh = totalHigh + downPayment;

  return (
    <ToolShell
      eyebrow="calculator"
      title="Closing Cost Estimator"
      description="Every fee, explained in plain English. No surprises at the closing table."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Purchase price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="400,000"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>State</label>
                <select
                  className={inputClass}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  {US_STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Loan type</label>
                <select
                  className={inputClass}
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                >
                  <option value="conventional">Conventional</option>
                  <option value="fha">FHA</option>
                  <option value="va">VA</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>First-time homebuyer?</label>
                <select
                  className={inputClass}
                  value={firstTime}
                  onChange={(e) => setFirstTime(e.target.value)}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Estimate costs
            </button>
          </form>
        )}

        {phase === "loading" && <CalcLoader />}

        {phase === "results" && (
          <ResultsPanel onReset={() => setPhase("input")} resetLabel="Change inputs">
            {/* Two headline numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">closing costs</p>
                <p className="text-3xl font-extralight tracking-tight">
                  {fmt(totalLow)} – {fmt(totalHigh)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Fees at the closing table only</p>
              </div>
              <div className="border border-foreground/15 rounded-md px-4 py-3">
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">cash to close</p>
                <p className="text-2xl font-extralight tracking-tight">
                  {fmt(cashToCloseLow)} – {fmt(cashToCloseHigh)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Closing costs + 10% down payment ({fmt(downPayment)})
                </p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mb-5">
              These are estimates. Your actual fees will appear on the Loan Estimate within 3 days of applying.
            </p>

            {/* Grouped line items */}
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((item) => item.category === cat);
              if (catItems.length === 0) return null;
              const catLow = catItems.reduce((s, i) => s + i.low, 0);
              const catHigh = catItems.reduce((s, i) => s + i.high, 0);
              return (
                <div key={cat} className="mb-5">
                  <div className="flex items-center justify-between mb-1 pb-1.5 border-b border-border/60">
                    <p className="text-[10px] tracking-widest uppercase text-foreground/50">{cat}</p>
                    <p className="text-[10px] font-light text-muted-foreground whitespace-nowrap">
                      {catLow === catHigh ? fmt(catLow) : `${fmt(catLow)} – ${fmt(catHigh)}`}
                    </p>
                  </div>
                  <div className="space-y-0 divide-y divide-border/30">
                    {catItems.map((item, i) => (
                      <div key={i} className="py-3">
                        <div className="flex items-start justify-between gap-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-light text-foreground">{item.name}</p>
                              {item.negotiable && (
                                <span className="text-[9px] tracking-widest uppercase border border-border/60 text-muted-foreground rounded px-1.5 py-0.5 shrink-0">
                                  negotiable
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {item.explanation}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-light text-foreground whitespace-nowrap">
                              {item.low === item.high ? fmt(item.low) : `${fmt(item.low)} – ${fmt(item.high)}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="mt-2 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-sm font-light text-foreground">Total closing costs</p>
              <p className="text-sm font-light text-foreground">
                {fmt(totalLow)} – {fmt(totalHigh)}
              </p>
            </div>
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
