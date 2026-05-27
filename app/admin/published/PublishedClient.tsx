"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  UserX,
  Check,
  RefreshCw,
  X,
  PlayCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import StatusBadge from "@/components/admin/StatusBadge";

// Word count targets per content type — mirrors promptTemplates.ts DEFAULT_TYPE_ADDONS
const WORD_TARGETS: Record<string, { min: number; max: number }> = {
  CORE:       { min: 2500, max: 4000 },
  HUB:        { min: 500,  max: 800  },
  FAQ:        { min: 800,  max: 1200 },
  COMPARISON: { min: 1000, max: 1500 },
  RISK:       { min: 800,  max: 1200 },
  GUIDE:      { min: 1200, max: 1800 },
};

interface ArticleRow {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  content_type: string;
  is_core_article: boolean;
  primary_keyword: string;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  robots_directive: string | null;
  schema_type: string | null;
  schema_markup: unknown;
  body_markdown: string;
  table_of_contents: unknown;
  internal_links_injected: unknown;
  related_articles: unknown;
  external_links: unknown;
  link_status: string;
  reviewer_name: string | null;
  author_url: string | null;
  published_at: string | null;
  generated_at: string | null;
  updated_at: string | null;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image_url: string;
}

interface PublishedClientProps {
  articles: ArticleRow[];
  coreKeywords: Array<{ id: string; keyword: string; core_id: string }>;
  bridgeKeywords: Array<{ id: string; keyword: string; bridge_id: string }>;
  teamMembers: TeamMember[];
}

type BatchItemStatus = "pending" | "rewriting" | "done" | "error";

interface BatchItem {
  article_id: string;
  db_id: string;
  title: string;
  content_type: string;
  words_before: number;
  words_after?: number;
  status: BatchItemStatus;
  error?: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function wordCount(md: string): number {
  return md ? md.trim().split(/\s+/).filter(Boolean).length : 0;
}

function isUnderTarget(md: string, type: string): boolean {
  const target = WORD_TARGETS[type];
  if (!target) return false;
  return wordCount(md) < target.min;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">{label}</p>
      <div className="text-xs font-light text-foreground leading-relaxed">{value}</div>
    </div>
  );
}

function JsonField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  const isEmpty = Array.isArray(value) ? value.length === 0 : Object.keys(value as object).length === 0;
  if (isEmpty) return null;
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">{label}</p>
      <pre className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function GapBadge({ words, type }: { words: number; type: string }) {
  const target = WORD_TARGETS[type];
  if (!target) return <span className="text-[10px] text-foreground/30">—</span>;
  const gap = words - target.min;
  if (gap >= 0) {
    return <span className="text-[10px] font-light text-emerald-500">+{gap.toLocaleString()} over min</span>;
  }
  return (
    <span className={`text-[10px] font-medium ${gap < -500 ? "text-red-500" : "text-orange-400"}`}>
      {gap.toLocaleString()} words short
    </span>
  );
}

// ── Batch progress panel ──────────────────────────────────────────────────────

