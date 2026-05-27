"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import ToolShell from "@/components/public/tools/ToolShell";
import { CalcLoader } from "@/components/public/tools/ToolLoader";
import ResultsPanel from "@/components/public/tools/ResultsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type Species = "dog" | "cat";
type DogSize = "Small" | "Medium" | "Large" | "Giant";

interface AgeResult {
  humanAge: number;
  lifeStage: string;
  stageDescription: string;
  typicalLifespan: string;
  healthNote: string;
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function toHumanAgeDog(years: number, months: number, size: DogSize): number {
  const age = years + months / 12;
  if (age <= 0) return 0;
  const rates: Record<DogSize, number> = { Small: 4.5, Medium: 5, Large: 6, Giant: 7 };
  if (age < 1) return Math.round(15 * age);
  if (age < 2) return Math.round(15 + (age - 1) * 9);
  return Math.round(24 + (age - 2) * rates[size]);
}

function toHumanAgeCat(years: number, months: number): number {
  const age = years + months / 12;
  if (age <= 0) return 0;
  if (age < 1) return Math.round(15 * age);
  if (age < 2) return Math.round(15 + (age - 1) * 9);
  return Math.round(24 + (age - 2) * 4);
}

function getLifeStage(
  species: Species,
  years: number,
  months: number,
  size?: DogSize
): { stage: string; description: string } {
  const age = years + months / 12;
  if (species === "cat") {
    if (age < 1) return { stage: "Kitten", description: "Rapid growth and socialization. Boundless curiosity." };
    if (age <= 2) return { stage: "Junior", description: "Still developing — playful, testing boundaries, full of energy." };
    if (age <= 6) return { stage: "Prime", description: "Peak physical condition. Active, healthy, and relatively low-maintenance." };
    if (age <= 10) return { stage: "Mature", description: "Starting to slow down slightly. Weight management becomes important." };
    if (age <= 14) return { stage: "Senior", description: "Regular vet checkups matter more. Watch for arthritis and kidney changes." };
    return { stage: "Geriatric", description: "Extra care, comfort, and frequent vet visits are essential." };
  }
  const seniorAge = size === "Giant" ? 6 : size === "Large" ? 7 : 8;
  const geriatricAge = size === "Giant" ? 9 : size === "Large" ? 10 : 12;
  if (age < 1) return { stage: "Puppy", description: "Critical window for vaccinations, training, and socialization." };
  if (age <= 2) return { stage: "Junior", description: "Still maturing — full of energy and continuing to learn." };
  if (age < seniorAge) return { stage: "Adult", description: "Peak fitness. Maintain routine exercise, diet, and annual checkups." };
  if (age < geriatricAge) return { stage: "Senior", description: "Slowing down is normal. Joint health and biannual vet visits become priorities." };
  return { stage: "Geriatric", description: "Comfort and quality of life are the focus. Close monitoring is key." };
}

function getLifespan(species: Species, size?: DogSize): string {
  if (species === "cat") return "12–18 years (average ~15)";
  const spans: Record<DogSize, string> = {
    Small: "12–16 years",
    Medium: "10–14 years",
    Large: "8–12 years",
    Giant: "7–10 years",
  };
  return spans[size ?? "Medium"];
}

function getHealthNote(stage: string): string {
  switch (stage) {
    case "Puppy":
    case "Kitten":
      return "Core vaccinations, deworming, and spay/neuter planning are the priorities right now.";
    case "Junior":
      return "Complete your vaccine series, establish a vet relationship, and consider dental care early.";
    case "Prime":
    case "Adult":
      return "Annual wellness exams, heartworm/flea prevention, and routine dental cleanings prevent bigger problems later.";
    case "Mature":
      return "Watch weight closely — obesity accelerates aging. Ask your vet about adding bloodwork to annual exams.";
    case "Senior":
      return "Biannual vet visits, bloodwork panels, and joint supplements are worth discussing with your vet.";
    default:
      return "Pain management, comfort, and quality time are the main focus at this stage.";
  }
}

function compute(species: Species, years: number, months: number, size?: DogSize): AgeResult {
  const humanAge =
    species === "dog"
      ? toHumanAgeDog(years, months, size ?? "Medium")
      : toHumanAgeCat(years, months);
  const { stage, description } = getLifeStage(species, years, months, size);
  return {
    humanAge,
    lifeStage: stage,
    stageDescription: description,
    typicalLifespan: getLifespan(species, size),
    healthNote: getHealthNote(stage),
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-border rounded-md px-3 py-2 text-sm font-light bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors";
const labelClass = "block text-xs font-light text-muted-foreground mb-1";

type Phase = "input" | "loading" | "results";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PetAgeCalculatorPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<AgeResult | null>(null);
  const [species, setSpecies] = useState<Species>("dog");
  const [petName, setPetName] = useState("");
  const [years, setYears] = useState("3");
  const [months, setMonths] = useState("0");
  const [dogSize, setDogSize] = useState<DogSize>("Medium");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setTimeout(() => {
        const r = compute(
          species,
          parseInt(years) || 0,
          parseInt(months) || 0,
          species === "dog" ? dogSize : undefined
        );
        setResult(r);
        setPhase("results");
      }, 900);
    },
    [species, years, months, dogSize]
  );

  return (
    <ToolShell
      eyebrow="calculator"
      title="Pet Age Calculator"
      description="Convert your pet's age to human years — adjusted for species and, for dogs, body size."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Pet name (optional)</label>
                <input
                  className={inputClass}
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="e.g. Biscuit"
                />
              </div>

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
                <label className={labelClass}>Years</label>
                <input
                  type="number"
                  className={inputClass}
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  min="0"
                  max="30"
                  placeholder="3"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Months</label>
                <select
                  className={inputClass}
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {i} {i === 1 ? "month" : "months"}
                    </option>
                  ))}
                </select>
              </div>

              {species === "dog" && (
                <div className="col-span-2">
                  <label className={labelClass}>Dog size</label>
                  <select
                    className={inputClass}
                    value={dogSize}
                    onChange={(e) => setDogSize(e.target.value as DogSize)}
                  >
                    <option value="Small">Small — under 20 lbs (Chihuahua, Dachshund, Toy Poodle)</option>
                    <option value="Medium">Medium — 20–50 lbs (Beagle, Bulldog, Border Collie)</option>
                    <option value="Large">Large — 50–90 lbs (Lab, German Shepherd, Husky)</option>
                    <option value="Giant">Giant — over 90 lbs (Great Dane, Mastiff, Saint Bernard)</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Calculate age
            </button>
          </form>
        )}

        {phase === "loading" && <CalcLoader />}

        {phase === "results" && result && (
          <ResultsPanel onReset={() => setPhase("input")} resetLabel="Try another pet">
            <div className="mb-6">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
                {petName ? `${petName}'s human age` : "human age equivalent"}
              </p>
              <p className="text-5xl font-extralight tracking-tight">{result.humanAge}</p>
              <p className="text-sm font-light text-muted-foreground mt-1">in human years</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-md border border-foreground/20 bg-foreground/[0.03] p-4">
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">life stage</p>
                <p className="text-lg font-extralight text-foreground">{result.lifeStage}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{result.stageDescription}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">typical lifespan</p>
                <p className="text-lg font-extralight text-foreground">{result.typicalLifespan}</p>
                <p className="text-[11px] text-muted-foreground mt-1">for this species and size</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">care focus now</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{result.healthNote}</p>
              </div>
            </div>
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
