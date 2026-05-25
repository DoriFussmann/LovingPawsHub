"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import StatusBadge from "@/components/admin/StatusBadge";
import ArticleEditor from "@/components/admin/ArticleEditor";

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

interface SkeletonRow {
  id: string;
  article_id: string;
  content_type: string;
  primary_keyword: string;
  slug: string;
  status: string;
  link_status: string;
  is_core_article: boolean;
}

interface ClusterData {
  id: string;
  cluster_id: string;
  display_name: string;
  link_health: string;
  bridge_keywords: {
    keyword: string;
    bridge_id: string;
    core_keywords: { keyword: string; core_id: string };
  };
  article_skeletons: SkeletonRow[];
}

interface GenerationProgress {
  skeletonId: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  keyword: string;
  contentType: string;
  articleId: string;
}

// ── Generating overlay ────────────────────────────────────────────────────────
function GeneratingOverlay({
  progress,
  elapsed,
}: {
  progress: GenerationProgress[];
  elapsed: number;
}) {
  const [dotIndex, setDotIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDotIndex((i) => (i + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);

  const total = progress.length;
  const done = progress.filter((p) => p.status === "done" || p.status === "error").length;
  const current = progress.find((p) => p.status === "generating");
  const completed = progress.filter((p) => p.status === "done" || p.status === "error");
  const dots = ".".repeat(dotIndex);

  return (
    <div className="border border-border rounded-md px-5 py-5 space-y-4">
      {/* Overall progress */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40">
          generating articles
        </p>
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
          {done}/{total} · {elapsed}s
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-0.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-foreground/30 transition-all duration-500"
          style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
        />
      </div>

      {/* Currently generating */}
      {current && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse flex-shrink-0" />
          <span className="text-xs font-light text-foreground">
            {current.contentType.toLowerCase()} — {current.keyword}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">writing with claude{dots}</span>
        </div>
      )}

      {/* Pending queue */}
      {(() => {
        const pending = progress.filter((p) => p.status === "pending");
        if (pending.length === 0) return null;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-foreground/40 uppercase tracking-widest">up next:</span>
            {pending.slice(0, 5).map((p) => (
              <span key={p.skeletonId} className="text-[10px] text-muted-foreground font-mono bg-muted/60 rounded px-1.5 py-0.5">
                {p.contentType} · {p.keyword.length > 24 ? p.keyword.slice(0, 24) + "…" : p.keyword}
              </span>
            ))}
            {pending.length > 5 && (
              <span className="text-[10px] text-muted-foreground">+{pending.length - 5} more</span>
            )}
          </div>
        );
      })()}

      {/* Completed list */}
      {completed.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/40">
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1.5">completed</p>
          {completed.map((p) => (
            <div key={p.skeletonId} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {p.status === "done"
                ? <span className="text-emerald-500">✓</span>
                : <span className="text-red-400">✗</span>
              }
              <span className="font-mono">{p.articleId}</span>
              <span className="text-foreground/40">·</span>
              <span>{p.contentType.toLowerCase()}</span>
              <span className="text-foreground/40">·</span>
              <span>{p.keyword}</span>
              {p.error && <span className="text-red-400 ml-1">{p.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ArticleData {
  id: string;
  article_id: string;
  h1_title: string;
  meta_title?: string;
  meta_description?: string;
  body_markdown: string;
  status: string;
  link_status: string;
  internal_links_injected?: Array<{ anchor_phrase: string; target_slug: string; found: boolean }>;
  related_articles?: Array<{ article_id: string; title: string; slug: string }>;
  core_id: string;
  bridge_id: string;
  slug: string;
}

interface ArticlesClientProps {
  clusters: ClusterData[];
  articlePromptConfig: unknown; // kept for API compat — prompt editing moved to General Controls
}

export default function ArticlesClient({ clusters: initialClusters }: ArticlesClientProps) {
  const [clusters, setClusters] = useState(initialClusters);
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());
  const [selectedSkeletons, setSelectedSkeletons] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<GenerationProgress[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genElapsed, setGenElapsed] = useState(0);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [reviewingArticle, setReviewingArticle] = useState<ArticleData | null>(null);

  // Elapsed timer while generating
  useEffect(() => {
    if (!generating) return;
    setGenElapsed(0);
    const id = setInterval(() => setGenElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [generating]);

  // Delete state
  const [skeletonDeleteState, setSkeletonDeleteState] = useState<Record<string, "pending" | "deleting">>({});
  const [clusterDeleteAllState, setClusterDeleteAllState] = useState<Record<string, "pending" | "deleting">>({});
  const [clusterPublishAllState, setClusterPublishAllState] = useState<Record<string, "publishing" | "done">>({});
  const [clusterGeneratingId, setClusterGeneratingId] = useState<string | null>(null);

  function toggleCluster(id: string) {
    setOpenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSkeleton(id: string) {
    setSelectedSkeletons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generateSelected() {
    const ids = Array.from(selectedSkeletons);
    if (ids.length === 0) return;

    // Build a lookup for skeleton metadata so the overlay shows real names
    const skeletonMeta: Record<string, { keyword: string; contentType: string; articleId: string }> = {};
    for (const cluster of clusters) {
      for (const s of cluster.article_skeletons) {
        skeletonMeta[s.id] = {
          keyword: s.primary_keyword,
          contentType: s.content_type,
          articleId: s.article_id,
        };
      }
    }

    setGenerating(true);
    setProgress(
      ids.map((id) => ({
        skeletonId: id,
        status: "pending",
        keyword: skeletonMeta[id]?.keyword ?? id,
        contentType: skeletonMeta[id]?.contentType ?? "article",
        articleId: skeletonMeta[id]?.articleId ?? id,
      }))
    );

    for (const skeletonId of ids) {
      setProgress((prev) =>
        prev.map((p) => p.skeletonId === skeletonId ? { ...p, status: "generating" } : p)
      );
      try {
        const res = await fetch("/api/generate-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skeleton_id: skeletonId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "generation failed");
        }
        setProgress((prev) =>
          prev.map((p) => p.skeletonId === skeletonId ? { ...p, status: "done" } : p)
        );
      } catch (e) {
        setProgress((prev) =>
          prev.map((p) =>
            p.skeletonId === skeletonId
              ? { ...p, status: "error", error: e instanceof Error ? e.message : "failed" }
              : p
          )
        );
      }
    }

    setGenerating(false);
    setSelectedSkeletons(new Set());
    window.location.reload();
  }

  async function loadArticleForReview(skeletonId: string) {
    try {
      const res = await fetch(`/api/generate-article?skeleton_id=${skeletonId}`);
      if (!res.ok) return;
      const data = await res.json();
      setReviewingArticle(data.article);
    } catch {
      // ignore
    }
  }

  async function saveArticle(articleId: string, updates: Partial<ArticleData>) {
    await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", article_id: articleId, ...updates }),
    });
  }

  async function publishArticle(articleId: string, opts?: { publishedAt?: string }) {
    await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article_id: articleId, ...(opts?.publishedAt ? { published_at: opts.publishedAt } : {}) }),
    });
    window.location.reload();
  }

  async function publishInline(articleId: string) {
    setPublishingId(articleId);
    try {
      await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: articleId }),
      });
      window.location.reload();
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteSkeleton(skeletonId: string) {
    setSkeletonDeleteState((prev) => ({ ...prev, [skeletonId]: "deleting" }));
    try {
      await fetch(`/api/generate-skeletons?id=${skeletonId}`, { method: "DELETE" });
      setClusters((prev) =>
        prev.map((c) => ({
          ...c,
          article_skeletons: c.article_skeletons.filter((s) => s.id !== skeletonId),
        }))
      );
      setSelectedSkeletons((prev) => { const next = new Set(prev); next.delete(skeletonId); return next; });
    } finally {
      setSkeletonDeleteState((prev) => { const next = { ...prev }; delete next[skeletonId]; return next; });
    }
  }

  async function deleteAllSkeletons(clusterId: string) {
    setClusterDeleteAllState((prev) => ({ ...prev, [clusterId]: "deleting" }));
    try {
      await fetch(`/api/generate-skeletons?cluster_id=${clusterId}`, { method: "DELETE" });
      setClusters((prev) =>
        prev.map((c) => c.id === clusterId ? { ...c, article_skeletons: [] } : c)
      );
    } finally {
      setClusterDeleteAllState((prev) => { const next = { ...prev }; delete next[clusterId]; return next; });
    }
  }

  async function generateAllInCluster(clusterId: string, skeletonIds: string[], skeletonMeta: Record<string, { keyword: string; contentType: string; articleId: string }>) {
    setClusterGeneratingId(clusterId);
    setGenerating(true);
    setProgress(
      skeletonIds.map((id) => ({
        skeletonId: id,
        status: "pending",
        keyword: skeletonMeta[id]?.keyword ?? id,
        contentType: skeletonMeta[id]?.contentType ?? "article",
        articleId: skeletonMeta[id]?.articleId ?? id,
      }))
    );
    for (const skeletonId of skeletonIds) {
      setProgress((prev) =>
        prev.map((p) => p.skeletonId === skeletonId ? { ...p, status: "generating" } : p)
      );
      try {
        const res = await fetch("/api/generate-article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skeleton_id: skeletonId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "generation failed");
        }
        setProgress((prev) =>
          prev.map((p) => p.skeletonId === skeletonId ? { ...p, status: "done" } : p)
        );
      } catch (e) {
        setProgress((prev) =>
          prev.map((p) =>
            p.skeletonId === skeletonId
              ? { ...p, status: "error", error: e instanceof Error ? e.message : "failed" }
              : p
          )
        );
      }
    }
    setGenerating(false);
    setClusterGeneratingId(null);
    window.location.reload();
  }

  async function publishAllInCluster(clusterId: string, articleIds: string[]) {
    setClusterPublishAllState((prev) => ({ ...prev, [clusterId]: "publishing" }));
    try {
      await Promise.all(
        articleIds.map((id) =>
          fetch("/api/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ article_id: id }),
          })
        )
      );
      window.location.reload();
    } finally {
      setClusterPublishAllState((prev) => { const next = { ...prev }; delete next[clusterId]; return next; });
    }
  }

  if (clusters.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">
          no clusters yet. create clusters and save a cluster brief first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Review panel — full width overlay, outside the grid */}
      {reviewingArticle && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex">
          <div className="ml-auto w-full max-w-4xl bg-background border-l border-border overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-light">review article</h2>
                <button
                  onClick={() => setReviewingArticle(null)}
                  className="text-xs font-light text-muted-foreground hover:text-foreground"
                >
                  close
                </button>
              </div>
              <ArticleEditor
                article={reviewingArticle}
                onSave={async (updates) => {
                  await saveArticle(reviewingArticle.article_id, updates);
                }}
                onPublish={async (opts) => {
                  await publishArticle(reviewingArticle.article_id, opts);
                  setReviewingArticle(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Generation progress overlay */}
      {progress.length > 0 && (
        <GeneratingOverlay progress={progress} elapsed={genElapsed} />
      )}

      {/* Action bar — only visible when articles are selected */}
      {selectedSkeletons.size > 0 && (
        <div className="sticky top-0 z-10 bg-background border border-border rounded-md px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-light text-muted-foreground">
            {selectedSkeletons.size} article{selectedSkeletons.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={generateSelected}
            disabled={generating}
            className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
          >
            {generating ? "generating..." : "generate selected articles"}
          </button>
        </div>
      )}

      {/* Cluster panels — 1 per row */}
      <div className="grid grid-cols-1 gap-3">
      {clusters.map((cluster) => {
        const isOpen = openClusters.has(cluster.id);
        const skeletons = cluster.article_skeletons ?? [];
        const coreId = cluster.bridge_keywords?.core_keywords?.core_id ?? "";
        const bridgeId = cluster.bridge_keywords?.bridge_id ?? "";
        const coreKeyword = cluster.bridge_keywords?.core_keywords?.keyword ?? coreId;
        const bridgeKeyword = cluster.bridge_keywords?.keyword ?? bridgeId;
        const publishableIds = skeletons
          .filter((s) => s.status === "drafted" || s.status === "reviewed")
          .map((s) => s.article_id);

        const generatableSkeletons = skeletons.filter((s) => s.status === "skeleton");
        const generatableIds = generatableSkeletons.map((s) => s.id);
        const clusterSkeletonMeta: Record<string, { keyword: string; contentType: string; articleId: string }> = {};
        for (const s of generatableSkeletons) {
          clusterSkeletonMeta[s.id] = { keyword: s.primary_keyword, contentType: s.content_type, articleId: s.article_id };
        }

        const total = skeletons.length;
        const publishedCount = skeletons.filter((s) => s.status === "published").length;
        const draftedCount = skeletons.filter((s) => s.status === "drafted" || s.status === "reviewed").length;
        const clusterStatus: "published" | "partly published" | "draft" | "brief" =
          total === 0 ? "brief"
          : publishedCount === total ? "published"
          : publishedCount > 0 ? "partly published"
          : draftedCount > 0 ? "draft"
          : "brief";

        return (
          <div key={cluster.id} className="border border-border rounded-md overflow-hidden">
            {/* Cluster header */}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div
                className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                onClick={() => toggleCluster(cluster.id)}
              >
                <span className="text-xs font-light text-foreground shrink-0">{coreKeyword}</span>
                <span className="text-[10px] text-foreground/25 shrink-0">→</span>
                <span className="text-xs font-light text-foreground shrink-0">{bridgeKeyword}</span>
                <span className="text-[10px] text-foreground/25 shrink-0">→</span>
                <span className="text-xs font-light text-emerald-600 truncate">{cluster.display_name}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider ${
                  clusterStatus === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : clusterStatus === "partly published"
                    ? "bg-blue-100 text-blue-600"
                    : clusterStatus === "draft"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {clusterStatus === "partly published"
                    ? `${publishedCount}/${total} published`
                    : clusterStatus}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {publishableIds.length > 0 && (
                  clusterPublishAllState[cluster.id] === "publishing" ? (
                    <span className="text-[10px] text-muted-foreground">publishing...</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); publishAllInCluster(cluster.id, publishableIds); }}
                      className="text-[10px] font-light text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      publish all ({publishableIds.length})
                    </button>
                  )
                )}
                {generatableIds.length > 0 && (
                  clusterGeneratingId === cluster.id ? (
                    <span className="text-[10px] text-muted-foreground">generating...</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); generateAllInCluster(cluster.id, generatableIds, clusterSkeletonMeta); }}
                      disabled={generating}
                      className="text-[10px] font-light text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      generate all ({generatableIds.length})
                    </button>
                  )
                )}
                {skeletons.length > 0 && (
                  clusterDeleteAllState[cluster.id] === "pending" ? (
                    <InlineConfirm
                      onConfirm={() => deleteAllSkeletons(cluster.id)}
                      onCancel={() => setClusterDeleteAllState((prev) => { const next = { ...prev }; delete next[cluster.id]; return next; })}
                      loading={false}
                    />
                  ) : clusterDeleteAllState[cluster.id] === "deleting" ? (
                    <span className="text-[10px] text-muted-foreground">deleting...</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setClusterDeleteAllState((prev) => ({ ...prev, [cluster.id]: "pending" })); }}
                      className="text-[10px] font-light text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      delete all
                    </button>
                  )
                )}
                <div onClick={() => toggleCluster(cluster.id)} className="cursor-pointer">
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
            </div>

            {/* Brief table */}
            {isOpen && (
              <div className="border-t border-border/30">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 w-8" />
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">keyword</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">type</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">status</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skeletons.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-xs font-light text-muted-foreground">
                          no briefs yet. save a cluster brief first.
                        </td>
                      </tr>
                    ) : (
                      skeletons.map((skeleton) => {
                        const statusLabel =
                          skeleton.status === "skeleton" ? "brief"
                          : skeleton.status === "drafted" || skeleton.status === "reviewed" ? "draft"
                          : skeleton.status;
                        return (
                        <tr key={skeleton.id} className="border-b border-border/20 last:border-0 text-xs font-light hover:bg-muted/30">
                          <td className="px-3 py-2">
                            {skeleton.status === "skeleton" && (
                              <input
                                type="checkbox"
                                checked={selectedSkeletons.has(skeleton.id)}
                                onChange={() => toggleSkeleton(skeleton.id)}
                                className="w-3 h-3 rounded border-border"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-foreground/80">{skeleton.primary_keyword}</td>
                          <td className="px-3 py-2"><StatusBadge status={skeleton.content_type.toLowerCase()} /></td>
                          <td className="px-3 py-2"><StatusBadge status={statusLabel} /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {skeleton.status === "skeleton" && (
                                <button
                                  onClick={() => setSelectedSkeletons(new Set([skeleton.id]))}
                                  className="px-2 py-1 text-[10px] font-light rounded border border-border hover:bg-muted"
                                >
                                  generate
                                </button>
                              )}
                              {(skeleton.status === "drafted" || skeleton.status === "reviewed") && (
                                <>
                                  <button
                                    onClick={() => loadArticleForReview(skeleton.id)}
                                    className="px-2 py-1 text-[10px] font-light rounded border border-border hover:bg-muted"
                                  >
                                    review
                                  </button>
                                  <button
                                    onClick={() => publishInline(skeleton.article_id)}
                                    disabled={publishingId === skeleton.article_id}
                                    className="px-2 py-1 text-[10px] font-light rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    {publishingId === skeleton.article_id ? "publishing..." : "publish"}
                                  </button>
                                </>
                              )}
                              {skeleton.status === "published" && (
                                <a
                                  href={`/${coreId}/${bridgeId}/${skeleton.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-light rounded border border-border hover:bg-muted"
                                >
                                  view <ExternalLink size={9} />
                                </a>
                              )}
                              {skeletonDeleteState[skeleton.id] === "pending" ? (
                                <InlineConfirm
                                  onConfirm={() => deleteSkeleton(skeleton.id)}
                                  onCancel={() => setSkeletonDeleteState((prev) => { const next = { ...prev }; delete next[skeleton.id]; return next; })}
                                  loading={false}
                                />
                              ) : skeletonDeleteState[skeleton.id] === "deleting" ? (
                                <span className="text-[10px] text-muted-foreground">...</span>
                              ) : (
                                <button
                                  onClick={() => setSkeletonDeleteState((prev) => ({ ...prev, [skeleton.id]: "pending" }))}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                  title="delete brief"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
