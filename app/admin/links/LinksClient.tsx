"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Pencil, Check, X, Plus } from "lucide-react";
import type { ClusterLinkData, ArticleLinkData, CoreKeywordOption, BridgeKeywordOption } from "./page";
import { toKebabCase } from "@/lib/slugify";

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

export default function LinksClient({
  clusters,
  keywordOptions: initialKeywordOptions,
}: {
  clusters: ClusterLinkData[];
  keywordOptions: CoreKeywordOption[];
}) {
  // Mutable keyword options so newly created bridges appear immediately
  const [kwOptions, setKwOptions] = useState<CoreKeywordOption[]>(initialKeywordOptions);

  function handleBridgeCreated(coreId: string, newBridge: BridgeKeywordOption) {
    setKwOptions((prev) =>
      prev.map((c) =>
        c.core_id === coreId
          ? { ...c, bridges: [...c.bridges, newBridge] }
          : c
      )
    );
  }

  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());
  const [checkingCluster, setCheckingCluster] = useState<string | null>(null);
  const [wiringCluster, setWiringCluster] = useState<string | null>(null);

  const [wireStepLabel, setWireStepLabel] = useState<Record<string, string>>({});
  const [wireSummary, setWireSummary] = useState<Record<string, string[]>>({});
  const [checkingArticleId, setCheckingArticleId] = useState<Record<string, string>>({});
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

  // Mutable per-cluster article lists (articles are removed when re-assigned)
  const [clusterArticleMap, setClusterArticleMap] = useState<Record<string, ArticleLinkData[]>>(
    () => {
      const map: Record<string, ArticleLinkData[]> = {};
      for (const c of clusters) map[c.cluster_db_id] = [...c.articles];
      return map;
    }
  );

  // Map cluster → its original core_id (stable, derived from initial data)
  const clusterCoreMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clusters) {
      map[c.cluster_db_id] = c.articles[0]?.core_id ?? "";
    }
    return map;
  }, [clusters]);

  // Unique cores derived from clusters, ordered by first appearance
  const coresWithClusters = useMemo(() => {
    const seen = new Map<string, { core_id: string; keyword: string; clusterCount: number }>();
    for (const c of clusters) {
      const core_id = c.articles[0]?.core_id ?? "";
      if (!core_id) continue;
      if (!seen.has(core_id)) {
        const kw = kwOptions.find((k) => k.core_id === core_id);
        seen.set(core_id, {
          core_id,
          keyword: kw?.keyword ?? core_id.replace(/-/g, " ").replace(/_/g, " "),
          clusterCount: 0,
        });
      }
      seen.get(core_id)!.clusterCount++;
    }
    return Array.from(seen.values());
  }, [clusters, kwOptions]);

  // Active core filter — default to first core found
  const [selectedCoreId, setSelectedCoreId] = useState<string | null>(
    () => clusters.find((c) => c.articles.length > 0)?.articles[0]?.core_id ?? null
  );

  // Clusters visible under the selected core card
  const visibleClusters = useMemo(
    () => clusters.filter((c) => clusterCoreMap[c.cluster_db_id] === selectedCoreId),
    [clusters, clusterCoreMap, selectedCoreId]
  );

  function toggleCluster(id: string) {
    setOpenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleArticleReassigned(clusterId: string, articleId: string) {
    setClusterArticleMap((prev) => ({
      ...prev,
      [clusterId]: (prev[clusterId] ?? []).filter((a) => a.id !== articleId),
    }));
  }

  async function checkLinks(cluster: ClusterLinkData) {
    const articles = clusterArticleMap[cluster.cluster_db_id] ?? [];
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
    const articles = clusterArticleMap[cluster.cluster_db_id] ?? [];
    if (articles.length === 0) {
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
            for (const a of articles) {
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
            for (const a of articles) {
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

  const selectedCoreArticleCount = useMemo(
    () =>
      visibleClusters.reduce(
        (n, c) => n + (clusterArticleMap[c.cluster_db_id]?.length ?? 0),
        0
      ),
    [visibleClusters, clusterArticleMap]
  );

  if (clusters.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">no published articles yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Core keyword cards ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {coresWithClusters.map((core) => {
          const isSelected = selectedCoreId === core.core_id;
          return (
            <button
              key={core.core_id}
              onClick={() => setSelectedCoreId(core.core_id)}
              className={`group flex flex-col items-start px-4 py-3 rounded-md border text-left transition-all min-w-[130px] ${
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:border-foreground/30 hover:bg-muted/30"
              }`}
            >
              <span
                className={`text-xs font-medium leading-snug capitalize ${
                  isSelected ? "text-background" : "text-foreground"
                }`}
              >
                {core.keyword}
              </span>
              <span
                className={`text-[10px] font-light mt-1 ${
                  isSelected ? "text-background/60" : "text-muted-foreground"
                }`}
              >
                {core.clusterCount} cluster{core.clusterCount !== 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Cluster panels ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground">
          {visibleClusters.length} cluster{visibleClusters.length !== 1 ? "s" : ""} · {selectedCoreArticleCount} article{selectedCoreArticleCount !== 1 ? "s" : ""}
        </p>

      {visibleClusters.map((cluster) => {
        const isOpen = openClusters.has(cluster.cluster_db_id);
        const isChecking = checkingCluster === cluster.cluster_db_id;
        const isWiring = wiringCluster === cluster.cluster_db_id;
        const isWired = clusterWired.has(cluster.cluster_db_id);
        const error = wireError[cluster.cluster_db_id];
        const articles = clusterArticleMap[cluster.cluster_db_id] ?? [];
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
                <span className="text-xs font-light text-foreground truncate">{cluster.display_name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {articles.length} article{articles.length !== 1 ? "s" : ""}
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
                      ? `${doneCount}/${articles.length}`
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
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">core</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">bridge</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">type</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-widest text-foreground/40">int.</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-widest text-foreground/40">ext.</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">status</th>
                      <th className="px-3 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article) => (
                      <ArticleTableRow
                        key={article.id}
                        article={article}
                        counts={articleData[article.id]}
                        isCheckingThis={currentCheckingId === article.id}
                        keywordOptions={kwOptions}
                        onReassigned={() => handleArticleReassigned(cluster.cluster_db_id, article.id)}
                        onBridgeCreated={handleBridgeCreated}
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
  keywordOptions,
  onReassigned,
  onBridgeCreated,
}: {
  article: ArticleLinkData;
  counts: ArticleState | undefined;
  isCheckingThis: boolean;
  keywordOptions: CoreKeywordOption[];
  onReassigned: () => void;
  onBridgeCreated: (coreId: string, bridge: BridgeKeywordOption) => void;
}) {
  const internalCount = counts?.internalCount ?? article.internal_links.length;
  const externalCount = counts?.externalCount ?? article.external_links.length;
  const linkStatus = counts?.linkStatus ?? article.link_status;

  const [editing, setEditing] = useState(false);
  const [selectedCore, setSelectedCore] = useState(article.core_id);
  const [selectedBridge, setSelectedBridge] = useState(article.bridge_id);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  // "Add new bridge" inline state
  const [addingBridge, setAddingBridge] = useState(false);
  const [newBridgeName, setNewBridgeName] = useState("");
  const [creatingBridge, setCreatingBridge] = useState(false);
  const [bridgeCreateError, setBridgeCreateError] = useState<string | null>(null);

  const availableBridges = keywordOptions.find((c) => c.core_id === selectedCore)?.bridges ?? [];
  const newBridgeSlug = toKebabCase(newBridgeName);

  function startEdit() {
    setSelectedCore(article.core_id);
    setSelectedBridge(article.bridge_id);
    setSaveError(null);
    setSavedLabel(null);
    setAddingBridge(false);
    setNewBridgeName("");
    setBridgeCreateError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setAddingBridge(false);
    setSaveError(null);
  }

  function handleCoreChange(newCore: string) {
    setSelectedCore(newCore);
    setAddingBridge(false);
    setNewBridgeName("");
    setBridgeCreateError(null);
    // Reset bridge to first available for the new core
    const firstBridge = keywordOptions.find((c) => c.core_id === newCore)?.bridges[0]?.bridge_id ?? "";
    setSelectedBridge(firstBridge);
  }

  function handleBridgeSelectChange(val: string) {
    if (val === "__new__") {
      setAddingBridge(true);
      setNewBridgeName("");
      setBridgeCreateError(null);
    } else {
      setSelectedBridge(val);
    }
  }

  async function handleCreateBridge() {
    const keyword = newBridgeName.trim();
    const bridge_id = newBridgeSlug;
    if (!keyword) { setBridgeCreateError("Enter a keyword name"); return; }
    if (!bridge_id) { setBridgeCreateError("Invalid keyword — use letters and spaces"); return; }

    const coreOpt = keywordOptions.find((c) => c.core_id === selectedCore);
    if (!coreOpt) { setBridgeCreateError("Core keyword not found"); return; }

    // Guard against duplicates in existing list
    if (coreOpt.bridges.some((b) => b.bridge_id === bridge_id)) {
      setBridgeCreateError(`"${bridge_id}" already exists — select it from the list`);
      return;
    }

    setCreatingBridge(true);
    setBridgeCreateError(null);

    try {
      const res = await fetch("/api/bridges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          core_keyword_id: coreOpt.id,
          bridges: [{
            keyword,
            suggested_id: bridge_id,
            search_volume: 0,
            cpc: 0,
            keyword_difficulty: 0,
            trend: [],
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create bridge");

      const newBridge: BridgeKeywordOption = { id: bridge_id, bridge_id, keyword };
      onBridgeCreated(selectedCore, newBridge);
      setSelectedBridge(bridge_id);
      setAddingBridge(false);
      setNewBridgeName("");
    } catch (e) {
      setBridgeCreateError(e instanceof Error ? e.message : "Failed to create bridge");
    } finally {
      setCreatingBridge(false);
    }
  }

  async function handleSave() {
    if (selectedCore === article.core_id && selectedBridge === article.bridge_id) {
      setEditing(false);
      return;
    }
    if (!selectedBridge) {
      setSaveError("Select a bridge keyword");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/admin/article-reassign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_db_id: article.id,
          core_id: selectedCore,
          bridge_id: selectedBridge,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      const destination = data.new_cluster_display_name
        ? `→ ${data.new_cluster_display_name}`
        : `→ ${selectedCore} / ${selectedBridge}`;
      setSavedLabel(destination);
      setEditing(false);
      setTimeout(() => onReassigned(), 1200);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const hasChanged = selectedCore !== article.core_id || selectedBridge !== article.bridge_id;

  return (
    <>
      <tr className={`border-b border-border/20 last:border-0 text-xs font-light transition-colors group ${isCheckingThis ? "bg-muted/30" : savedLabel ? "bg-emerald-50/40" : "hover:bg-muted/20"}`}>
        {/* Article title */}
        <td className="px-3 py-2.5 text-foreground max-w-[200px] truncate">
          {article.h1_title || article.article_id}
        </td>

        {/* Core keyword */}
        <td className="px-3 py-2.5">
          {editing ? (
            <select
              value={selectedCore}
              onChange={(e) => handleCoreChange(e.target.value)}
              disabled={saving}
              className="text-[10px] font-light bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-50 max-w-[140px]"
            >
              {keywordOptions.map((c) => (
                <option key={c.id} value={c.core_id}>{c.keyword}</option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] text-foreground/60 font-mono">
              {article.core_id}
            </span>
          )}
        </td>

        {/* Bridge keyword */}
        <td className="px-3 py-2.5 min-w-[160px]">
          {editing && !addingBridge && (
            <select
              value={selectedBridge}
              onChange={(e) => handleBridgeSelectChange(e.target.value)}
              disabled={saving}
              className="text-[10px] font-light bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-50 max-w-[160px]"
            >
              {availableBridges.map((b) => (
                <option key={b.id} value={b.bridge_id}>{b.keyword}</option>
              ))}
              <option value="__new__">＋ add new bridge…</option>
            </select>
          )}
          {editing && addingBridge && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newBridgeName}
                  onChange={(e) => setNewBridgeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateBridge();
                    if (e.key === "Escape") { setAddingBridge(false); setNewBridgeName(""); }
                  }}
                  placeholder="bridge keyword name"
                  disabled={creatingBridge}
                  className="text-[10px] font-light bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 disabled:opacity-50 w-[130px]"
                />
                <button
                  onClick={handleCreateBridge}
                  disabled={creatingBridge || !newBridgeName.trim()}
                  title="create bridge"
                  className="p-1 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-30 transition-colors shrink-0"
                >
                  {creatingBridge ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                </button>
                <button
                  onClick={() => { setAddingBridge(false); setNewBridgeName(""); setBridgeCreateError(null); }}
                  disabled={creatingBridge}
                  title="back to list"
                  className="p-1 rounded hover:bg-muted text-foreground/40 disabled:opacity-30 transition-colors shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
              {newBridgeSlug && (
                <span className="text-[9px] text-foreground/35 font-mono pl-0.5">{newBridgeSlug}</span>
              )}
              {bridgeCreateError && (
                <span className="text-[9px] text-red-500 pl-0.5">{bridgeCreateError}</span>
              )}
            </div>
          )}
          {!editing && (
            <span className="text-[10px] text-foreground/60 font-mono">
              {article.bridge_id}
            </span>
          )}
        </td>

        {/* Content type */}
        <td className="px-3 py-2.5">
          <span className="text-[10px] font-medium uppercase text-foreground/50">
            {article.content_type || "—"}
          </span>
        </td>

        {/* Internal count */}
        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
          {internalCount}
        </td>

        {/* External count */}
        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
          {externalCount}
        </td>

        {/* Link status */}
        <td className="px-3 py-2.5">
          {isCheckingThis
            ? <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 size={10} className="animate-spin" />checking</span>
            : savedLabel
            ? <span className="text-[10px] text-emerald-600 font-light">{savedLabel}</span>
            : <LinkStatusBadge status={linkStatus} />
          }
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5 text-right">
          {editing ? (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanged}
                title="save changes"
                className="p-1 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-30 transition-colors"
              >
                {saving
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Check size={11} />
                }
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                title="cancel"
                className="p-1 rounded hover:bg-muted text-foreground/40 disabled:opacity-30 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              {!savedLabel && (
                <button
                  onClick={startEdit}
                  title="edit keywords"
                  className="p-1 rounded text-foreground/25 hover:text-foreground/60 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Pencil size={10} />
                </button>
              )}
              <a
                href={`/${article.core_id}/${article.bridge_id}/${article.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="view article"
              >
                <ExternalLink size={11} />
              </a>
            </div>
          )}
        </td>
      </tr>

      {/* Inline error row */}
      {editing && saveError && (
        <tr className="border-b border-border/20">
          <td colSpan={8} className="px-3 pb-2 pt-0">
            <p className="text-[10px] text-red-500">{saveError}</p>
          </td>
        </tr>
      )}
    </>
  );
}
