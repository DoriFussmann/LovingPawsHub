"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { CalcLoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type PetType = "dog_small" | "dog_medium" | "dog_large" | "dog_giant" | "cat" | "rabbit" | "bird";
type PetAge = "young" | "adult" | "senior";
type LocationTier = "rural" | "suburban" | "urban" | "major_city";

interface CostCategory {
  label: string;
  amount: number;
  note: string;
}

interface CostResult {
  categories: CostCategory[];
  annualTotal: number;
  monthlyBudget: number;
  petType: PetType;
  petAge: PetAge;
}

// ─── Cost tables ─────────────────────────────────────────────────────────────

const BASE_COSTS: Record<PetType, Record<string, number>> = {
  dog_small: {
    food: 500, vet_routine: 300, emergency_fund: 400,
    grooming: 450, boarding: 650, supplies_toys: 200, license: 35,
  },
  dog_medium: {
    food: 700, vet_routine: 350, emergency_fund: 500,
    grooming: 350, boarding: 800, supplies_toys: 200, license: 35,
  },
  dog_large: {
    food: 1000, vet_routine: 400, emergency_fund: 600,
    grooming: 500, boarding: 950, supplies_toys: 250, license: 35,
  },
  dog_giant: {
    food: 1400, vet_routine: 500, emergency_fund: 800,
    grooming: 700, boarding: 1150, supplies_toys: 300, license: 35,
  },
  cat: {
    food: 400, vet_routine: 250, emergency_fund: 350,
    grooming: 100, litter: 220, boarding: 420, supplies_toys: 150,
  },
  rabbit: {
    food: 250, vet_routine: 200, emergency_fund: 300,
    hay: 200, bedding: 150, boarding: 200, supplies: 150,
  },
  bird: {
    food: 250, vet_routine: 180, emergency_fund: 250,
    supplies: 200, boarding: 150,
  },
};

const LOCATION_MULTIPLIERS: Record<LocationTier, number> = {
  rural: 0.85,
  suburban: 1.0,
  urban: 1.18,
  major_city: 1.38,
};

// Senior pets cost more in vet care; young pets have higher first-year costs (vaccinations etc.)
const AGE_VET_ADJUSTMENTS: Record<PetAge, number> = {
  young: 1.3,
  adult: 1.0,
  senior: 1.6,
};

const CATEGORY_NOTES: Record<string, string> = {
  food: "Includes regular meals; varies significantly by brand and diet type",
  vet_routine: "Annual wellness exams, vaccines, heartworm/flea prevention",
  emergency_fund: "Recommended reserve for unexpected illnesses or injuries",
  grooming: "Professional grooming; lower for short-coat or low-shed breeds",
  boarding: "Pet sitting or kennel care for ~2 weeks of travel per year",
  supplies_toys: "Collars, leashes, bedding, enrichment, and replacement items",
  license: "Annual municipal pet license (varies by city)",
  litter: "Clumping or non-clumping litter; replaced regularly",
  hay: "Timothy or orchard grass hay — the bulk of a rabbit's diet",
  bedding: "Cage bedding and habitat materials",
  supplies: "Cage, habitat supplies, enrichment, and replacements",
};

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  vet_routine: "Vet care (routine)",
  emergency_fund: "Emergency vet fund",
  grooming: "Grooming",
  boarding: "Boarding / pet sitting",
  supplies_toys: "Supplies & toys",
  license: "License & registration",
  litter: "Litter",
  hay: "Hay",
  bedding: "Bedding",
  supplies: "Habitat & supplies",
};

