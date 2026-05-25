"use client";

import { useState } from "react";
import { Trash2, Sparkles } from "lucide-react";

function InlineConfirm({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-light">
      <span className="text-muted-foreground">delete?</span>
      <button onClick={onConfirm} disabled={loading} className="text-red-500 hover:text-red-600 disabled:opacity-50">
        {loading ? "..." : "yes"}
      </button>
      <span className="text-border">·</span>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">cancel</button>
    </span>
  );
}

interface Resource {
  id: string;
  url: string | null;
  title: string | null;
  notes: string | null;
  domain_authority: number | null;
  source: string;
  created_at: string;
}

interface SuggestedResource {
  url: string;
  title: string;
  notes: string;
}

interface ResourcesClientProps {
  resources: Resource[];
  industryId: string | null;
  industryName: string;
}

export default function ResourcesClient({ resources: initialResources, industryId, industryName }: ResourcesClientProps) {
  const [resources, setResources] = useState(initialResources);
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Suggestions state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedResource[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [addingSelected, setAddingSelected] = useState(false);

  async function addResource() {
    if (!newUrl.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry_id: industryId,
          url: newUrl,
          title: newTitle,
          notes: newNotes,
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setResources((prev) => [data.resource, ...prev]);
      setNewUrl("");
      setNewTitle("");
      setNewNotes("");
      setAddOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteResource(id: string) {
    setDeleting(id);
    setDeleteConfirm(null);
    try {
      await fetch(`/api/resources?id=${id}`, { method: "DELETE" });
      setResources((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAll() {
    setDeletingAll(true);
    try {
      await fetch("/api/resources?all=true", { method: "DELETE" });
      setResources([]);
    } finally {
      setDeletingAll(false);
      setDeleteAllConfirm(false);
    }
  }

  async function fetchSuggestions() {
    setSuggesting(true);
    setSuggestError("");
    setSuggestions([]);
    setSelected(new Set());
    try {
      const res = await fetch("/api/resources/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry_name: industryName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "suggestion failed");
      const existingUrls = new Set(resources.map((r) => r.url?.replace(/\/$/, "").toLowerCase()));
      const fresh = (data.suggestions as SuggestedResource[]).filter(
        (s) => !existingUrls.has(s.url.replace(/\/$/, "").toLowerCase())
      );
      setSuggestions(fresh);
      setSelected(new Set(fresh.map((_, i) => i)));
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }

  function toggleSuggest(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); } else { next.add(i); }
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setAddingSelected(true);
    const toAdd = [...selected].map((i) => suggestions[i]);
    const added: Resource[] = [];
    for (const s of toAdd) {
      try {
        const res = await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            industry_id: industryId,
            url: s.url,
            title: s.title,
            notes: s.notes,
            source: "suggested",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          added.push(data.resource);
        }
      } catch { /* skip failed individual adds */ }
    }
    setResources((prev) => [...added, ...prev]);
    setSuggestOpen(false);
    setSuggestions([]);
    setSelected(new Set());
    setAddingSelected(false);
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setSuggestOpen((o) => !o);
            if (!suggestOpen && suggestions.length === 0) fetchSuggestions();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted"
        >
          <Sparkles size={11} />
          suggestions
        </button>
        {resources.length > 0 && (
          deleteAllConfirm ? (
            <InlineConfirm
              onConfirm={deleteAll}
              onCancel={() => setDeleteAllConfirm(false)}
              loading={deletingAll}
            />
          ) : (
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="text-[10px] font-light text-muted-foreground hover:text-red-500 transition-colors"
            >
              delete all
            </button>
          )
        )}
        <button
          onClick={() => setAddOpen(!addOpen)}
          className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background"
        >
          {addOpen ? "cancel" : "add resource"}
        </button>
      </div>

      {/* Suggestions panel */}
      {suggestOpen && (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                suggested resources
              </p>
              {industryName && (
                <p className="text-xs font-light text-muted-foreground mt-0.5">
                  for <span className="text-foreground">{industryName}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSuggestions}
                disabled={suggesting}
                className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted disabled:opacity-50"
              >
                {suggesting ? "generating..." : "regenerate"}
              </button>
              {suggestions.length > 0 && (
                <button
                  onClick={addSelected}
                  disabled={addingSelected || selected.size === 0}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                >
                  {addingSelected ? "adding..." : `add selected (${selected.size})`}
                </button>
              )}
            </div>
          </div>

          {suggesting && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs font-light text-muted-foreground animate-pulse">
                asking claude for {industryName} resources...
              </p>
            </div>
          )}

          {suggestError && (
            <div className="px-4 py-4">
              <p className="text-xs font-light text-red-500">{suggestError}</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <>
              <div className="px-4 py-2 border-b border-border/30 flex items-center gap-3">
                <button
                  onClick={() => setSelected(new Set(suggestions.map((_, i) => i)))}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  select all
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  deselect all
                </button>
              </div>
              <div className="divide-y divide-border/20">
                {suggestions.map((s, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSuggest(i)}
                      className="mt-0.5 accent-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-light text-foreground underline underline-offset-2 hover:text-foreground/70"
                        >
                          {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                        <span className="text-[10px] text-muted-foreground">{s.title}</span>
                      </div>
                      {s.notes && (
                        <p className="text-[11px] font-light text-muted-foreground mt-0.5 leading-relaxed">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Add form */}
      {addOpen && (
        <div className="border border-border rounded-md p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">url</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">notes</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              rows={2}
              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
            />
          </div>
          {error && <p className="text-xs font-light text-red-500">{error}</p>}
          <button
            onClick={addResource}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
          >
            {saving ? "saving..." : "save resource"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {["url", "title", "notes", "da", "source", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs font-light text-muted-foreground">
                  no resources saved yet.
                </td>
              </tr>
            ) : (
              resources.map((r) => (
                <tr key={r.id} className="border-b border-border/20 last:border-0 text-xs font-light hover:bg-muted/30">
                  <td className="px-3 py-2 max-w-[200px] truncate">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline underline-offset-2 hover:text-foreground/70"
                      >
                        {r.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.title ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{r.notes ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.domain_authority ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                  <td className="px-3 py-2">
                    {deleteConfirm === r.id ? (
                      <InlineConfirm
                        onConfirm={() => deleteResource(r.id)}
                        onCancel={() => setDeleteConfirm(null)}
                        loading={deleting === r.id}
                      />
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(r.id)}
                        disabled={deleting === r.id}
                        className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
