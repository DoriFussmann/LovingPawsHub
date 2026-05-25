"use client";

import { useState, useCallback } from "react";
import { Plus, Sparkles, ChevronDown, ChevronUp, Pencil, Trash2, Check, X, Loader2, ExternalLink } from "lucide-react";

interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  description: string | null;
  examples: string[];
  resources: { title: string; url: string }[];
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface GlossarySeo {
  glossary_meta_title: string;
  glossary_meta_description: string;
  glossary_og_title: string;
  glossary_og_description: string;
}

interface TermDraft {
  id?: string;
  term: string;
  description: string;
  examples: string[];
  resources: { title: string; url: string }[];
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  status: "published" | "draft";
}

interface SuggestedTerm {
  term: string;
  slug: string;
  description: string;
  examples: string[];
  resources: { title: string; url: string }[];
  meta_title: string;
  meta_description: string;
  approved: boolean;
  expanded: boolean;
}

type View = "list" | "form" | "suggest";

const emptyDraft = (): TermDraft => ({
  term: "",
  description: "",
  examples: [""],
  resources: [{ title: "", url: "" }],
  meta_title: "",
  meta_description: "",
  og_title: "",
  og_description: "",
  status: "published",
});

export default function GlossaryClient({
  initialTerms,
  initialSeo,
  industryName,
}: {
  initialTerms: GlossaryTerm[];
  initialSeo: GlossarySeo;
  industryName: string;
}) {
  const [terms, setTerms] = useState<GlossaryTerm[]>(initialTerms);
  const [view, setView] = useState<View>("list");
  const [draft, setDraft] = useState<TermDraft>(emptyDraft());
  const [seoOpen, setSeoOpen] = useState(false);
  const [seo, setSeo] = useState<GlossarySeo>(initialSeo);
  const [seoSaving, setSeoSaving] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedTerm[]>([]);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formSeoOpen, setFormSeoOpen] = useState(false);

  // ── Page SEO save ────────────────────────────────────────────────────────
  async function savePageSeo() {
    setSeoSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seo),
      });
      if (!res.ok) throw new Error(await res.text());
      setSeoSaved(true);
      setTimeout(() => setSeoSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save SEO");
    } finally {
      setSeoSaving(false);
    }
  }

  // ── Term CRUD ────────────────────────────────────────────────────────────
  function editTerm(t: GlossaryTerm) {
    setDraft({
      id: t.id,
      term: t.term,
      description: t.description ?? "",
      examples: t.examples?.length ? t.examples : [""],
      resources: t.resources?.length ? t.resources : [{ title: "", url: "" }],
      meta_title: t.meta_title ?? "",
      meta_description: t.meta_description ?? "",
      og_title: t.og_title ?? "",
      og_description: t.og_description ?? "",
      status: (t.status as "published" | "draft") ?? "published",
    });
    setView("form");
    setError(null);
  }

  async function deleteTerm(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setTerms((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function saveTerm() {
    if (!draft.term.trim()) { setError("Term name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...(draft.id ? { id: draft.id } : {}),
        term: draft.term,
        description: draft.description || null,
        examples: draft.examples.filter((e) => e.trim()),
        resources: draft.resources.filter((r) => r.title.trim() || r.url.trim()),
        meta_title: draft.meta_title || null,
        meta_description: draft.meta_description || null,
        og_title: draft.og_title || null,
        og_description: draft.og_description || null,
        status: draft.status,
      };
      const res = await fetch("/api/admin/glossary", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (draft.id) {
        setTerms((prev) => prev.map((t) => (t.id === draft.id ? json.term : t)));
      } else {
        setTerms((prev) => [...prev, json.term]);
      }
      setDraft(emptyDraft());
      setView("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── AI Complete ──────────────────────────────────────────────────────────
  async function aiComplete() {
    if (!draft.term.trim()) { setError("Enter a term name first"); return; }
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/glossary/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: draft.term,
          description: draft.description || undefined,
          examples: draft.examples.filter((e) => e.trim()).length ? draft.examples.filter((e) => e.trim()) : undefined,
          resources: draft.resources.filter((r) => r.url.trim()).length ? draft.resources.filter((r) => r.url.trim()) : undefined,
          meta_title: draft.meta_title || undefined,
          meta_description: draft.meta_description || undefined,
          og_title: draft.og_title || undefined,
          og_description: draft.og_description || undefined,
          industry: industryName,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { completed } = await res.json();
      setDraft((prev) => ({
        ...prev,
        description: prev.description || completed.description,
        examples: prev.examples.filter((e) => e.trim()).length ? prev.examples : completed.examples,
        resources: prev.resources.filter((r) => r.url.trim()).length ? prev.resources : completed.resources,
        meta_title: prev.meta_title || completed.meta_title,
        meta_description: prev.meta_description || completed.meta_description,
        og_title: prev.og_title || completed.og_title,
        og_description: prev.og_description || completed.og_description,
      }));
      setFormSeoOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI completion failed");
    } finally {
      setCompleting(false);
    }
  }

  // ── AI Suggestions ───────────────────────────────────────────────────────
  async function fetchSuggestions() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/glossary/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingTerms: terms.map((t) => t.term),
          industry: industryName,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { suggestions: raw } = await res.json();
      setSuggestions(
        raw.map((s: Omit<SuggestedTerm, "approved" | "expanded">) => ({
          ...s,
          approved: true,
          expanded: false,
        }))
      );
      setView("suggest");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI suggestions failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function saveApprovedSuggestions() {
    const approved = suggestions.filter((s) => s.approved);
    if (!approved.length) { setError("Select at least one term to save"); return; }
    setSavingSuggestions(true);
    setError(null);
    try {
      const saved: GlossaryTerm[] = [];
      for (const s of approved) {
        const res = await fetch("/api/admin/glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: s.term,
            description: s.description,
            examples: s.examples,
            resources: s.resources,
            meta_title: s.meta_title,
            meta_description: s.meta_description,
            status: "published",
          }),
        });
        if (!res.ok) { const t = await res.text(); throw new Error(t); }
        const { term } = await res.json();
        saved.push(term);
      }
      setTerms((prev) => [...prev, ...saved]);
      setSuggestions([]);
      setView("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save suggestions");
    } finally {
      setSavingSuggestions(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const updateSuggestion = useCallback((idx: number, patch: Partial<SuggestedTerm>) => {
    setSuggestions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }, []);

  const inputCls = "w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-xs font-light text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 focus:bg-background transition-colors";
  const textareaCls = `${inputCls} resize-none`;
  const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2 text-xs font-light rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const btnSecondary = "inline-flex items-center gap-1.5 px-4 py-2 text-xs font-light rounded-md border border-border text-foreground/70 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs font-light text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0"><X size={12} /></button>
        </div>
      )}

      {/* Glossary Page SEO */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => setSeoOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-xs font-medium text-foreground/70 tracking-wide">glossary page seo</span>
          {seoOpen ? <ChevronUp size={13} className="text-foreground/40" /> : <ChevronDown size={13} className="text-foreground/40" />}
        </button>
        {seoOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border">
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">meta title</label>
                <input className={inputCls} value={seo.glossary_meta_title} onChange={(e) => setSeo((p) => ({ ...p, glossary_meta_title: e.target.value }))} placeholder="Glossary | Site Name" />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">og title</label>
                <input className={inputCls} value={seo.glossary_og_title} onChange={(e) => setSeo((p) => ({ ...p, glossary_og_title: e.target.value }))} placeholder="Glossary" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">meta description</label>
              <textarea className={textareaCls} rows={2} value={seo.glossary_meta_description} onChange={(e) => setSeo((p) => ({ ...p, glossary_meta_description: e.target.value }))} placeholder="Browse our glossary of key terms…" />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">og description</label>
              <textarea className={textareaCls} rows={2} value={seo.glossary_og_description} onChange={(e) => setSeo((p) => ({ ...p, glossary_og_description: e.target.value }))} placeholder="Browse our glossary of key terms…" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={savePageSeo} disabled={seoSaving} className={btnPrimary}>
                {seoSaving ? <Loader2 size={11} className="animate-spin" /> : null}
                {seoSaving ? "saving…" : "save seo"}
              </button>
              {seoSaved && <span className="text-xs font-light text-green-600 flex items-center gap-1"><Check size={11} />saved</span>}
            </div>
          </div>
        )}
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-light text-muted-foreground">{terms.length} term{terms.length !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSuggestions}
                disabled={suggesting}
                className={btnSecondary}
              >
                {suggesting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {suggesting ? "generating…" : "ai suggestions"}
              </button>
              <button
                onClick={() => { setDraft(emptyDraft()); setView("form"); setError(null); setFormSeoOpen(false); }}
                className={btnPrimary}
              >
                <Plus size={11} />
                add term
              </button>
            </div>
          </div>

          {terms.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <p className="text-xs font-light text-muted-foreground mb-3">no terms yet.</p>
              <button onClick={() => { setDraft(emptyDraft()); setView("form"); }} className={btnPrimary}>
                <Plus size={11} /> add your first term
              </button>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-foreground/50 tracking-wide">term</th>
                    <th className="text-left px-4 py-2.5 font-medium text-foreground/50 tracking-wide hidden md:table-cell">slug</th>
                    <th className="text-left px-4 py-2.5 font-medium text-foreground/50 tracking-wide hidden lg:table-cell">status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-light text-foreground">{t.term}</td>
                      <td className="px-4 py-3 font-mono text-foreground/40 hidden md:table-cell">{t.slug}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${t.status === "published" ? "bg-green-50 text-green-700 border border-green-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/glossary/${t.slug}`} target="_blank" rel="noopener noreferrer" className="text-foreground/30 hover:text-foreground/60 transition-colors" title="view on site">
                            <ExternalLink size={12} />
                          </a>
                          <button onClick={() => editTerm(t)} className="text-foreground/40 hover:text-foreground transition-colors" title="edit">
                            <Pencil size={12} />
                          </button>
                          {deleteConfirm === t.id ? (
                            <span className="flex items-center gap-1.5">
                              <button onClick={() => deleteTerm(t.id)} className="text-red-500 hover:text-red-700 transition-colors text-[10px]">confirm</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-foreground/40 hover:text-foreground transition-colors text-[10px]">cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirm(t.id)} className="text-foreground/30 hover:text-red-500 transition-colors" title="delete">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Term form (add / edit) */}
      {view === "form" && (
        <div className="border border-border rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-light text-foreground">{draft.id ? "edit term" : "add term"}</h2>
            <button onClick={() => { setView("list"); setError(null); }} className="text-foreground/40 hover:text-foreground transition-colors"><X size={14} /></button>
          </div>

          {/* Term name */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1.5">term name <span className="text-red-400">*</span></label>
            <input
              className={inputCls}
              value={draft.term}
              onChange={(e) => setDraft((p) => ({ ...p, term: e.target.value }))}
              placeholder="e.g. Working Capital"
            />
            {draft.term.trim() && (
              <p className="text-[10px] text-foreground/30 mt-1 font-mono">slug: {draft.term.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1.5">description <span className="text-red-400">*</span></label>
            <textarea
              className={textareaCls}
              rows={4}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder="A clear, plain-text definition suitable for a general audience."
            />
          </div>

          {/* Examples */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1.5">examples</label>
            <div className="space-y-2">
              {draft.examples.map((ex, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputCls}
                    value={ex}
                    onChange={(e) => {
                      const next = [...draft.examples];
                      next[i] = e.target.value;
                      setDraft((p) => ({ ...p, examples: next }));
                    }}
                    placeholder={`Example ${i + 1}`}
                  />
                  <button
                    onClick={() => setDraft((p) => ({ ...p, examples: p.examples.filter((_, j) => j !== i) }))}
                    className="text-foreground/30 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDraft((p) => ({ ...p, examples: [...p.examples, ""] }))}
                className="text-[10px] font-light text-foreground/40 hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Plus size={10} /> add example
              </button>
            </div>
          </div>

          {/* Resources */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1.5">resources</label>
            <div className="space-y-2">
              {draft.resources.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputCls}
                    value={r.title}
                    onChange={(e) => {
                      const next = [...draft.resources];
                      next[i] = { ...next[i], title: e.target.value };
                      setDraft((p) => ({ ...p, resources: next }));
                    }}
                    placeholder="Link title"
                  />
                  <input
                    className={inputCls}
                    value={r.url}
                    onChange={(e) => {
                      const next = [...draft.resources];
                      next[i] = { ...next[i], url: e.target.value };
                      setDraft((p) => ({ ...p, resources: next }));
                    }}
                    placeholder="https://…"
                  />
                  <button
                    onClick={() => setDraft((p) => ({ ...p, resources: p.resources.filter((_, j) => j !== i) }))}
                    className="text-foreground/30 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDraft((p) => ({ ...p, resources: [...p.resources, { title: "", url: "" }] }))}
                className="text-[10px] font-light text-foreground/40 hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Plus size={10} /> add resource
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1.5">status</label>
            <select
              className={inputCls}
              value={draft.status}
              onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as "published" | "draft" }))}
            >
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>
          </div>

          {/* SEO accordion */}
          <div className="border border-border/50 rounded-md overflow-hidden">
            <button
              onClick={() => setFormSeoOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-muted/20"
            >
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/50">seo fields</span>
              {formSeoOpen ? <ChevronUp size={11} className="text-foreground/40" /> : <ChevronDown size={11} className="text-foreground/40" />}
            </button>
            {formSeoOpen && (
              <div className="p-4 space-y-3 border-t border-border/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">meta title</label>
                    <input className={inputCls} value={draft.meta_title} onChange={(e) => setDraft((p) => ({ ...p, meta_title: e.target.value }))} placeholder="50-60 chars" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">og title</label>
                    <input className={inputCls} value={draft.og_title} onChange={(e) => setDraft((p) => ({ ...p, og_title: e.target.value }))} placeholder="Open Graph title" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">meta description</label>
                  <textarea className={textareaCls} rows={2} value={draft.meta_description} onChange={(e) => setDraft((p) => ({ ...p, meta_description: e.target.value }))} placeholder="140-155 chars" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">og description</label>
                  <textarea className={textareaCls} rows={2} value={draft.og_description} onChange={(e) => setDraft((p) => ({ ...p, og_description: e.target.value }))} placeholder="Open Graph description" />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveTerm} disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {saving ? "saving…" : "save term"}
            </button>
            <button onClick={aiComplete} disabled={completing} className={btnSecondary}>
              {completing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {completing ? "completing…" : "ai complete"}
            </button>
            <button onClick={() => { setView("list"); setError(null); }} className={btnSecondary}>cancel</button>
          </div>
        </div>
      )}

      {/* AI Suggestions review */}
      {view === "suggest" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-light text-foreground">ai suggestions</h2>
              <p className="text-xs font-light text-muted-foreground mt-0.5">review, edit, and approve terms before saving</p>
            </div>
            <button onClick={() => { setSuggestions([]); setView("list"); setError(null); }} className="text-foreground/40 hover:text-foreground transition-colors"><X size={14} /></button>
          </div>

          {suggesting ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={18} className="animate-spin text-foreground/40" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {suggestions.map((s, idx) => (
                  <div key={idx} className={`border rounded-lg overflow-hidden transition-colors ${s.approved ? "border-border" : "border-border/30 opacity-60"}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={s.approved}
                        onChange={(e) => updateSuggestion(idx, { approved: e.target.checked })}
                        className="accent-foreground w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="flex-1 text-sm font-light text-foreground">{s.term}</span>
                      <button
                        onClick={() => updateSuggestion(idx, { expanded: !s.expanded })}
                        className="text-foreground/40 hover:text-foreground transition-colors"
                      >
                        {s.expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {s.expanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/50">
                        <div className="mt-3">
                          <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">description</label>
                          <textarea
                            className={textareaCls}
                            rows={3}
                            value={s.description}
                            onChange={(e) => updateSuggestion(idx, { description: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">examples</label>
                          <div className="space-y-1.5">
                            {s.examples.map((ex, ei) => (
                              <div key={ei} className="flex gap-2">
                                <input
                                  className={inputCls}
                                  value={ex}
                                  onChange={(e) => {
                                    const next = [...s.examples];
                                    next[ei] = e.target.value;
                                    updateSuggestion(idx, { examples: next });
                                  }}
                                />
                                <button onClick={() => updateSuggestion(idx, { examples: s.examples.filter((_, j) => j !== ei) })} className="text-foreground/30 hover:text-red-500 shrink-0"><X size={11} /></button>
                              </div>
                            ))}
                            <button onClick={() => updateSuggestion(idx, { examples: [...s.examples, ""] })} className="text-[10px] text-foreground/40 hover:text-foreground flex items-center gap-1"><Plus size={9} />add</button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">resources</label>
                          <div className="space-y-1.5">
                            {s.resources.map((r, ri) => (
                              <div key={ri} className="flex gap-2">
                                <input className={inputCls} value={r.title} placeholder="title" onChange={(e) => { const next = [...s.resources]; next[ri] = { ...next[ri], title: e.target.value }; updateSuggestion(idx, { resources: next }); }} />
                                <input className={inputCls} value={r.url} placeholder="url" onChange={(e) => { const next = [...s.resources]; next[ri] = { ...next[ri], url: e.target.value }; updateSuggestion(idx, { resources: next }); }} />
                                <button onClick={() => updateSuggestion(idx, { resources: s.resources.filter((_, j) => j !== ri) })} className="text-foreground/30 hover:text-red-500 shrink-0"><X size={11} /></button>
                              </div>
                            ))}
                            <button onClick={() => updateSuggestion(idx, { resources: [...s.resources, { title: "", url: "" }] })} className="text-[10px] text-foreground/40 hover:text-foreground flex items-center gap-1"><Plus size={9} />add</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">meta title</label>
                            <input className={inputCls} value={s.meta_title} onChange={(e) => updateSuggestion(idx, { meta_title: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">meta description</label>
                            <input className={inputCls} value={s.meta_description} onChange={(e) => updateSuggestion(idx, { meta_description: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={saveApprovedSuggestions} disabled={savingSuggestions || suggestions.filter((s) => s.approved).length === 0} className={btnPrimary}>
                  {savingSuggestions ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  {savingSuggestions ? "saving…" : `save (${suggestions.filter((s) => s.approved).length})`}
                </button>
                <button
                  onClick={() => {
                    const allApproved = suggestions.every((s) => s.approved);
                    setSuggestions((prev) => prev.map((s) => ({ ...s, approved: !allApproved })));
                  }}
                  className={btnSecondary}
                >
                  {suggestions.every((s) => s.approved) ? "deselect all" : "select all"}
                </button>
                <button onClick={() => { setSuggestions([]); setView("list"); }} className={btnSecondary}>cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
