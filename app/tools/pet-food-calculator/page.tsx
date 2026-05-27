"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { CalcLoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type Species = "dog" | "cat";
type LifeStage = "puppy_kitten" | "adult" | "senior";
type ActivityLevel = "low" | "moderate" | "high" | "very_high";
type FoodType = "dry" | "wet" | "mixed";

interface FoodResult {
  caloriesPerDay: number;
  caloriesRange: string;
  cupsPerDay: number | null;
  cansPerDay: number | null;
  feedingSchedule: string;
  weightKg: number;
}

// ─── Calculations ─────────────────────────────────────────────────────────────

// Multiplier ranges [low, high] per life stage + activity
const DOG_MULTIPLIERS: Record<LifeStage, Record<ActivityLevel, [number, number]>> = {
  puppy_kitten: { low: [2.5, 3.0], moderate: [3.0, 3.5], high: [3.5, 4.0], very_high: [4.0, 4.5] },
  adult:        { low: [1.2, 1.4], moderate: [1.4, 1.6], high: [1.6, 2.0], very_high: [2.0, 5.0] },
  senior:       { low: [1.1, 1.3], moderate: [1.2, 1.4], high: [1.3, 1.5], very_high: [1.4, 1.7] },
};

const CAT_MULTIPLIERS: Record<LifeStage, Record<ActivityLevel, [number, number]>> = {
  puppy_kitten: { low: [2.0, 2.5], moderate: [2.5, 3.0], high: [2.8, 3.5], very_high: [3.0, 3.5] },
  adult:        { low: [1.0, 1.2], moderate: [1.1, 1.4], high: [1.2, 1.6], very_high: [1.4, 1.8] },
  senior:       { low: [0.9, 1.1], moderate: [1.0, 1.2], high: [1.1, 1.3], very_high: [1.2, 1.4] },
};

