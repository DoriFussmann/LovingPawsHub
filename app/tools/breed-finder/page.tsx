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

export default function BreedFinderPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);

  const [species, setSpecies] = useState("dog");
  const [housing, setHousing] = useState("apartment");
  const [activity, setActivity] = useState("moderate");
  const [experience, setExperience] = useState("some");
  const [hoursAlone, setHoursAlone] = useState("4-6");
  const [household, setHousehold] = useState("adults_only");
  const [allergies, setAllergies] = useState("");
  const [preferences, setPreferences] = useState("");
  const [dealbreakers, setDealbreakers] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setStream(null);

      try {
        const res = await fetch("/api/tools/breed-finder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            species, housing, activity, experience,
            hoursAlone, household, allergies, preferences, dealbreakers,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        setPhase("streaming");
        setStream(res.body);
      } catch {
        setPhase("input");
      }
    },
    [species, housing, activity, experience, hoursAlone, household, allergies, preferences, dealbreakers]
  );

  const handleReset = useCallback(() => {
    setPhase("input");
    setStream(null);
  }, []);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title="Breed Compatibility Finder"
      description="Tell us about your life. Get matched with breeds that actually fit — not just the ones that look good in photos."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Looking for a</label>
                <div className="flex gap-2">
                  {["dog", "cat"].map((s) => (
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
                <label className={labelClass}>Living situation</label>
                <select
                  className={inputClass}
                  value={housing}
                  onChange={(e) => setHousing(e.target.value)}
                >
                  <option value="apartment_small">Small apartment (under 600 sq ft)</option>
                  <option value="apartment">Apartment or condo</option>
                  <option value="house_no_yard">House without yard</option>
                  <option value="house_yard">House with yard</option>
                  <option value="house_large_yard">House with large yard / rural</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Your activity level</label>
                <select
                  className={inputClass}
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                >
                  <option value="very_low">Very low — mostly indoors, minimal exercise</option>
                  <option value="low">Low — light daily walks</option>
                  <option value="moderate">Moderate — regular walks, occasional hikes</option>
                  <option value="high">High — daily runs, active outdoors</option>
                  <option value="very_high">Very high — training, sports, working lifestyle</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Pet ownership experience</label>
                <select
                  className={inputClass}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                >
                  <option value="none">First-time owner</option>
                  <option value="some">Some — had pets growing up</option>
                  <option value="moderate">Moderate — owned as an adult before</option>
                  <option value="experienced">Experienced — multiple pets, training background</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Hours alone daily</label>
                <select
                  className={inputClass}
                  value={hoursAlone}
                  onChange={(e) => setHoursAlone(e.target.value)}
                >
                  <option value="0-2">0–2 hours (work from home)</option>
                  <option value="4-6">4–6 hours</option>
                  <option value="7-9">7–9 hours</option>
                  <option value="9+">More than 9 hours</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Household</label>
                <select
                  className={inputClass}
                  value={household}
                  onChange={(e) => setHousehold(e.target.value)}
                >
                  <option value="alone">Just me</option>
                  <option value="adults_only">Adults only</option>
                  <option value="kids_older">Adults + older kids (8+)</option>
                  <option value="kids_young">Adults + young children (under 8)</option>
                  <option value="other_dogs">Other dogs in the home</option>
                  <option value="other_cats">Other cats in the home</option>
                  <option value="mixed_pets">Mixed pets household</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Allergies or grooming preferences</label>
                <input
                  className={inputClass}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. low-shedding preferred, pet dander allergy, fine with grooming"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank if no preference</p>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>What are you looking for in a pet?</label>
                <input
                  className={inputClass}
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="e.g. calm and cuddly, good running companion, good with kids, low maintenance"
                />
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Hard dealbreakers (if any)</label>
                <input
                  className={inputClass}
                  value={dealbreakers}
                  onChange={(e) => setDealbreakers(e.target.value)}
                  placeholder="e.g. no excessive barking, must be under 30 lbs, no high-energy breeds"
                />
              </div>
            </div>

            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Find my matches
            </button>
          </form>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && (
          <ResultsPanel onReset={handleReset} resetLabel="Change my preferences">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">your breed matches</p>
            <StreamingText stream={stream} onComplete={() => setPhase("done")} />
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
