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

export default function SymptomCheckerPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);

  const [petType, setPetType] = useState("dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState("");
  const [recentChanges, setRecentChanges] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhase("loading");
      setStream(null);

      try {
        const res = await fetch("/api/tools/symptom-checker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petType, breed, age, symptoms, duration, recentChanges }),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        setPhase("streaming");
        setStream(res.body);
      } catch {
        setPhase("input");
      }
    },
    [petType, breed, age, symptoms, duration, recentChanges]
  );

  const handleReset = useCallback(() => {
    setPhase("input");
    setStream(null);
  }, []);

  return (
    <ToolShell
      eyebrow="ai-powered"
      title="Symptom Urgency Checker"
      description="Describe what you're noticing. Get an honest read on whether it's a wait-and-watch situation or a same-day vet call."
    >
      <div className="max-w-lg mb-6 border border-amber-200/60 bg-amber-50/30 dark:border-amber-400/20 dark:bg-amber-400/5 rounded-md px-4 py-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This tool is for informational guidance only. It does not replace veterinary diagnosis. If your pet is in distress, having trouble breathing, or you suspect poisoning, call your vet or an emergency animal hospital immediately.
        </p>
      </div>

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
                  <option value="rabbit">Rabbit</option>
                  <option value="bird">Bird</option>
                  <option value="other">Other small animal</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Breed (if known)</label>
                <input
                  className={inputClass}
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="e.g. Labrador or mixed"
                />
              </div>

              <div>
                <label className={labelClass}>Age</label>
                <input
                  className={inputClass}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 4 years"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>How long has this been going on?</label>
                <select
                  className={inputClass}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="">Select duration</option>
                  <option value="just started (last few hours)">Just started (last few hours)</option>
                  <option value="since yesterday">Since yesterday</option>
                  <option value="2–3 days">2–3 days</option>
                  <option value="4–7 days">4–7 days</option>
                  <option value="over a week">Over a week</option>
                  <option value="a few weeks or longer">A few weeks or longer</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>What symptoms are you noticing?</label>
                <textarea
                  className={inputClass + " min-h-[100px] resize-none"}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe everything you've noticed — behavior changes, physical signs, eating/drinking changes, energy level, etc."
                  required
                />
              </div>

              <div className="col-span-2">
                <label className={labelClass}>Any recent changes? (food, environment, exposure to other animals)</label>
                <input
                  className={inputClass}
                  value={recentChanges}
                  onChange={(e) => setRecentChanges(e.target.value)}
                  placeholder="e.g. switched food 3 days ago, visited dog park, new pet in house"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank if nothing has changed</p>
              </div>
            </div>

            <button
              type="submit"
              className="border border-foreground/30 rounded-md px-5 py-2 text-sm font-light hover:bg-foreground hover:text-background transition-colors"
            >
              Check urgency
            </button>
          </form>
        )}

        {phase === "loading" && <AILoader />}

        {(phase === "streaming" || phase === "done") && (
          <ResultsPanel onReset={handleReset} resetLabel="Check different symptoms">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-4">symptom assessment</p>
            <StreamingText stream={stream} onComplete={() => setPhase("done")} />
          </ResultsPanel>
        )}
      </AnimatePresence>
    </ToolShell>
  );
}
