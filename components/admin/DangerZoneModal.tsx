"use client";

import { useState } from "react";
import { X, TriangleAlert } from "lucide-react";

interface DangerAction {
  scope: string;
  label: string;
  cascades?: string;
  nuclear?: boolean;
}

const ACTIONS: DangerAction[] = [
  { scope: "articles",               label: "delete all articles" },
  { scope: "skeletons",              label: "delete all skeletons & articles",  cascades: "→ articles" },
  { scope: "clusters",               label: "delete all clusters",              cascades: "→ skeletons → articles" },
  { scope: "bridges",                label: "delete all bridge keywords",       cascades: "→ clusters → skeletons → articles" },
  { scope: "cores",                  label: "delete all core keywords",         cascades: "→ bridges → clusters → skeletons → articles" },
  { scope: "resources",              label: "delete all resources" },
  { scope: "glossary",              label: "delete all glossary terms" },
  { scope: "site_settings",         label: "delete site settings" },
  { scope: "general_controls",      label: "delete general controls" },
  { scope: "everything_keep_controls", label: "full reset — keep prompts",     cascades: "industry → all content + glossary + site settings", nuclear: true },
  { scope: "everything",            label: "delete everything — full reset",   cascades: "industry → all tables + glossary + site settings + prompts", nuclear: true },
];

interface DangerZoneModalProps {
  onClose: () => void;
}

export default function DangerZoneModal({ onClose }: DangerZoneModalProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function execute(scope: string) {
    setLoading(scope);
    setError("");
    try {
      const res = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setDone(scope);
      setConfirming(null);
      setConfirmInput("");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(null);
    }
  }

  function startConfirm(scope: string) {
    setConfirming(scope);
    setConfirmInput("");
    setError("");
    setDone(null);
  }

  function cancel() {
    setConfirming(null);
    setConfirmInput("");
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-md w-[560px] max-h-[85vh] flex flex-col shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TriangleAlert size={13} className="text-red-500" />
            <span className="text-xs font-light tracking-widest uppercase text-foreground">
              danger zone
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
          <p className="text-[10px] font-light text-muted-foreground mb-4">
            All actions are irreversible. Type <span className="font-medium text-foreground">DELETE</span> to confirm each one.
          </p>

          {ACTIONS.map((action) => {
            const isConfirming = confirming === action.scope;
            const isDone = done === action.scope;
            const isLoading = loading === action.scope;

            return (
              <div
                key={action.scope}
                className={`border rounded-md px-4 py-3 transition-colors ${
                  action.nuclear
                    ? "border-red-200 bg-red-50/40"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-light ${action.nuclear ? "text-red-700" : "text-foreground"}`}>
                      {action.label}
                    </p>
                    {action.cascades && (
                      <p className="text-[9px] font-mono text-muted-foreground/60 mt-1">
                        {action.cascades}
                      </p>
                    )}
                  </div>
                  {!isConfirming && !isDone && (
                    <button
                      onClick={() => startConfirm(action.scope)}
                      className={`shrink-0 px-2.5 py-1 text-[10px] font-light rounded border transition-colors ${
                        action.nuclear
                          ? "border-red-300 text-red-600 hover:bg-red-50"
                          : "border-border text-muted-foreground hover:text-red-500 hover:border-red-300"
                      }`}
                    >
                      delete
                    </button>
                  )}
                  {isDone && (
                    <span className="shrink-0 text-[10px] text-emerald-600">done</span>
                  )}
                </div>

                {/* Inline confirm */}
                {isConfirming && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmInput === "DELETE" && execute(action.scope)}
                      placeholder="type DELETE"
                      className="flex-1 text-xs font-light rounded border border-border px-2.5 py-1.5 bg-background focus:outline-none focus:border-red-400 placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={() => execute(action.scope)}
                      disabled={confirmInput !== "DELETE" || isLoading}
                      className="px-2.5 py-1.5 text-[10px] font-light rounded border border-red-300 bg-red-500 text-white disabled:opacity-40 hover:bg-red-600 transition-colors"
                    >
                      {isLoading ? "deleting..." : "confirm"}
                    </button>
                    <button
                      onClick={cancel}
                      className="px-2.5 py-1.5 text-[10px] font-light rounded border border-border hover:bg-muted transition-colors"
                    >
                      cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <p className="text-xs font-light text-red-500 px-1">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <p className="text-[10px] font-light text-muted-foreground">
            changes take effect immediately · page will reload after each action
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted transition-colors"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
