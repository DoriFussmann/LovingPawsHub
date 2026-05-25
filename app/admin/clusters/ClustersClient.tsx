"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import StatusBadge from "@/components/admin/StatusBadge";
import { toSnakeCase } from "@/lib/slugify";

interface ClusterData {
  id: string;
  cluster_id: string;
  display_name: string;
  status: string;
  link_health: string;
}

interface BridgeData {
  id: string;
  keyword: string;
  bridge_id: string;
  clusters: ClusterData[];
}

interface CoreData {
  id: string;
  keyword: string;
  core_id: string;
  bridge_keywords: BridgeData[];
  meta_title: string | null;
  meta_description: string | null;
  description: string | null;
}

interface ClustersClientProps {
  coreKeywords: CoreData[];
}

function hasActiveCluster(clusters: ClusterData[]) {
  return clusters.some((c) => c.status === "active");
}

function sortedCoreKeywords(cores: CoreData[]): CoreData[] {
  return [...cores]
    .map((core) => ({
      ...core,
      bridge_keywords: [...core.bridge_keywords]
        .map((bridge) => ({
          ...bridge,
          clusters: [...bridge.clusters].sort((a, b) => {
            if (a.status === b.status) return 0;
            return a.status === "active" ? -1 : 1;
          }),
        }))
        .sort((a, b) => {
          const aActive = hasActiveCluster(a.clusters);
          const bActive = hasActiveCluster(b.clusters);
          if (aActive === bActive) return 0;
          return aActive ? -1 : 1;
        }),
    }))
    .sort((a, b) => {
      const aActive = a.bridge_keywords.some((br) => hasActiveCluster(br.clusters));
      const bActive = b.bridge_keywords.some((br) => hasActiveCluster(br.clusters));
      if (aActive === bActive) return 0;
      return aActive ? -1 : 1;
    });
}

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
      <button
        onClick={onConfirm}
        disabled={loading}
        className="text-red-500 hover:text-red-600 disabled:opacity-50"
      >
        {loading ? "deleting..." : "yes"}
      </button>
      <span className="text-border">·</span>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
        cancel
      </button>
    </span>
  );
}