function BatchPanel({
  items,
  onClose,
  canClose,
}: {
  items: BatchItem[];
  onClose: () => void;
  canClose: boolean;
}) {
  const done = items.filter((i) => i.status === "done").length;
  const errors = items.filter((i) => i.status === "error").length;
  const total = items.length;
  const inProgress = items.find((i) => i.status === "rewriting");
  const pct = total > 0 ? Math.round((done + errors) / total * 100) : 0;

  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active item into view
  const activeRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="relative w-full max-w-2xl mx-4 bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-0.5">batch rewrite</p>
            <h2 className="text-sm font-light text-foreground">
              {done + errors < total
                ? inProgress
                  ? `Rewriting "${inProgress.title.slice(0, 50)}${inProgress.title.length > 50 ? "…" : ""}"`
                  : "Starting…"
                : errors > 0
                ? `Completed — ${done} done, ${errors} failed`
                : "All rewrites complete"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={!canClose}
            className="shrink-0 p-1.5 rounded-md hover:bg-muted/50 text-foreground/40 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={canClose ? "close" : "wait for completion"}
          >
            <X size={14} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-foreground/50">{done + errors} / {total} complete</span>
            <span className="text-[11px] text-foreground/50">{pct}%</span>
          </div>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${errors > 0 && done + errors === total ? "bg-orange-400" : "bg-foreground"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {items.map((item) => {
            const isActive = item.status === "rewriting";
            return (
              <div
                key={item.article_id}
                ref={isActive ? activeRef : undefined}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-foreground/5 border border-border"
                    : item.status === "done"
                    ? "bg-emerald-500/5"
                    : item.status === "error"
                    ? "bg-red-500/5"
                    : ""
                }`}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {item.status === "pending" && <Clock size={13} className="text-foreground/25" />}
                  {item.status === "rewriting" && <RefreshCw size={13} className="text-foreground/60 animate-spin" />}
                  {item.status === "done" && <Check size={13} className="text-emerald-500" />}
                  {item.status === "error" && <AlertCircle size={13} className="text-red-500" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-light truncate ${item.status === "pending" ? "text-foreground/40" : "text-foreground"}`}>
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-foreground/30">{item.content_type}</span>
                    {item.status === "done" && item.words_after !== undefined && (
                      <span className="text-[10px] text-foreground/40">
                        {item.words_before.toLocaleString()}
                        <span className="mx-1 text-foreground/20">→</span>
                        <span className={item.words_after >= (WORD_TARGETS[item.content_type]?.min ?? 0) ? "text-emerald-500" : "text-orange-400"}>
                          {item.words_after.toLocaleString()} words
                        </span>
                      </span>
                    )}
                    {item.status === "rewriting" && (
                      <span className="text-[10px] text-foreground/40 animate-pulse">generating…</span>
                    )}
                    {item.status === "pending" && (
                      <span className="text-[10px] text-foreground/25">
                        {item.words_before.toLocaleString()} words · waiting
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-[10px] text-red-400 truncate">{item.error}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {canClose && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
            <p className="text-[11px] text-foreground/40">
              {errors > 0 ? `${errors} article${errors > 1 ? "s" : ""} failed — retry individually from the list` : "All done — page will reflect updated word counts"}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted/40 transition-colors"
            >
              close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PublishedClient({
  articles,
  coreKeywords,
  bridgeKeywords,
  teamMembers,
}: PublishedClientProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedCore, setSelectedCore] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyUnder, setOnlyUnder] = useState(false);

  const [authorState, setAuthorState] = useState<
    Record<string, { reviewer_name: string; saving: boolean; saved: boolean; error: string | null }>
  >({});

  const [rewriteState, setRewriteState] = useState<
    Record<string, { loading: boolean; error: string | null; done: boolean }>
  >({});

  // Live article data — updated after successful rewrites (individual or batch)
  const [liveData, setLiveData] = useState<Record<string, Partial<ArticleRow>>>({});

  // Batch rewrite state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const abortRef = useRef(false);

  const coreMap = useMemo(
    () => Object.fromEntries(coreKeywords.map((c) => [c.core_id, c.keyword])),
    [coreKeywords]
  );
  const bridgeMap = useMemo(
    () => Object.fromEntries(bridgeKeywords.map((b) => [b.bridge_id, b.keyword])),
    [bridgeKeywords]
  );

  function getBody(article: ArticleRow): string {
    return (liveData[article.id]?.body_markdown as string) ?? article.body_markdown;
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getAuthorValue(article: ArticleRow) {
    return authorState[article.id]?.reviewer_name ?? article.reviewer_name ?? "";
  }

  async function saveAuthor(article: ArticleRow, name: string) {
    const member = teamMembers.find((m) => m.name === name);
    const authorUrl = member ? `/authors/${nameToSlug(member.name)}/` : null;
    setAuthorState((prev) => ({
      ...prev,
      [article.id]: { reviewer_name: name, saving: true, saved: false, error: null },
    }));
    try {
      const res = await fetch("/api/admin/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id, reviewer_name: name || null, author_url: authorUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setAuthorState((prev) => ({
        ...prev,
        [article.id]: { reviewer_name: name, saving: false, saved: true, error: null },
      }));
    } catch (e) {
      setAuthorState((prev) => ({
        ...prev,
        [article.id]: {
          reviewer_name: name,
          saving: false,
          saved: false,
          error: e instanceof Error ? e.message : "save failed",
        },
      }));
    }
  }

  async function rewriteArticle(article: ArticleRow) {
    setRewriteState((prev) => ({
      ...prev,
      [article.id]: { loading: true, error: null, done: false },
    }));
    try {
      const res = await fetch("/api/admin/rewrite-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: article.article_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "rewrite failed");
      if (data.article) {
        setLiveData((prev) => ({ ...prev, [article.id]: data.article }));
      }
      setRewriteState((prev) => ({
        ...prev,
        [article.id]: { loading: false, error: null, done: true },
      }));
    } catch (e) {
      setRewriteState((prev) => ({
        ...prev,
        [article.id]: {
          loading: false,
          error: e instanceof Error ? e.message : "rewrite failed",
          done: false,
        },
      }));
    }
  }

  // ── Batch rewrite ─────────────────────────────────────────────────────────

  const underTargetArticles = useMemo(
    () => articles.filter((a) => isUnderTarget(getBody(a), a.content_type)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articles, liveData]
  );

  async function startBatchRewrite() {
    if (underTargetArticles.length === 0) return;
    abortRef.current = false;

    const items: BatchItem[] = underTargetArticles.map((a) => ({
      article_id: a.article_id,
      db_id: a.id,
      title: a.h1_title,
      content_type: a.content_type,
      words_before: wordCount(getBody(a)),
      status: "pending",
    }));

    setBatchItems(items);
    setBatchRunning(true);
    setShowBatchPanel(true);

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;

      const item = items[i];

      // Mark as rewriting
      setBatchItems((prev) =>
        prev.map((x, idx) => idx === i ? { ...x, status: "rewriting" } : x)
      );

      try {
        const res = await fetch("/api/admin/rewrite-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article_id: item.article_id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "rewrite failed");

        const after = data.article?.body_markdown
          ? wordCount(data.article.body_markdown)
          : undefined;

        // Update live data for this article
        if (data.article) {
          const dbId = item.db_id;
          setLiveData((prev) => ({ ...prev, [dbId]: data.article }));
          // Also clear any individual rewrite state
          setRewriteState((prev) => ({
            ...prev,
            [dbId]: { loading: false, error: null, done: true },
          }));
        }

        setBatchItems((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: "done", words_after: after } : x
          )
        );
      } catch (e) {
        setBatchItems((prev) =>
          prev.map((x, idx) =>
            idx === i
              ? { ...x, status: "error", error: e instanceof Error ? e.message : "failed" }
              : x
          )
        );
      }
    }

    setBatchRunning(false);
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = articles;
    if (selectedCore) result = result.filter((a) => a.core_id === selectedCore);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((a) => a.h1_title.toLowerCase().includes(q));
    }
    if (onlyUnder) {
      result = result.filter((a) => isUnderTarget(getBody(a), a.content_type));
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, selectedCore, search, onlyUnder, liveData]);

  const underCount = underTargetArticles.length;

  if (articles.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">no published articles yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Batch progress panel */}
      {showBatchPanel && (
        <BatchPanel
          items={batchItems}
          canClose={!batchRunning}
          onClose={() => setShowBatchPanel(false)}
        />
      )}

      <div className="space-y-5">
        {/* ── Filters ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCore(null)}
              className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                selectedCore === null
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-foreground/70 hover:bg-muted/40"
              }`}
            >
              all cores
            </button>
            {coreKeywords.map((core) => (
              <button
                key={core.id}
                onClick={() => setSelectedCore(selectedCore === core.core_id ? null : core.core_id)}
                className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                  selectedCore === core.core_id
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-foreground/70 hover:bg-muted/40"
                }`}
              >
                {core.keyword}
              </button>
            ))}
            <button
              onClick={() => setOnlyUnder((v) => !v)}
              className={`px-3 py-1.5 text-xs font-light rounded-md border transition-colors ${
                onlyUnder
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-border text-foreground/70 hover:bg-muted/40"
              }`}
            >
              under target only
              {underCount > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  onlyUnder
                    ? "bg-white/20"
                    : "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
                }`}>
                  {underCount}
                </span>
              )}
            </button>

            {/* Rewrite All */}
            {underCount > 0 && (
              <button
                onClick={startBatchRewrite}
                disabled={batchRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-orange-400 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {batchRunning ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <PlayCircle size={11} />
                )}
                {batchRunning ? "rewriting…" : `rewrite all`}
                <span className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                  {underCount}
                </span>
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search by title..."
              className="w-full pl-8 pr-4 py-2 text-xs font-light rounded-md border border-border bg-background focus:outline-none focus:border-foreground/50 text-foreground placeholder:text-foreground/30"
            />
          </div>

          <p className="text-[10px] text-muted-foreground">
            {filtered.length} of {articles.length} articles
            {underCount > 0 && (
              <span className="ml-2 text-orange-400">{underCount} under word-count target</span>
            )}
          </p>
        </div>

        {/* ── Article list — 1 per row ── */}
        {filtered.length === 0 ? (
          <p className="text-xs font-light text-muted-foreground py-4">no articles match the current filter.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((article) => {
              const isOpen = openIds.has(article.id);
              const body = getBody(article);
              const live = liveData[article.id] ?? {};
              const wc = wordCount(body);
              const target = WORD_TARGETS[article.content_type];
              const gap = target ? wc - target.min : null;
              const under = gap !== null && gap < 0;
              const rw = rewriteState[article.id];
              const coreLabel = coreMap[article.core_id] ?? article.core_id;
              const bridgeLabel = bridgeMap[article.bridge_id] ?? article.bridge_id;

              // Merge live fields for expanded panel
              const displayArticle = { ...article, ...live } as ArticleRow;

              return (
                <div
                  key={article.id}
                  className={`border rounded-md overflow-hidden transition-colors ${
                    under
                      ? gap! < -500
                        ? "border-red-200 dark:border-red-900/50"
                        : "border-orange-200 dark:border-orange-900/50"
                      : "border-border"
                  }`}
                >
                  {/* ── Row header ── */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggle(article.id)}
                      className="shrink-0 text-foreground/40 hover:text-foreground/70 transition-colors"
                    >
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    <span className="text-xs font-light text-foreground flex-1 min-w-0 truncate">
                      {displayArticle.h1_title}
                    </span>

                    {/* Stats */}
                    <div className="shrink-0 flex items-center gap-4 text-[11px]">
                      <span className="text-foreground/40 hidden sm:block truncate max-w-[100px]" title={coreLabel}>
                        {coreLabel}
                      </span>
                      <span className="text-foreground/40 hidden md:block truncate max-w-[120px]" title={bridgeLabel}>
                        {bridgeLabel}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground/60 shrink-0">
                        {article.content_type}
                      </span>
                      <span className="text-foreground/60 shrink-0 tabular-nums">
                        {wc.toLocaleString()} words
                      </span>
                      {target && (
                        <span className="text-foreground/30 shrink-0 hidden lg:block tabular-nums">
                          target {target.min.toLocaleString()}–{target.max.toLocaleString()}
                        </span>
                      )}
                      <span className="shrink-0 w-32 text-right">
                        <GapBadge words={wc} type={article.content_type} />
                      </span>
                    </div>

                    {/* Re-write button */}
                    <button
                      onClick={() => rewriteArticle(article)}
                      disabled={rw?.loading || batchRunning}
                      title="Re-write this article to meet word count target"
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-light border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        rw?.done
                          ? "border-emerald-500 text-emerald-500"
                          : under
                          ? "border-orange-400 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                          : "border-border text-foreground/50 hover:bg-muted/40"
                      }`}
                    >
                      {rw?.loading ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : rw?.done ? (
                        <Check size={11} />
                      ) : (
                        <RefreshCw size={11} />
                      )}
                      {rw?.loading ? "rewriting…" : rw?.done ? "done" : "re-write"}
                    </button>

                    <a
                      href={`/${article.core_id}/${article.bridge_id}/${article.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title="view on site"
                    >
                      <ExternalLink size={11} />
                    </a>

                    {!article.reviewer_name && !authorState[article.id]?.reviewer_name && (
                      <span title="missing author" className="shrink-0 text-orange-400">
                        <UserX size={11} />
                      </span>
                    )}
                  </div>

                  {/* Rewrite error inline */}
                  {rw?.error && (
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-900/40">
                      <p className="text-[11px] text-red-500">{rw.error}</p>
                    </div>
                  )}

                  {/* ── Expanded detail panel ── */}
                  {isOpen && (
                    <div className="border-t border-border/30 px-5 py-4 space-y-4">
                      {/* Identifiers */}
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">identifiers</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Field label="article id" value={<span className="font-mono">{displayArticle.article_id}</span>} />
                          <Field label="content type" value={displayArticle.content_type} />
                          <Field label="primary keyword" value={displayArticle.primary_keyword} />
                          <Field label="slug" value={<span className="font-mono">{displayArticle.slug}</span>} />
                          <Field label="core" value={<span className="font-mono">{displayArticle.core_id}</span>} />
                          <Field label="bridge" value={<span className="font-mono">{displayArticle.bridge_id}</span>} />
                          <Field label="core article" value={displayArticle.is_core_article ? "yes" : "no"} />
                          <Field label="link status" value={<StatusBadge status={displayArticle.link_status} />} />
                        </div>
                      </div>

                      {/* SEO */}
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">seo</p>
                        <div className="space-y-2">
                          <Field label="h1 title" value={displayArticle.h1_title} />
                          <Field label="meta title" value={displayArticle.meta_title} />
                          <Field label="meta description" value={displayArticle.meta_description} />
                          <Field label="og title" value={displayArticle.og_title} />
                          <Field label="og description" value={displayArticle.og_description} />
                          <Field label="canonical url" value={displayArticle.canonical_url} />
                          <Field label="robots" value={displayArticle.robots_directive} />
                          <Field label="schema type" value={displayArticle.schema_type} />

                          <div>
                            <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">author</p>
                            {teamMembers.length === 0 ? (
                              <p className="text-xs font-light text-muted-foreground italic">
                                add team members in site settings first
                              </p>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={getAuthorValue(article)}
                                  onChange={(e) => saveAuthor(article, e.target.value)}
                                  disabled={authorState[article.id]?.saving}
                                  className="flex-1 text-xs font-light rounded-md border border-border px-2 py-1.5 bg-background text-foreground focus:outline-none focus:border-foreground/50 disabled:opacity-50"
                                >
                                  <option value="">— no author —</option>
                                  {teamMembers.map((m) => (
                                    <option key={m.name} value={m.name}>
                                      {m.name}{m.role ? ` — ${m.role}` : ""}
                                    </option>
                                  ))}
                                </select>
                                {authorState[article.id]?.saving && (
                                  <span className="text-[10px] text-muted-foreground">saving…</span>
                                )}
                                {authorState[article.id]?.saved && (
                                  <Check size={12} className="text-green-500 shrink-0" />
                                )}
                                {authorState[article.id]?.error && (
                                  <span className="text-[10px] text-red-500">{authorState[article.id].error}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Body */}
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
                          body
                          <span className="ml-2 normal-case text-foreground/30">
                            {wc.toLocaleString()} words
                            {target && (
                              <span className={gap !== null && gap < 0 ? " text-orange-400" : " text-foreground/30"}>
                                {" "}/ target {target.min.toLocaleString()}–{target.max.toLocaleString()}
                              </span>
                            )}
                          </span>
                        </p>
                        <div className="bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto">
                          <pre className="text-[10px] font-light text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {body}
                          </pre>
                        </div>
                      </div>

                      {/* Structured data */}
                      <div className="space-y-3">
                        <JsonField label="table of contents" value={displayArticle.table_of_contents} />
                        <JsonField label="internal links" value={displayArticle.internal_links_injected} />
                        <JsonField label="related articles" value={displayArticle.related_articles} />
                        <JsonField label="external links" value={displayArticle.external_links} />
                        <JsonField label="schema markup" value={displayArticle.schema_markup} />
                      </div>

                      {/* Timestamps */}
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">timestamps</p>
                        <div className="space-y-2">
                          <Field label="published" value={formatDate(displayArticle.published_at)} />
                          <Field label="generated" value={formatDate(displayArticle.generated_at)} />
                          <Field label="updated" value={formatDate(displayArticle.updated_at)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
