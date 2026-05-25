"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import type { ClusterLinkData, ArticleLinkData } from "./page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArticleState {
  internalCount: number;
  externalCount: number;
  linkStatus?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LinksClient({ clusters }: { clusters: ClusterLinkData[] }) {
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());
  const [checkingCluster, setCheckingCluster] = useState<string | null>(null);
  const [wiringCluster, setWiringCluster] = useState<string | null>(null);

  // Current step label while wiring (cleared when done)
  const [wireStepLabel, setWireStepLabel] = useState<Record<string, string>>({});
  // Wire step summary lines accumulated during the run
  const [wireSummary, setWireSummary] = useState<Record<string, string[]>>({});
  // Which article (DB UUID) is currently being link-checked
  const [checkingArticleId, setCheckingArticleId] = useState<Record<string, string>>({});
  // How many articles have been checked so far
  const [checkDoneCount, setCheckDoneCount] = useState<Record<string, number>>({});

  const [wireError, setWireError] = useState<Record<string, string>>({});
  const [clusterWired, setClusterWired] = useState<Set<string>>(
    () => new Set(clusters.filter((c) => c.link_health === "healthy").map((c) => c.cluster_db_id))
  );

  const [lastCheck, setLastCheck] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of clusters) {
      if (c.last_link_check) map[c.cluster_db_id] = c.last_link_check;
    }
    return map;
  });

  const [checkTimestamp, setCheckTimestamp] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of clusters) {
      if (c.last_link_check) map[c.cluster_db_id] = c.last_link_check;
    }
    return map;
  });

  const [articleData, setArticleData] = useState<Record<string, ArticleState>>(() => {
    const map: Record<string, ArticleState> = {};
    for (const cluster of clusters) {
      for (const a of cluster.articles) {
        map[a.id] = {
          internalCount: a.internal_links.length,
          externalCount: a.external_links.length,
          linkStatus: a.link_status,
        };
      }
    }
    return map;
  });

  function toggleCluster(id: string) {
    setOpenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function checkLinks(cluster: ClusterLinkData) {
    const articles = cluster.articles;
    if (articles.length === 0) return;

    setCheckingCluster(cluster.cluster_db_id);
    setCheckDoneCount((prev) => ({ ...prev, [cluster.cluster_db_id]: 0 }));
    setOpenClusters((prev) => new Set([...prev, cluster.cluster_db_id]));

    for (const article of articles) {
      setCheckingArticleId((prev) => ({ ...prev, [cluster.cluster_db_id]: article.id }));

      try {
        const res = await fetch("/api/link-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cluster_id: cluster.cluster_db_id, article_db_id: article.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "check failed");

        setArticleData((prev) => ({
          ...prev,
          [article.id]: {
            internalCount: (data.internal ?? []).length,
            externalCount: (data.external ?? []).length,
            linkStatus: data.link_status,
          },
        }));
      } catch {
        // leave row as-is on error
      }

      setCheckDoneCount((prev) => ({
        ...prev,
        [cluster.cluster_db_id]: (prev[cluster.cluster_db_id] ?? 0) + 1,
      }));
    }

    setCheckingArticleId((prev) => { const next = { ...prev }; delete next[cluster.cluster_db_id]; return next; });
    setCheckDoneCount((prev) => { const next = { ...prev }; delete next[cluster.cluster_db_id]; return next; });
    setCheckTimestamp((prev) => ({ ...prev, [cluster.cluster_db_id]: new Date().toISOString() }));
    setCheckingCluster(null);
  }

  async function wireCluster(cluster: ClusterLinkData) {
    if (cluster.articles.length === 0) {
      setWireError((prev) => ({ ...prev, [cluster.cluster_db_id]: "no published articles in this cluster — publish at least one article before wiring" }));
      return;
    }

    const steps = [
      { action: "inject_core_bridge", label: "injecting core & bridge links" },
      { action: "inject_siblings",    label: "injecting sibling links" },
      { action: "fix_external",       label: "checking & fixing external links" },
    ];

    setWiringCluster(cluster.cluster_db_id);
    setWireError((prev) => { const next = { ...prev }; delete next[cluster.cluster_db_id]; return next; });
    setClusterWired((prev) => { const next = new Set(prev); next.delete(cluster.cluster_db_id); return next; });
    setWireSummary((prev) => ({ ...prev, [cluster.cluster_db_id]: [] }));
    setOpenClusters((prev) => new Set([...prev, cluster.cluster_db_id]));

    let anyError = false;

    for (const step of steps) {
      setWireStepLabel((prev) => ({ ...prev, [cluster.cluster_db_id]: step.label }));

      try {
        const res = await fetch("/api/link-wire-cluster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cluster_id: cluster.cluster_db_id, action: step.action }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "step failed");

        let detail = "";

        if (step.action === "inject_core_bridge" || step.action === "inject_siblings") {
          const articleResults = (data.results as Array<{ article_id: string; links_added: number; links_total: number }>) ?? [];
          const totalAdded = articleResults.reduce((n, r) => n + r.links_added, 0);
          detail = `${totalAdded} link${totalAdded !== 1 ? "s" : ""} added`;
          setArticleData((prev) => {
            const next = { ...prev };
            for (const a of cluster.articles) {
              const r = articleResults.find((x) => x.article_id === a.article_id);
              if (r) next[a.id] = { ...next[a.id], internalCount: r.links_total, linkStatus: "wired" };
            }
            return next;
          });
        } else if (step.action === "fix_external") {
          const results = (data.results as Array<{ article_id: string; checked: number; fixed: number; stripped: number }>) ?? [];
          const checked = results.reduce((n, r) => n + r.checked, 0);
          const fixed = results.reduce((n, r) => n + r.fixed, 0);
          const stripped = results.reduce((n, r) => n + r.stripped, 0);
          detail = checked === 0 ? "no external links" : fixed > 0 || stripped > 0 ? `${checked} checked · ${fixed} fixed · ${stripped} stripped` : `${checked} ok`;
          setArticleData((prev) => {
            const next = { ...prev };
            for (const a of cluster.articles) {
              const r = results.find((x) => x.article_id === a.article_id);
              if (r) next[a.id] = { ...next[a.id], externalCount: r.checked - r.stripped };
            }
            return next;
          });
        }

        setWireSummary((prev) => ({
          ...prev,
          [cluster.cluster_db_id]: [...(prev[cluster.cluster_db_id] ?? []), detail],
        }));
      } catch (e) {
        anyError = true;
        setWireError((prev) => ({ ...prev, [cluster.cluster_db_id]: e instanceof Error ? e.message : "wiring failed" }));
        break;
      }
    }

    setWireStepLabel((prev) => { const next = { ...prev }; delete next[cluster.cluster_db_id]; return next; });
    setWiringCluster(null);

    if (!anyError) {
      await fetch("/api/link-wire-cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster_id: cluster.cluster_db_id, action: "finalize_cluster" }),
      });
      const now = new Date().toISOString();
      setClusterWired((prev) => new Set([...prev, cluster.cluster_db_id]));
      setLastCheck((prev) => ({ ...prev, [cluster.cluster_db_id]: now }));
    }
  }

  const totalArticles = useMemo(() => clusters.reduce((n, c) => n + c.articles.length, 0), [clusters]);

  if (clusters.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">no published articles yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        {clusters.length} cluster{clusters.length !== 1 ? "s" : ""} · {totalArticles} published articles
      </p>

      {clusters.map((cluster) => {
        const isOpen = openClusters.has(cluster.cluster_db_id);
        const isChecking = checkingCluster === cluster.cluster_db_id;
        const isWiring = wiringCluster === cluster.cluster_db_id;
        const isWired = clusterWired.has(cluster.cluster_db_id);
        const error = wireError[cluster.cluster_db_id];
        const coreLabel = cluster.articles[0]?.core_id?.replace(/_/g, " ") ?? "";
        const currentWireStep = wireStepLabel[cluster.cluster_db_id];
        const summary = wireSummary[cluster.cluster_db_id];
        const doneCount = checkDoneCount[cluster.cluster_db_id];
        const currentCheckingId = checkingArticleId[cluster.cluster_db_id];

        const checkTs = checkTimestamp[cluster.cluster_db_id];
        const checkAge = checkTs ? Date.now() - new Date(checkTs).getTime() : Infinity;
        const checkIsRecent = checkAge < 24 * 60 * 60 * 1000;
        const canWire = checkIsRecent && !isWiring && !isChecking;
        const wireBlockReason = !checkTs
          ? "run check links first"
          : !checkIsRecent
          ? "check expired — recheck before wiring"
          : null;

        return (
          <div key={cluster.cluster_db_id} className="border border-border rounded-md overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div
                className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                onClick={() => toggleCluster(cluster.cluster_db_id)}
              >
                {isOpen
                  ? <ChevronDown size={13} className="text-foreground/40 shrink-0" />
                  : <ChevronRight size={13} className="text-foreground/40 shrink-0" />}
                {coreLabel && (
                  <span className="text-[10px] font-light text-foreground/40 shrink-0">{coreLabel}</span>
                )}
                {coreLabel && <span className="text-[10px] text-foreground/20 shrink-0">/</span>}
                <span className="text-xs font-light text-foreground truncate">{cluster.display_name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {cluster.articles.length} article{cluster.articles.length !== 1 ? "s" : ""}
                </span>
                {isWired && !isWiring && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-700">
                    wired
                    {lastCheck[cluster.cluster_db_id] && (
                      <span className="text-emerald-500 font-light ml-1">
                        · {timeAgo(lastCheck[cluster.cluster_db_id])}
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-3">
                {/* Check links */}
                <div className="flex flex-col items-end gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); checkLinks(cluster); }}
                    disabled={isChecking || isWiring}
                    className="px-2.5 py-1 text-[10px] font-light rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    {isChecking ? "checking..." : "check links"}
                  </button>
                  <span className="text-[9px] text-foreground/30 leading-none h-3">
                    {isChecking && doneCount !== undefined
                      ? `${doneCount}/${cluster.articles.length}`
                      : checkTs && !isChecking
                      ? timeAgo(checkTs)
                      : ""}
                  </span>
                </div>

                {/* Wire cluster */}
                <div className="flex flex-col items-end gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); wireCluster(cluster); }}
                    disabled={!canWire}
                    className="px-2.5 py-1 text-[10px] font-light rounded border border-border bg-foreground text-background hover:opacity-90 disabled:opacity-40 transition-colors"
                  >
                    {isWiring ? "wiring..." : "wire cluster"}
                  </button>
                  <span className="text-[9px] text-foreground/30 leading-none h-3 text-right max-w-[120px] truncate">
                    {isWiring && currentWireStep
                      ? currentWireStep
                      : !isWiring && summary && summary.length > 0
                      ? summary.join(" · ")
                      : wireBlockReason ?? ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="px-4 py-2 border-t border-border/30 bg-red-50/60">
                <p className="text-[10px] text-red-500">{error}</p>
              </div>
            )}

            {/* Article table */}
            {isOpen && (
              <div className="border-t border-border/30">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">article</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">type</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-widest text-foreground/40">int.</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-widest text-foreground/40">ext.</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">status</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {cluster.articles.map((article) => (
                      <ArticleTableRow
                        key={article.id}
                        article={article}
                        counts={articleData[article.id]}
                        isCheckingThis={currentCheckingId === article.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LinkStatusBadge({ status }: { status: string | undefined }) {
  if (!status) return <span className="text-[10px] text-foreground/25">—</span>;

  const map: Record<string, { label: string; className: string }> = {
    wired:   { label: "Linked",     className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    partial: { label: "Partial",    className: "bg-amber-100 text-amber-700 border-amber-200" },
    unwired: { label: "Not linked", className: "bg-red-100 text-red-600 border-red-200" },
  };

  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wider ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function ArticleTableRow({
  article,
  counts,
  isCheckingThis,
}: {
  article: ArticleLinkData;
  counts: ArticleState | undefined;
  isCheckingThis: boolean;
}) {
  const internalCount = counts?.internalCount ?? article.internal_links.length;
  const externalCount = counts?.externalCount ?? article.external_links.length;
  const linkStatus = counts?.linkStatus ?? article.link_status;

  return (
    <tr className={`border-b border-border/20 last:border-0 text-xs font-light transition-colors ${isCheckingThis ? "bg-muted/30" : "hover:bg-muted/20"}`}>
      <td className="px-3 py-2.5 text-foreground max-w-xs truncate">
        {article.h1_title || article.article_id}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[10px] font-medium uppercase text-foreground/50">
          {article.content_type || "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
        {internalCount}
      </td>
      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
        {externalCount}
      </td>
      <td className="px-3 py-2.5">
        {isCheckingThis
          ? <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 size={10} className="animate-spin" />checking</span>
          : <LinkStatusBadge status={linkStatus} />
        }
      </td>
      <td className="px-3 py-2.5 text-right">
        <a
          href={`/${article.core_id}/${article.bridge_id}/${article.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="view article"
        >
          <ExternalLink size={11} />
        </a>
      </td>
    </tr>
  );
}