function computeCosts(
  petType: PetType,
  petAge: PetAge,
  location: LocationTier,
  hasInsurance: boolean
): CostResult {
  const base = BASE_COSTS[petType];
  const locationMult = LOCATION_MULTIPLIERS[location];
  const vetMult = AGE_VET_ADJUSTMENTS[petAge];

  const categories: CostCategory[] = Object.entries(base).map(([key, value]) => {
    let adjusted = value * locationMult;
    if (key === "vet_routine" || key === "emergency_fund") {
      adjusted *= vetMult;
    }
    return {
      label: CATEGORY_LABELS[key] ?? key,
      amount: Math.round(adjusted),
      note: CATEGORY_NOTES[key] ?? "",
    };
  });

  if (hasInsurance) {
    const insuranceCost = petType.startsWith("dog") ? 600 : 350;
    categories.push({
      label: "Pet insurance",
      amount: Math.round(insuranceCost * locationMult),
      note: "Estimated annual premium for accident & illness coverage",
    });
  }

  const annualTotal = categories.reduce((s, c) => s + c.amount, 0);
  return {
    categories,
    annualTotal,
    monthlyBudget: Math.round(annualTotal / 12),
    petType,
    petAge,
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";
const labelClass = "block text-xs font-light text-muted-foreground mb-1";

const PET_TYPE_LABELS: Record<PetType, string> = {
  dog_small: "Dog — Small (under 20 lbs)",
  dog_medium: "Dog — Medium (20–50 lbs)",
  dog_large: "Dog — Large (50–90 lbs)",
  dog_giant: "Dog — Giant (90+ lbs)",
  cat: "Cat",
  rabbit: "Rabbit",
  bird: "Bird",
};

type Phase = "input" | "loading" | "results";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PetCostEstimatorPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<CostResult | null>(null);

  const [petType, setPetType] = useState<PetType>("dog_medium");
  const [petAge, setPetAge] = useState<PetAge>("adult");
  const [location, setLocation] = useState<LocationTier>("suburban");
  const [hasInsurance, setHasInsurance] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setTimeout(() => {
        setResult(computeCosts(petType, petAge, location, hasInsurance));
        setPhase("results");
      }, 900);
    },
    [petType, petAge, location, hasInsurance]
  );

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <ToolShell
      eyebrow="calculator"
      title="Annual Pet Cost Estimator"
      description="See what owning your pet actually costs per year — food, vet bills, grooming, boarding, and more."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Pet type</label>
                <select
                  className={inputClass}
                  value={petType}
                  onChange={(e) => setPetType(e.target.value as PetType)}
                >
                  {(Object.keys(PET_TYPE_LABELS) as PetType[]).map((t) => (
                    <option key={t} value={t}>
                      {PET_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Pet age</label>
                <select
                  className={inputClass}
                  value={petAge}
                  onChange={(e) => setPetAge(e.target.value as PetAge)}
                >
                  <option value="young">Young / puppy / kitten</option>
                  <option value="adult">Adult</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Your location</label>
                <select
                  className={inputClass}
                  value={location}
                  onChange={(e) => setLocation(e.target.value as LocationTier)}
                >
                  <option value="rural">Rural / small town</option>
                  <option value="suburban">Suburban</option>
                  <option value="urban">Urban</option>
                  <option value="major_city">Major city (NYC, SF, LA…)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setHasInsurance((v) => !v)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      hasInsurance ? "bg-foreground" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${
                        hasInsurance ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <span className="text-xs font-light text-muted-foreground">
                    Include pet insurance estimate
                  </span>
                </label>
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

        {phase === "results" && result && (
          <ResultsPanel onReset={() => setPhase("input")} resetLabel="Change inputs">
            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">estimated annual cost</p>
                <p className="text-3xl font-extralight tracking-tight">{fmt(result.annualTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">monthly budget</p>
                <p className="text-3xl font-extralight tracking-tight">{fmt(result.monthlyBudget)}</p>
              </div>
            </div>

            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">cost breakdown</p>
            <div className="space-y-0 divide-y divide-border/40">
              {result.categories.map((cat, i) => (
                <div key={i} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-foreground">{cat.label}</p>
                    {cat.note && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{cat.note}</p>
                    )}
                  </div>
                  <p className="text-sm font-light text-foreground shrink-0">{fmt(cat.amount)}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 border border-border/40 rounded-md px-4 py-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Estimates are based on national averages, adjusted for your location and pet&apos;s age. Actual costs vary by breed, health, lifestyle, and local service prices. First-year costs (adoption fee, initial supplies, full vaccine series) are typically 30–50% higher.
              </p>
            </div>
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
