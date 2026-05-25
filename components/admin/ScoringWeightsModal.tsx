"use client";

import { useState } from "react";
import { X, RotateCcw } from "lucide-react";

export interface ScoringWeights {
  volume: number;
  cpc: number;
  kd: number;
  competition: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  volume: 40,
  cpc: 30,
  kd: 20,
  competition: 10,
};

export const SCORING_WEIGHTS_KEY = "scoring_weights";

const WEIGHT_LABELS: Record<keyof ScoringWeights, { label: string; note: string }> = {
  volume: { label: "search volume", note: "higher volume scores higher" },
  cpc: { label: "cost per click (cpc)", note: "higher CPC = more commercial intent = scores higher" },
  kd: { label: "keyword difficulty (kd)", note: "inverse — lower difficulty scores higher" },
  competition: { label: "competition", note: "inverse — lower competition scores higher" },
};

interface Props {
  weights: ScoringWeights;
  onSave: (weights: ScoringWeights) => void;
  onClose: () => void;
}

export default function ScoringWeightsModal({ weights, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ScoringWeights>({ ...weights });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Object.values(draft).reduce((a, b) => a + b, 0);
  const valid = total === 100;

  function update(key: keyof ScoringWeights, value: number) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  async function save() {
    if (!valid) { setError("weights must sum to 100"); return; }
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SCORING_WEIGHTS_KEY, value: draft }),
      });
      onSave(draft);
      onClose();
    } catch {
      setError("failed to save — check connection");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft({ ...DEFAULT_SCORING_WEIGHTS });
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-0.5">controls</p>
            <h2 className="text-base font-extralight tracking-tight text-foreground">keyword scoring weights</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-[11px] font-light text-muted-foreground leading-relaxed">
            adjust how much each factor contributes to the opportunity score (0–100). weights must sum to 100.
          </p>

          {(Object.keys(draft) as Array<keyof ScoringWeights>).map((key) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <p className="text-xs font-light text-foreground">{WEIGHT_LABELS[key].label}</p>
                  <p className="text-[10px] font-light text-muted-foreground">{WEIGHT_LABELS[key].note}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={draft[key]}
                    onChange={(e) => update(key, Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-14 text-right text-xs font-light bg-transparent border border-border/50 rounded px-2 py-1 outline-none focus:border-border tabular-nums"
                  />
                  <span className="text-[10px] text-muted-foreground w-3">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={draft[key]}
                onChange={(e) => update(key, Number(e.target.value))}
                className="w-full h-0.5 accent-foreground"
              />
            </div>
          ))}

          {/* Total indicator */}
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <p className="text-[10px] font-light text-muted-foreground">total</p>
            <p className={`text-sm font-light tabular-nums ${valid ? "text-emerald-600" : "text-red-500"}`}>
              {total}%
              {!valid && <span className="text-[10px] ml-2">(must equal 100)</span>}
            </p>
          </div>

          {error && <p className="text-[11px] text-red-500 font-light">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/30">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={11} />
            reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-light border border-border rounded-md hover:bg-muted transition-colors"
            >
              cancel
            </button>
            <button
              onClick={save}
              disabled={!valid || saving}
              className="px-3 py-1.5 text-xs font-light bg-foreground text-background rounded-md hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {saving ? "saving..." : "save weights"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
