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

export default function PetInsuranceAdvisorPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);

  const [petType, setPetType] = useState("dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [conditions, setConditions] = useState("");
  const [state, setState] = useState("");
  const [budget, setBudget] = useState("");
  const [priority, setPriority] = useState("comprehensive");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setStream(null);

      try {
        const res = await fetch("/api/tools/pet-insurance-advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petType, breed, age, conditions, state, budget, priority }),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        setPhase("streaming");
        setStream(res.body);
      } catch {
        setPhase("input");
      }
    },
    [petType, breed, age, conditions, state, budget, priority]
  );

  const handleReset = useCallback(() => {
    setPhase("input");
    setStream(null);
  }, []);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title="Pet Insurance Advisor"
      description="Describe your pet and budget. Get a straight recommendation on what type of coverage actually makes sense for you."
    >
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Pet type</label>
                <select
                  className={inputClass}
                  value={petType}
                  onChange={(e) => setPetType(e.target.value)}
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Breed</label>
                <input
                  className={inputClass}
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="e.g. Golden Retriever"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Age</label>
                <input
                  className={inputClass}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 2 years"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Your state</label>
                <input
                  className={inputClass}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Texas"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Known health conditions or breed concerns</label>
                <input
                  className={inputClass}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="e.g. hip dysplasia risk, no known issues, mild allergies"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank if none</p>
              </div>

              <div>
                <label className={labelClass}>Monthly budget for insurance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    className={inputClass + " pl-6"}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="60"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>What matters most</label>
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="comprehensive">Comprehensive coverage</option>
                  <option value="catastrophic">Catastrophic / emergency only</option>
                  <option value="low_premium">Lowest possible premium</option>
                  <option value="wellness">Wellness + preventive included</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Get my recommendation
            </button>
          </form>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && (
          <ResultsPanel onReset={handleReset} resetLabel="Start over">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">your insurance recommendation</p>
            <StreamingText stream={stream} onComplete={() => setPhase("done")} />
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
