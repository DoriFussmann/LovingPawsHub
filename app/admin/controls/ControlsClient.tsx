"use client";

import { useState } from "react";
import { SlidersHorizontal, FileText, PenLine, BookOpen, ChevronRight, ChevronDown, Search, Trash2, Link2, RefreshCw, CheckCircle2, AlertCircle, Clock, X } from "lucide-react";
import PromptControlsModal from "@/components/admin/PromptControlsModal";
import ScoringWeightsModal, { type ScoringWeights } from "@/components/admin/ScoringWeightsModal";
import type { PromptConfig, ArticlePromptConfig, CoreArticlePromptConfig } from "@/lib/promptTemplates";

interface Props {
  skeletonConfig: PromptConfig;
  articleConfig: ArticlePromptConfig;
  coreArticleConfig: CoreArticlePromptConfig;
  scoringWeights: ScoringWeights;
}

type ModalOpen = "skeleton" | "article" | "core_article" | "weights" | null;

// ─── Duplicate Skeletons Panel ───────────────────────────────────────────────

type SkeletonDuplicateGroup = {
  cluster_id: string;
  cluster_display_name: string | null;
  content_type: string;
  count: number;
  skeletons: Array<{
    id: string;
    article_id: string;
    slug: string;
    created_at: string;
    has_article: boolean;
  }>;
};

function DuplicateSkeletonsPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ duplicate_groups: number; groups: SkeletonDuplicateGroup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, string>>({});

  async function run() {
    setLoading(true);
    setError(null);
    setFixResults({});
    try {
      const res = await fetch("/api/admin/audit-skeleton-duplicates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "audit failed");
      setData(json);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "audit failed");
    } finally {
      setLoading(false);
    }
  }

  async function fixGroup(group: SkeletonDuplicateGroup) {
    const key = `${group.cluster_id}__${group.content_type}`;
    setFixing(key);
    try {
      const res = await fetch("/api/admin/audit-skeleton-duplicates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster_id: group.cluster_id, content_type: group.content_type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "fix failed");
      setFixResults((prev) => ({ ...prev, [key]: `removed ${json.deleted} duplicate${json.deleted !== 1 ? "s" : ""}` }));
      // Remove fixed group from data
      setData((prev) =>
        prev
          ? {
              ...prev,
              duplicate_groups: prev.duplicate_groups - 1,
              groups: prev.groups.filter(
                (g) => !(g.cluster_id === group.cluster_id && g.content_type === group.content_type)
              ),
            }
          : prev
      );
    } catch (e) {
      setFixResults((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : "fix failed" }));
    } finally {
      setFixing(null);
    }
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/50">
            <RefreshCw size={14} />
          </div>
          <div>
            <p className="text-xs font-light text-foreground">
              fix duplicate skeletons
              {data && data.duplicate_groups > 0 && (
                <span className="ml-2 text-[10px] font-light px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                  {data.duplicate_groups} cluster{data.duplicate_groups !== 1 ? "s" : ""} affected
                </span>
              )}
              {data && data.duplicate_groups === 0 && (
                <span className="ml-2 text-[10px] font-light text-green-600">clean</span>
              )}
            </p>
            <p className="text-[11px] font-light text-muted-foreground mt-0.5">
              find and remove duplicate content_type skeletons within a cluster — keeps the newest, deletes the rest
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-500 font-light">{error}</span>}
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            {loading ? "scanning..." : "run audit"}
          </button>
          {data && (
            <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground hover:text-foreground transition-colors">
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>
      {open && data && (
        <div className="border-t border-border/50 px-5 py-4">
          {data.duplicate_groups === 0 ? (
            <p className="text-xs font-light text-green-600">no duplicate skeleton groups found.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                {data.duplicate_groups} duplicate group{data.duplicate_groups !== 1 ? "s" : ""} found
              </p>
              {data.groups.map((group) => {
                const key = `${group.cluster_id}__${group.content_type}`;
                const fixResult = fixResults[key];
                return (
                  <div key={key} className="border border-border/40 rounded-md overflow-hidden">
                    <div className="bg-muted/20 px-4 py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] tracking-widest uppercase text-foreground/40 shrink-0">
                          {group.content_type}
                        </span>
                        <span className="text-xs font-light text-foreground/70 truncate">
                          {group.cluster_display_name ?? group.cluster_id}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {group.count} skeletons
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {fixResult && (
                          <span className="text-[10px] font-light text-green-600">{fixResult}</span>
                        )}
                        <button
                          onClick={() => fixGroup(group)}
                          disabled={fixing === key}
                          className="px-2.5 py-1 text-[11px] font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
                        >
                          {fixing === key ? "fixing..." : "keep newest, delete rest"}
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-border/20">
                      {group.skeletons.map((s, i) => (
                        <div key={s.id} className="px-4 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-light text-foreground truncate">{s.article_id}</p>
                            <p className="text-[11px] text-muted-foreground font-light">{s.slug}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.has_article && (
                              <span className="text-[10px] text-amber-600 border border-amber-200 bg-amber-50 rounded px-1.5 py-0.5">
                                has article
                              </span>
                            )}
                            <span className={`text-[10px] font-light px-2 py-0.5 rounded-full border ${
                              i === 0
                                ? "border-green-300 text-green-700"
                                : "border-orange-200 text-orange-600"
                            }`}>
                              {i === 0 ? "keep" : "delete"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Duplicate Audit Panel ────────────────────────────────────────────────────

type DuplicateGroup = {
  match_type: string;
  matched_value: string;
  articles: Array<{
    article_id: string;
    h1_title: string;
    url: string;
    inbound_link_count: number;
    canonical_url: string | null;
    redirect_to: string | null;
    recommendation: string;
  }>;
};

function AuditDuplicatesPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ duplicate_groups: number; groups: DuplicateGroup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audit-duplicates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "audit failed");
      setData(json);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "audit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/50">
            <Search size={14} />
          </div>
          <div>
            <p className="text-xs font-light text-foreground">audit duplicate pages</p>
            <p className="text-[11px] font-light text-muted-foreground mt-0.5">find articles targeting the same keyword or title</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-500 font-light">{error}</span>}
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            {loading ? "scanning..." : "run audit"}
          </button>
          {data && (
            <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground hover:text-foreground transition-colors">
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </div>
      </div>
      {open && data && (
        <div className="border-t border-border/50 px-5 py-4">
          {data.duplicate_groups === 0 ? (
            <p className="text-xs font-light text-green-600">no duplicate groups found.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                {data.duplicate_groups} duplicate group{data.duplicate_groups !== 1 ? "s" : ""} found
              </p>
              {data.groups.map((group, i) => (
                <div key={i} className="border border-border/40 rounded-md overflow-hidden">
                  <div className="bg-muted/20 px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] tracking-widests uppercase text-foreground/40">{group.match_type}</span>
                    <span className="text-xs font-light text-foreground/70 truncate">{group.matched_value}</span>
                  </div>
                  <div className="divide-y divide-border/20">
                    {group.articles.map((a) => (
                      <div key={a.article_id} className="px-4 py-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-light text-foreground truncate">{a.h1_title}</p>
                          <p className="text-[11px] text-muted-foreground font-light">{a.url}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{a.inbound_link_count} inbound links</span>
                            {a.redirect_to && (
                              <span className="text-[10px] text-orange-500">redirects to {a.redirect_to}</span>
                            )}
                            {a.canonical_url && (
                              <span className="text-[10px] text-blue-500">canonical set</span>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-light px-2 py-0.5 rounded-full border ${
                          a.recommendation === "canonical_target"
                            ? "border-green-300 text-green-700"
                            : "border-orange-200 text-orange-600"
                        }`}>
                          {a.recommendation.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Clean Read More Panel ────────────────────────────────────────────────────

function CleanReadMorePanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; total_links_removed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/cleanup-readmore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "cleanup failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "cleanup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 border border-border rounded-md">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/50">
          <Trash2 size={14} />
        </div>
        <div>
          <p className="text-xs font-light text-foreground">clean Read More duplicates</p>
          <p className="text-[11px] font-light text-muted-foreground mt-0.5">
            {result
              ? `cleaned ${result.updated} article${result.updated !== 1 ? "s" : ""}, removed ${result.total_links_removed} duplicate link${result.total_links_removed !== 1 ? "s" : ""}`
              : error
              ? <span className="text-red-500">{error}</span>
              : "remove duplicate links from Read more sections across all articles"}
          </p>
        </div>
      </div>
      <button
        onClick={run}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
      >
        {loading ? "cleaning..." : "run cleanup"}
      </button>
    </div>
  );
}

// ─── Contextual Links Panel ───────────────────────────────────────────────────

function ContextualLinksPanel() {
  const [open, setOpen] = useState(false);
  const [clusterId, setClusterId] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Array<{ keyword: string; target_slug: string; enabled: boolean }>>([]);
  const [dryRunResult, setDryRunResult] = useState<{ total_pairs_added: number; total_links_injected: number; articles_processed: number } | null>(null);
  const [applyResult, setApplyResult] = useState<{ total_links_injected: number; articles_processed: number } | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function loadSuggestions() {
    if (!clusterId.trim()) return;
    setSuggestLoading(true);
    setSuggestError(null);
    setDryRunResult(null);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/admin/inject-contextual-links?cluster_id=${encodeURIComponent(clusterId.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed to load suggestions");
      const suggested = (json.suggested_pairs ?? []).map((p: { keyword: string; target_slug: string }) => ({
        keyword: p.keyword,
        target_slug: p.target_slug,
        enabled: true,
      }));
      setPairs(suggested);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "failed to load suggestions");
    } finally {
      setSuggestLoading(false);
    }
  }

  function addPair() {
    setPairs((p) => [...p, { keyword: "", target_slug: "", enabled: true }]);
  }

  function updatePair(i: number, field: "keyword" | "target_slug", value: string) {
    setPairs((p) => p.map((pair, idx) => idx === i ? { ...pair, [field]: value } : pair));
  }

  function togglePair(i: number) {
    setPairs((p) => p.map((pair, idx) => idx === i ? { ...pair, enabled: !pair.enabled } : pair));
  }

  function removePair(i: number) {
    setPairs((p) => p.filter((_, idx) => idx !== i));
  }

  async function runDryRun() {
    const activePairs = pairs.filter((p) => p.enabled && p.keyword.trim() && p.target_slug.trim());
    if (activePairs.length === 0) return;
    setApplyLoading(true);
    setApplyError(null);
    setDryRunResult(null);
    try {
      const res = await fetch("/api/admin/inject-contextual-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster_id: clusterId.trim(), pairs: activePairs, dry_run: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "preview failed");
      setDryRunResult(json);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "preview failed");
    } finally {
      setApplyLoading(false);
    }
  }

  async function applyLinks() {
    const activePairs = pairs.filter((p) => p.enabled && p.keyword.trim() && p.target_slug.trim());
    if (activePairs.length === 0) return;
    setApplyLoading(true);
    setApplyError(null);
    setDryRunResult(null);
    setApplyResult(null);
    try {
      const res = await fetch("/api/admin/inject-contextual-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster_id: clusterId.trim(), pairs: activePairs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "injection failed");
      setApplyResult(json);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "injection failed");
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/50">
          <Link2 size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">contextual inline links</p>
          <p className="text-[11px] font-light text-muted-foreground mt-0.5">inject keyword→url pairs into article body text (max 4 per article)</p>
        </div>
        {open ? <ChevronDown size={13} className="text-foreground/25 shrink-0" /> : <ChevronRight size={13} className="text-foreground/25 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border/50 px-5 py-4 space-y-4">

          {/* Cluster selector */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
              placeholder="cluster id (e.g. my-cluster-id)"
              className="flex-1 text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
            />
            <button
              onClick={loadSuggestions}
              disabled={suggestLoading || !clusterId.trim()}
              className="px-3 py-2 text-xs font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {suggestLoading ? "loading..." : "load suggestions"}
            </button>
          </div>
          {suggestError && <p className="text-xs text-red-500 font-light">{suggestError}</p>}

          {/* Pairs list */}
          {pairs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] tracking-widests uppercase text-foreground/40">keyword → target slug pairs</p>
              {pairs.map((pair, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pair.enabled}
                    onChange={() => togglePair(i)}
                    className="shrink-0"
                  />
                  <input
                    type="text"
                    value={pair.keyword}
                    onChange={(e) => updatePair(i, "keyword", e.target.value)}
                    placeholder="anchor keyword"
                    className="flex-1 text-xs font-light rounded-md border border-border px-2 py-1.5 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
                  />
                  <span className="text-muted-foreground text-xs">→</span>
                  <input
                    type="text"
                    value={pair.target_slug}
                    onChange={(e) => updatePair(i, "target_slug", e.target.value)}
                    placeholder="target slug"
                    className="flex-1 text-xs font-light rounded-md border border-border px-2 py-1.5 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
                  />
                  <button onClick={() => removePair(i)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addPair}
            className="text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            + add pair
          </button>

          {/* Results */}
          {dryRunResult && (
            <div className="bg-muted/30 rounded-md px-4 py-3">
              <p className="text-xs font-light text-foreground">
                preview: {dryRunResult.total_pairs_added} pair{dryRunResult.total_pairs_added !== 1 ? "s" : ""} would be added across {dryRunResult.articles_processed} article{dryRunResult.articles_processed !== 1 ? "s" : ""}
              </p>
            </div>
          )}
          {applyResult && (
            <p className="text-xs font-light text-green-600">
              injected {applyResult.total_links_injected} link{applyResult.total_links_injected !== 1 ? "s" : ""} across {applyResult.articles_processed} article{applyResult.articles_processed !== 1 ? "s" : ""}.
            </p>
          )}
          {applyError && <p className="text-xs text-red-500 font-light">{applyError}</p>}

          {/* Action buttons */}
          {pairs.some((p) => p.enabled && p.keyword.trim() && p.target_slug.trim()) && (
            <div className="flex items-center gap-2">
              <button
                onClick={runDryRun}
                disabled={applyLoading}
                className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
              >
                {applyLoading && !dryRunResult ? "previewing..." : "preview"}
              </button>
              <button
                onClick={applyLinks}
                disabled={applyLoading}
                className="px-3 py-1.5 text-xs font-light rounded-md border border-foreground/30 bg-foreground text-background hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {applyLoading && dryRunResult !== null ? "injecting..." : "inject links"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Article Updates Panel ───────────────────────────────────────────────────

interface UpdateArticle {
  id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  key_highlights: string[] | null;
  updated_at: string | null;
  published_at: string | null;
  stale: boolean;
}

type ArticleUpdateStatus =
  | null
  | "pending"
  | "updating"
  | { ok: true; news_title: string; news_url: string }
  | { ok: false; reason: string };

function isStaleClient(a: UpdateArticle, staleDays: number): boolean {
  const ref = a.updated_at ?? a.published_at;
  if (!ref) return true;
  return Date.now() - new Date(ref).getTime() > staleDays * 24 * 60 * 60 * 1000;
}

function ArticleUpdatesPanel() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<UpdateArticle[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staleDays, setStaleDays] = useState(90);

  // "update all" flow phases
  type Phase = "idle" | "confirm" | "running" | "done";
  const [phase, setPhase] = useState<Phase>("idle");
  const [staleList, setStaleList] = useState<UpdateArticle[]>([]);
  const [runIndex, setRunIndex] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  // Per-article status
  const [statusMap, setStatusMap] = useState<Record<string, ArticleUpdateStatus>>({});

  async function loadArticles() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/article-updates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setArticles(json.articles ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  function openOverlay() {
    setOverlayOpen(true);
    if (articles.length === 0) loadArticles();
  }

  function closeOverlay() {
    setOverlayOpen(false);
    setPhase("idle");
    setStaleList([]);
    setRunIndex(0);
    setUpdatedCount(0);
    setSkippedCount(0);
  }

  // Kick off "update all": compute stale list and wait for user confirmation
  function startUpdateAll() {
    const stale = articles.filter((a) => isStaleClient(a, staleDays));
    setStaleList(stale);
    setPhase(stale.length === 0 ? "done" : "confirm");
    // Mark all stale as "pending" visually
    setStatusMap((prev) => {
      const next = { ...prev };
      stale.forEach((a) => { next[a.id] = "pending"; });
      return next;
    });
  }

  // Run update pipeline article by article
  async function runUpdates() {
    setPhase("running");
    setRunIndex(0);
    setUpdatedCount(0);
    setSkippedCount(0);

    for (let i = 0; i < staleList.length; i++) {
      const article = staleList[i];
      setRunIndex(i);
      setStatusMap((prev) => ({ ...prev, [article.id]: "updating" }));

      try {
        const res = await fetch("/api/admin/article-updates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: article.id }),
        });
        const json = await res.json();

        if (json.updated) {
          setStatusMap((prev) => ({
            ...prev,
            [article.id]: { ok: true, news_title: json.news_title, news_url: json.news_url },
          }));
          setUpdatedCount((c) => c + 1);
          // Update local article record so stale badge refreshes
          setArticles((prev) =>
            prev.map((a) => a.id === article.id ? { ...a, updated_at: new Date().toISOString(), stale: false } : a)
          );
        } else {
          const reason = json.reason ?? (json.error ?? "skipped");
          setStatusMap((prev) => ({ ...prev, [article.id]: { ok: false, reason } }));
          setSkippedCount((c) => c + 1);
        }
      } catch (e) {
        setStatusMap((prev) => ({
          ...prev,
          [article.id]: { ok: false, reason: e instanceof Error ? e.message : "error" },
        }));
        setSkippedCount((c) => c + 1);
      }
    }

    setRunIndex(staleList.length);
    setPhase("done");
  }

  async function updateSingle(article: UpdateArticle) {
    setStatusMap((prev) => ({ ...prev, [article.id]: "updating" }));
    try {
      const res = await fetch("/api/admin/article-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id }),
      });
      const json = await res.json();
      if (json.updated) {
        setStatusMap((prev) => ({
          ...prev,
          [article.id]: { ok: true, news_title: json.news_title, news_url: json.news_url },
        }));
        setArticles((prev) =>
          prev.map((a) => a.id === article.id ? { ...a, updated_at: new Date().toISOString(), stale: false } : a)
        );
      } else {
        const reason = json.reason ?? (json.error ?? "skipped");
        setStatusMap((prev) => ({ ...prev, [article.id]: { ok: false, reason } }));
      }
    } catch (e) {
      setStatusMap((prev) => ({
        ...prev,
        [article.id]: { ok: false, reason: e instanceof Error ? e.message : "error" },
      }));
    }
  }

  const staleCount = articles.filter((a) => isStaleClient(a, staleDays)).length;

  return (
    <>
      {/* Collapsed row */}
      <div className="border border-border rounded-md overflow-hidden">
        <button
          onClick={openOverlay}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/50">
            <RefreshCw size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-light text-foreground">article updates</p>
            <p className="text-[11px] font-light text-muted-foreground mt-0.5">
              scan for stale articles (&gt;{staleDays} days), fetch recent news, and append an update section
            </p>
          </div>
          <ChevronRight size={13} className="text-foreground/25 shrink-0" />
        </button>
      </div>

      {/* Full-screen overlay */}
      {overlayOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">

          {/* Header bar */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-border shrink-0">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-0.5">seo maintenance</p>
              <h2 className="text-lg font-extralight tracking-tight text-foreground">article updates</h2>
            </div>
            <div className="flex items-center gap-3">
              {loading && <p className="text-xs text-muted-foreground font-light">loading…</p>}
              {phase === "idle" && (
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-light text-muted-foreground whitespace-nowrap">stale after</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={staleDays}
                    onChange={(e) => setStaleDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 text-xs font-light text-center rounded-md border border-border px-2 py-1 bg-background focus:outline-none focus:border-foreground/50"
                  />
                  <span className="text-[11px] font-light text-muted-foreground">days</span>
                </div>
              )}
              {!loading && articles.length > 0 && phase === "idle" && (
                <span className="text-[11px] font-light text-muted-foreground">
                  {staleCount} of {articles.length} need update
                </span>
              )}

              {/* update all */}
              {phase === "idle" && !loading && articles.length > 0 && (
                <button
                  onClick={startUpdateAll}
                  className="px-4 py-2 text-xs font-light rounded-md border border-foreground/30 bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  update all
                </button>
              )}

              {/* confirm step */}
              {phase === "confirm" && (
                <div className="flex items-center gap-3">
                  <p className="text-xs font-light text-foreground">
                    {staleList.length} article{staleList.length !== 1 ? "s" : ""} need an update — continue?
                  </p>
                  <button
                    onClick={runUpdates}
                    className="px-4 py-2 text-xs font-light rounded-md border border-foreground/30 bg-foreground text-background hover:opacity-90 transition-opacity"
                  >
                    continue
                  </button>
                  <button
                    onClick={() => { setPhase("idle"); setStatusMap({}); }}
                    className="px-3 py-2 text-xs font-light rounded-md border border-border hover:bg-muted/50 transition-colors"
                  >
                    cancel
                  </button>
                </div>
              )}

              {/* running progress */}
              {phase === "running" && (
                <p className="text-xs font-light text-foreground animate-pulse">
                  updating article {Math.min(runIndex + 1, staleList.length)} of {staleList.length}…
                </p>
              )}

              {/* done summary */}
              {phase === "done" && staleList.length > 0 && (
                <p className="text-xs font-light text-green-600">
                  done — {updatedCount} updated, {skippedCount} skipped
                </p>
              )}
              {phase === "done" && staleList.length === 0 && (
                <p className="text-xs font-light text-muted-foreground">all articles are up to date</p>
              )}

              <button
                onClick={closeOverlay}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted/40 transition-colors text-foreground/50 hover:text-foreground"
                title="close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {loadError && (
              <p className="text-xs text-red-500 font-light">{loadError}</p>
            )}

            {!loading && articles.length === 0 && !loadError && (
              <p className="text-xs text-muted-foreground font-light">no published articles found.</p>
            )}

            {articles.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {articles.map((article) => {
                  const status = statusMap[article.id] ?? null;
                  const isUpdating = status === "updating";
                  const isPending = status === "pending";

                  return (
                    <div
                      key={article.id}
                      className="border border-border rounded-md p-4 flex flex-col gap-3"
                    >
                      {/* Title + stale badge */}
                      <div className="flex items-start gap-2">
                        <p className="text-xs font-light text-foreground flex-1 leading-snug">
                          {article.h1_title}
                        </p>
                        {isStaleClient(article, staleDays) && status === null && (
                          <span className="shrink-0 mt-0.5" title="needs update">
                            <Clock size={11} className="text-orange-400" />
                          </span>
                        )}
                      </div>

                      {/* Last updated */}
                      <p className="text-[10px] font-light text-muted-foreground">
                        {article.updated_at
                          ? `updated ${new Date(article.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                          : article.published_at
                          ? `published ${new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                          : "no date"}
                      </p>

                      {/* Status feedback */}
                      {typeof status === "object" && status !== null && status.ok && (
                        <div className="flex items-start gap-1.5 text-[10px] font-light text-green-600">
                          <CheckCircle2 size={11} className="shrink-0 mt-0.5" />
                          <span>updated — <a href={status.news_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-70 transition-opacity">{status.news_title}</a></span>
                        </div>
                      )}
                      {typeof status === "object" && status !== null && !status.ok && (
                        <div className="flex items-start gap-1.5 text-[10px] font-light text-muted-foreground">
                          <AlertCircle size={11} className="shrink-0 mt-0.5" />
                          <span>{status.reason}</span>
                        </div>
                      )}
                      {(isUpdating || isPending) && (
                        <p className="text-[10px] font-light text-muted-foreground animate-pulse">
                          {isUpdating ? "updating…" : "queued"}
                        </p>
                      )}

                      {/* Update button */}
                      {status === null && (
                        <button
                          onClick={() => updateSingle(article)}
                          disabled={phase === "running"}
                          className="mt-auto self-start px-3 py-1.5 text-[11px] font-light rounded-md border border-border hover:bg-muted/50 disabled:opacity-40 transition-colors"
                        >
                          update
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────

function ControlButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 border border-border rounded-md hover:bg-muted/40 hover:border-foreground/20 transition-colors text-left group"
    >
      <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/50 group-hover:text-foreground transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-light text-foreground">{title}</p>
        <p className="text-[11px] font-light text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ChevronRight size={13} className="text-foreground/25 shrink-0 group-hover:text-foreground/50 transition-colors" />
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-3">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function ControlsClient({ skeletonConfig, articleConfig, coreArticleConfig, scoringWeights }: Props) {
  const [modal, setModal] = useState<ModalOpen>(null);
  const [currentSkeletonConfig, setCurrentSkeletonConfig] = useState(skeletonConfig);
  const [currentArticleConfig, setCurrentArticleConfig] = useState(articleConfig);
  const [currentCoreArticleConfig, setCurrentCoreArticleConfig] = useState(coreArticleConfig);
  const [currentWeights, setCurrentWeights] = useState(scoringWeights);

  return (
    <div className="max-w-xl">

      <Section label="content generation">
        <ControlButton
          icon={<FileText size={14} />}
          title="brief / skeleton prompts"
          description="system prompt, user prompt template, and per-type add-ons for brief generation"
          onClick={() => setModal("skeleton")}
        />
        <ControlButton
          icon={<PenLine size={14} />}
          title="article writing prompts"
          description="system prompt and user prompt template for cluster article generation"
          onClick={() => setModal("article")}
        />
        <ControlButton
          icon={<BookOpen size={14} />}
          title="core article writing prompts"
          description="system prompt and user prompt template for core pillar article generation"
          onClick={() => setModal("core_article")}
        />
      </Section>

      <Section label="keyword research">
        <ControlButton
          icon={<SlidersHorizontal size={14} />}
          title="keyword scoring weights"
          description={`volume ${currentWeights.volume}% · cpc ${currentWeights.cpc}% · kd ${currentWeights.kd}% · competition ${currentWeights.competition}%`}
          onClick={() => setModal("weights")}
        />
      </Section>

      <Section label="seo maintenance">
        <DuplicateSkeletonsPanel />
        <AuditDuplicatesPanel />
        <CleanReadMorePanel />
        <ContextualLinksPanel />
        <ArticleUpdatesPanel />
      </Section>

      {/* Modals */}
      {modal === "skeleton" && (
        <PromptControlsModal
          variant="skeleton"
          config={currentSkeletonConfig}
          onSave={(c) => setCurrentSkeletonConfig(c as PromptConfig)}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "article" && (
        <PromptControlsModal
          variant="article"
          config={currentArticleConfig}
          onSave={(c) => setCurrentArticleConfig(c as ArticlePromptConfig)}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "core_article" && (
        <PromptControlsModal
          variant="core_article"
          config={currentCoreArticleConfig}
          onSave={(c) => setCurrentCoreArticleConfig(c as CoreArticlePromptConfig)}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "weights" && (
        <ScoringWeightsModal
          weights={currentWeights}
          onSave={(w) => setCurrentWeights(w)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