export default function ClustersClient({ coreKeywords }: ClustersClientProps) {
  const [cores, setCores] = useState(sortedCoreKeywords(coreKeywords));
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<BridgeData | null>(null);
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterId, setNewClusterId] = useState("");
  const [clusterIdManual, setClusterIdManual] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Core SEO edit modal state
  const [coreEditTarget, setCoreEditTarget] = useState<CoreData | null>(null);
  const [coreEditFields, setCoreEditFields] = useState({ meta_title: "", meta_description: "", description: "" });
  const [coreEditSaving, setCoreEditSaving] = useState(false);
  const [coreEditError, setCoreEditError] = useState<string | null>(null);

  function openCoreEdit(e: React.MouseEvent, core: CoreData) {
    e.stopPropagation();
    setCoreEditTarget(core);
    setCoreEditFields({
      meta_title: core.meta_title ?? "",
      meta_description: core.meta_description ?? "",
      description: core.description ?? "",
    });
    setCoreEditError(null);
  }

  async function saveCoreEdit() {
    if (!coreEditTarget) return;
    setCoreEditSaving(true);
    setCoreEditError(null);
    try {
      const res = await fetch("/api/core-keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core_id: coreEditTarget.core_id, ...coreEditFields }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "save failed");
      }
      setCoreEditTarget(null);
      window.location.reload();
    } catch (e) {
      setCoreEditError(e instanceof Error ? e.message : "save failed");
    } finally {
      setCoreEditSaving(false);
    }
  }

  // Delete state: maps cluster id → "pending" | "deleting"
  const [deleteState, setDeleteState] = useState<Record<string, "pending" | "deleting">>({});
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [openCores, setOpenCores] = useState<Set<string>>(new Set());

  function toggleCorePanel(coreId: string) {
    setOpenCores((prev) => {
      const next = new Set(prev);
      if (next.has(coreId)) next.delete(coreId);
      else next.add(coreId);
      return next;
    });
  }

  function openCreateModal(bridge: BridgeData) {
    setSelectedBridge(bridge);
    const defaultName = `${bridge.keyword} cluster`;
    setNewClusterName(defaultName);
    setNewClusterId(toSnakeCase(defaultName));
    setClusterIdManual(false);
    setCreateError("");
    setCreateModalOpen(true);
  }

  async function createCluster() {
    if (!selectedBridge) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridge_keyword_id: selectedBridge.id,
          cluster_id: newClusterId,
          display_name: newClusterName,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "create failed");
      }
      setCreateModalOpen(false);
      window.location.reload();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteCluster(clusterId: string) {
    setDeleteState((prev) => ({ ...prev, [clusterId]: "deleting" }));
    try {
      await fetch(`/api/clusters?id=${clusterId}`, { method: "DELETE" });
      setCores((prev) =>
        prev.map((core) => ({
          ...core,
          bridge_keywords: core.bridge_keywords.map((bridge) => ({
            ...bridge,
            clusters: bridge.clusters.filter((c) => c.id !== clusterId),
          })),
        }))
      );
    } finally {
      setDeleteState((prev) => {
        const next = { ...prev };
        delete next[clusterId];
        return next;
      });
    }
  }

  async function deleteAll() {
    setDeletingAll(true);
    try {
      await fetch("/api/clusters?all=true", { method: "DELETE" });
      setCores((prev) =>
        prev.map((core) => ({
          ...core,
          bridge_keywords: core.bridge_keywords.map((bridge) => ({
            ...bridge,
            clusters: [],
          })),
        }))
      );
    } finally {
      setDeletingAll(false);
      setDeleteAllConfirm(false);
    }
  }

  const totalClusters = cores.flatMap((c) => c.bridge_keywords.flatMap((b) => b.clusters)).length;

  if (coreKeywords.length === 0) {
    return (
      <div className="border border-border rounded-md p-8 text-center">
        <p className="text-xs font-light text-muted-foreground">
          no core keywords yet. run research to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delete All */}
      {totalClusters > 0 && (
        <div className="flex justify-end">
          {deleteAllConfirm ? (
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
              delete all clusters
            </button>
          )}
        </div>
      )}

      {cores.map((core) => {
        if (core.bridge_keywords.length === 0) return null;
        const isOpen = openCores.has(core.id);
        const clusterCount = core.bridge_keywords.flatMap((b) => b.clusters).length;

        // Flatten all cards: one per bridge (empty) or one per cluster
        type Card =
          | { key: string; type: "empty"; bridge: BridgeData; cluster: null }
          | { key: string; type: "cluster"; bridge: BridgeData; cluster: ClusterData };
        const cards: Card[] = [];
        for (const bridge of core.bridge_keywords) {
          if (bridge.clusters.length === 0) {
            cards.push({ key: `empty-${bridge.id}`, type: "empty", bridge, cluster: null });
          } else {
            for (const cluster of bridge.clusters) {
              cards.push({ key: cluster.id, type: "cluster", bridge, cluster });
            }
          }
        }

        return (
          <div key={core.id} className="border border-border rounded-md overflow-hidden">
            <button
              onClick={() => toggleCorePanel(core.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors"
            >
              {isOpen
                ? <ChevronDown size={13} className="text-foreground/40" />
                : <ChevronRight size={13} className="text-foreground/40" />}
              <span className="text-xs font-light text-foreground">{core.keyword}</span>
              <span className="text-[10px] text-muted-foreground">
                {core.bridge_keywords.length} bridge{core.bridge_keywords.length !== 1 ? "s" : ""} · {clusterCount} cluster{clusterCount !== 1 ? "s" : ""}
              </span>
              <span className="ml-auto flex items-center">
                <span
                  role="button"
                  onClick={(e) => openCoreEdit(e, core)}
                  className="flex items-center gap-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
                >
                  <Edit2 size={11} />
                  seo
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-border/50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  {cards.map(({ key, type, bridge, cluster }) =>
                    type === "empty" ? (
                      <div key={key} className="flex items-center justify-between px-4 py-3 border border-dashed border-border rounded-md min-h-[52px]">
                        <div className="min-w-0">
                          <span className="text-xs font-light text-foreground">{bridge.keyword}</span>
                          <span className="text-[10px] text-muted-foreground ml-2 font-mono">{bridge.bridge_id}</span>
                        </div>
                        <button
                          onClick={() => openCreateModal(bridge)}
                          className="ml-2 shrink-0 px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted"
                        >
                          create cluster
                        </button>
                      </div>
                    ) : (
                      <div key={key} className="border border-border rounded-md px-4 py-3 min-h-[52px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-light text-foreground truncate">{cluster!.display_name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={cluster!.status} />
                            <StatusBadge status={cluster!.link_health} />
                            {deleteState[cluster!.id] === "pending" ? (
                              <InlineConfirm
                                onConfirm={() => deleteCluster(cluster!.id)}
                                onCancel={() =>
                                  setDeleteState((prev) => {
                                    const next = { ...prev };
                                    delete next[cluster!.id];
                                    return next;
                                  })
                                }
                                loading={false}
                              />
                            ) : deleteState[cluster!.id] === "deleting" ? (
                              <span className="text-[10px] text-muted-foreground">deleting...</span>
                            ) : (
                              <button
                                onClick={() =>
                                  setDeleteState((prev) => ({ ...prev, [cluster!.id]: "pending" }))
                                }
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                                title="delete cluster"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Core SEO Metadata Modal */}
      {coreEditTarget && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-md p-6 w-[480px]">
            <h3 className="text-sm font-light mb-1">core seo metadata</h3>
            <p className="text-[10px] text-muted-foreground mb-4 capitalize">{coreEditTarget.keyword}</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] tracking-widests uppercase text-foreground/40">meta title</label>
                  <span className="text-[10px] text-muted-foreground">{coreEditFields.meta_title.length}/60</span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={coreEditFields.meta_title}
                  onChange={(e) => setCoreEditFields((f) => ({ ...f, meta_title: e.target.value }))}
                  className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
                  placeholder="60 char max — keyword-first"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] tracking-widests uppercase text-foreground/40">meta description</label>
                  <span className="text-[10px] text-muted-foreground">{coreEditFields.meta_description.length}/155</span>
                </div>
                <input
                  type="text"
                  maxLength={155}
                  value={coreEditFields.meta_description}
                  onChange={(e) => setCoreEditFields((f) => ({ ...f, meta_description: e.target.value }))}
                  className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
                  placeholder="155 char max — benefit-driven"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-widests uppercase text-foreground/40 mb-1">page description</label>
                <textarea
                  rows={4}
                  value={coreEditFields.description}
                  onChange={(e) => setCoreEditFields((f) => ({ ...f, description: e.target.value }))}
                  className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 resize-none"
                  placeholder="200–400 words shown on the core category page"
                />
              </div>
              {coreEditError && <p className="text-xs font-light text-red-500">{coreEditError}</p>}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setCoreEditTarget(null)}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted"
                >
                  cancel
                </button>
                <button
                  onClick={saveCoreEdit}
                  disabled={coreEditSaving}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                >
                  {coreEditSaving ? "saving..." : "save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Cluster Modal */}
      {createModalOpen && selectedBridge && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-md p-6 w-96">
            <h3 className="text-sm font-light mb-4">create cluster</h3>
            <p className="text-[10px] text-muted-foreground mb-4">
              bridge: {selectedBridge.keyword}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
                  display name
                </label>
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => {
                    setNewClusterName(e.target.value);
                    if (!clusterIdManual) setNewClusterId(toSnakeCase(e.target.value));
                  }}
                  className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background focus:outline-none focus:border-foreground/50"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] tracking-widest uppercase text-foreground/40">
                    cluster id (snake_case)
                  </label>
                  {clusterIdManual && (
                    <button
                      type="button"
                      onClick={() => { setNewClusterId(toSnakeCase(newClusterName)); setClusterIdManual(false); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      auto
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={newClusterId}
                  onChange={(e) => {
                    setClusterIdManual(true);
                    setNewClusterId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                  }}
                  className={`w-full text-xs font-light rounded-md border px-3 py-2 bg-background font-mono focus:outline-none focus:border-foreground/50 ${
                    newClusterId && !/^[a-z0-9_]+$/.test(newClusterId)
                      ? "border-red-400"
                      : "border-border"
                  }`}
                />
                {newClusterId && !/^[a-z0-9_]+$/.test(newClusterId) && (
                  <p className="text-[10px] text-red-500 mt-0.5">only lowercase letters, digits, and underscores</p>
                )}
              </div>
              {createError && <p className="text-xs font-light text-red-500">{createError}</p>}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border hover:bg-muted"
                >
                  cancel
                </button>
                <button
                  onClick={createCluster}
                  disabled={creating}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                >
                  {creating ? "creating..." : "create cluster"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