function computeFood(
  species: Species,
  weightLbs: number,
  lifeStage: LifeStage,
  activity: ActivityLevel,
  neutered: boolean,
  foodType: FoodType
): FoodResult {
  const weightKg = weightLbs / 2.205;
  const rer = 70 * Math.pow(weightKg, 0.75);

  const table = species === "dog" ? DOG_MULTIPLIERS : CAT_MULTIPLIERS;
  const [mLow, mHigh] = table[lifeStage][activity];

  // Neutered adults need ~15% fewer calories
  const neuteredFactor = neutered && lifeStage === "adult" ? 0.85 : 1.0;
  const calLow = Math.round(rer * mLow * neuteredFactor);
  const calHigh = Math.round(rer * mHigh * neuteredFactor);
  const calMid = Math.round((calLow + calHigh) / 2);

  // Dry kibble avg ~350 kcal/cup; wet avg ~90 kcal per 3 oz can
  const dryKcalPerCup = 350;
  const wetKcalPerCan = 90;

  let cupsPerDay: number | null = null;
  let cansPerDay: number | null = null;

  if (foodType === "dry") {
    cupsPerDay = calMid / dryKcalPerCup;
  } else if (foodType === "wet") {
    cansPerDay = calMid / wetKcalPerCan;
  } else {
    cupsPerDay = (calMid * 0.5) / dryKcalPerCup;
    cansPerDay = (calMid * 0.5) / wetKcalPerCan;
  }

  const feedingSchedule =
    lifeStage === "puppy_kitten"
      ? "3–4 meals per day"
      : lifeStage === "senior"
      ? "2 smaller meals per day"
      : "2 meals per day";

  return {
    caloriesPerDay: calMid,
    caloriesRange: `${calLow}–${calHigh} kcal`,
    cupsPerDay,
    cansPerDay,
    feedingSchedule,
    weightKg,
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";
const labelClass = "block text-xs font-light text-muted-foreground mb-1";

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  low: "Low — mostly naps, short walks",
  moderate: "Moderate — regular walks, some play",
  high: "High — daily runs, active play sessions",
  very_high: "Very high — working dog, sport, herding",
};

type Phase = "input" | "loading" | "results";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PetFoodCalculatorPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<FoodResult | null>(null);

  const [species, setSpecies] = useState<Species>("dog");
  const [weight, setWeight] = useState("35");
  const [lifeStage, setLifeStage] = useState<LifeStage>("adult");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [neutered, setNeutered] = useState(true);
  const [foodType, setFoodType] = useState<FoodType>("dry");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setTimeout(() => {
        const r = computeFood(
          species,
          parseFloat(weight) || 10,
          lifeStage,
          activity,
          neutered,
          foodType
        );
        setResult(r);
        setPhase("results");
      }, 900);
    },
    [species, weight, lifeStage, activity, neutered, foodType]
  );

  const stageLabelDog: Record<LifeStage, string> = {
    puppy_kitten: "Puppy (under ~1 year)",
    adult: "Adult (1–7 years)",
    senior: "Senior (7+ years)",
  };
  const stageLabelCat: Record<LifeStage, string> = {
    puppy_kitten: "Kitten (under 1 year)",
    adult: "Adult (1–10 years)",
    senior: "Senior (10+ years)",
  };
  const stageLabels = species === "dog" ? stageLabelDog : stageLabelCat;

  return (
    <ToolShell
      eyebrow="calculator"
      title="Pet Food Portion Calculator"
      description="Get a daily feeding recommendation based on your pet's weight, age, and activity level."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Species</label>
                <div className="flex gap-2">
                  {(["dog", "cat"] as Species[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpecies(s)}
                      className={`flex-1 border rounded-md px-4 py-2 text-sm font-light capitalize transition-colors ${
                        species === s
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Current weight (lbs)</label>
                <input
                  type="number"
                  className={inputClass}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min="1"
                  max="250"
                  step="0.5"
                  placeholder="35"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Life stage</label>
                <select
                  className={inputClass}
                  value={lifeStage}
                  onChange={(e) => setLifeStage(e.target.value as LifeStage)}
                >
                  {(Object.keys(stageLabels) as LifeStage[]).map((s) => (
                    <option key={s} value={s}>
                      {stageLabels[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Activity level</label>
                <select
                  className={inputClass}
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                >
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTIVITY_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Food type</label>
                <div className="flex gap-2">
                  {(["dry", "wet", "mixed"] as FoodType[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFoodType(f)}
                      className={`flex-1 border rounded-md px-3 py-2 text-sm font-light capitalize transition-colors ${
                        foodType === f
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {f === "mixed" ? "Dry + wet" : f}
                    </button>
                  ))}
                </div>
              </div>

              {lifeStage === "adult" && (
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setNeutered((v) => !v)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        neutered ? "bg-foreground" : "bg-border"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${
                          neutered ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                    <span className="text-xs font-light text-muted-foreground">
                      Spayed / neutered
                    </span>
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Calculate portions
            </button>
          </form>
        )}

        {phase === "loading" && <CalcLoader />}

        {phase === "results" && result && (
          <ResultsPanel onReset={() => setPhase("input")} resetLabel="Recalculate">
            <div className="mb-6">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">daily calories</p>
              <p className="text-3xl font-extralight tracking-tight">{result.caloriesPerDay} kcal</p>
              <p className="text-xs font-light text-muted-foreground mt-1">
                Range: {result.caloriesRange} · {result.feedingSchedule}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {result.cupsPerDay !== null && (
                <div className="rounded-md border border-foreground/20 bg-foreground/[0.03] p-4">
                  <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">dry kibble</p>
                  <p className="text-2xl font-extralight">{result.cupsPerDay.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    cups/day · based on ~350 kcal/cup
                  </p>
                </div>
              )}
              {result.cansPerDay !== null && (
                <div className="rounded-md border border-foreground/20 bg-foreground/[0.03] p-4">
                  <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">wet food</p>
                  <p className="text-2xl font-extralight">{result.cansPerDay.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    3 oz portions/day · ~90 kcal each
                  </p>
                </div>
              )}
              <div className="rounded-md border border-border p-4">
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">body weight</p>
                <p className="text-2xl font-extralight">{result.weightKg.toFixed(1)} kg</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {parseFloat(weight).toFixed(1)} lbs converted
                </p>
              </div>
            </div>

            <div className="border border-border/40 rounded-md px-4 py-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                These are starting estimates based on standard energy formulas (RER × life stage multiplier). Calorie density varies by brand — always check the feeding guidelines on your specific food and adjust based on your pet&apos;s body condition. When in doubt, ask your vet.
              </p>
            </div>
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
