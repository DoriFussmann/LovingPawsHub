"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogEntryItem from "./LogEntryItem";

type LogEntry = {
  id: string;
  content: string;
  ai_summary: string | null;
  created_at: string;
};

export default function ActivityLog({
  propertyId,
  initialEntries,
  topicId,
}: {
  propertyId: string;
  initialEntries: LogEntry[];
  topicId?: string;
}) {
  const [entries, setEntries] = useState<LogEntry[]>(initialEntries);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setSaving(true);
    setError("");

    let aiSummary: string | null = null;

    try {
      const res = await fetch("/api/home-tracker/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        aiSummary = data.summary ?? null;
      }
    } catch {
      // Summarize failed — still save the entry
    }

    const supabase = createClient();
    const { data: entry, error: insertError } = await supabase
      .from("log_entries")
      .insert({
        property_id: propertyId,
        topic_id: topicId ?? null,
        content: text.trim(),
        ai_summary: aiSummary,
      })
      .select("id, content, ai_summary, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setEntries([entry, ...entries]);
    setText("");
    setSaving(false);
  }

  return (
    <div>
      <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-3">
        Activity log
      </p>

      {/* Add entry form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened today? Add a note about this property…"
          rows={3}
          className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded resize-none focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
        />
        {error && (
          <p className="text-xs text-err-ink mt-1">{error}</p>
        )}
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="px-4 py-2 text-xs font-light tracking-wide bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving…" : "Add entry"}
          </button>
        </div>
      </form>

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="text-sm font-light text-muted-foreground">
          No activity yet. Add your first note above.
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <LogEntryItem key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
