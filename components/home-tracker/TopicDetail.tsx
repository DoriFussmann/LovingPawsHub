"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Topic = {
  id: string;
  name: string;
  icon: string | null;
  status: string;
  summary: string | null;
  details: Record<string, string> | null;
  notes: string | null;
};

const STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress",  label: "In progress" },
  { value: "pending",      label: "Pending" },
  { value: "completed",    label: "Completed" },
  { value: "issue",        label: "Issue" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  not_started: "text-foreground/50",
  in_progress: "text-info-ink",
  pending:     "text-warn-ink",
  completed:   "text-ok-ink",
  issue:       "text-err-ink",
};

export default function TopicDetail({
  topic,
  extractedFields,
}: {
  topic: Topic;
  extractedFields?: Record<string, string>;
}) {
  const [status, setStatus] = useState(topic.status);
  const [notes, setNotes] = useState(topic.notes ?? "");
  const details: Record<string, string> = {
    ...(topic.details ?? {}),
    ...(extractedFields ?? {}),
  };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("topics")
      .update({ status, notes: notes || null, details })
      .eq("id", topic.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleStatusChange(val: string) {
    setStatus(val);
    const supabase = createClient();
    await supabase.from("topics").update({ status: val }).eq("id", topic.id);
  }

  return (
    <div className="space-y-6">
      {/* Status selector */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
          Status
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              className={`text-xs font-light px-3 py-1.5 rounded border transition-colors ${
                status === s.value
                  ? "border-foreground/30 bg-foreground/5 " + STATUS_COLORS[s.value]
                  : "border-border text-foreground/40 hover:border-foreground/25"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Extracted fields */}
      {Object.keys(details).length > 0 && (
        <div>
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
            Extracted details
          </p>
          <div className="bg-card border border-border rounded-md divide-y divide-border">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex gap-4 px-4 py-2.5">
                <span className="text-xs font-light text-foreground/50 w-40 shrink-0 capitalize">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-light text-foreground flex-1">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
          Notes
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add your notes about this topic…"
          rows={5}
          className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded resize-none focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
        />
        <div className="flex items-center justify-end gap-3 mt-2">
          {saved && (
            <span className="text-xs font-light text-ok-ink">Saved</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-light bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
