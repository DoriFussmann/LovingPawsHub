"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import SkeletonCard from "@/components/admin/SkeletonCard";
import {
  PromptConfig,
  TYPE_ABBREV,
  interpolate,
} from "@/lib/promptTemplates";

interface ClusterOption {
  id: string;
  cluster_id: string;
  display_name: string;
}

interface BridgeOption {
  id: string;
  keyword: string;
  bridge_id: string;
  clusters: ClusterOption[];
}

interface CoreOption {
  id: string;
  keyword: string;
  core_id: string;
  bridge_keywords: BridgeOption[];
}

interface SkeletonData {
  article_id: string;
  content_type: string;
  is_core_article: boolean;
  primary_keyword: string;
  slug: string;
  h1_suggestion?: string;
  meta_title?: string;
  meta_description?: string;
  key_messages?: string[];
  suggested_word_count_min?: number;
  suggested_word_count_max?: number;
  internal_link_targets?: Array<{
    article_id: string;
    slug: string;
    anchor_phrase: string;
    direction: string;
  }>;
  schema_type?: string;
}

interface ArticleCounts {
  HUB: number;
  GUIDE: number;
  FAQ: number;
  COMPARISON: number;
  RISK: number;
}

interface SkeletonsClientProps {
  coreKeywords: CoreOption[];
  resources: Array<{ url: string | null; title: string | null; notes: string | null }>;
  industryName: string;
  promptConfig: PromptConfig;
  clustersWithBriefs: string[];
}

const ARTICLE_TYPES: Array<{
  key: keyof ArticleCounts;
  label: string;
  wordRange: string;
  defaultCount: number;
}> = [
  { key: "HUB",        label: "HUB (cluster index)", wordRange: "500–800 words",    defaultCount: 1 },
  { key: "GUIDE",      label: "GUIDE",               wordRange: "1,200–1,800 words", defaultCount: 1 },
  { key: "FAQ",        label: "FAQ",                 wordRange: "800–1,200 words",   defaultCount: 1 },
  { key: "COMPARISON", label: "COMPARISON",          wordRange: "1,000–1,500 words", defaultCount: 1 },
  { key: "RISK",       label: "RISK",                wordRange: "800–1,200 words",   defaultCount: 1 },
];

interface SelectedContext {
  core: CoreOption;
  bridge: BridgeOption;
  cluster: ClusterOption;
}

interface GenTask {
  type: string;
  index: number;
  typeCount: number;
  label: string;
}

// ── Generating overlay ────────────────────────────────────────────────────────

function GeneratingOverlay({
  tasks,
  progress,
  completed,
  elapsed,
}: {
  tasks: GenTask[];
  progress: number;
  completed: SkeletonData[];
  elapsed: number;
}) {
  const [dotIndex, setDotIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDotIndex((i) => (i + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);

  const current = tasks[progress];
  const dots = ".".repeat(dotIndex);
  const done = completed.length;
  const total = tasks.length;

  return (
    <div className="border border-border rounded-md px-5 py-5 space-y-4">
      {/* Overall progress */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widests uppercase text-foreground/40">
          generating skeletons
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

      {/* Current task */}
      {current && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse" />
          <span className="text-xs font-light text-foreground">
            {current.label} {current.index}/{current.typeCount}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">calling claude{dots}</span>
        </div>
      )}

      {/* Completed list */}
      {completed.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/40">
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1.5">completed</p>
          {completed.map((s) => (
            <div key={s.article_id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="text-emerald-500">✓</span>
              <span className="font-mono">{s.article_id}</span>
              <span className="text-foreground/40">·</span>
              <span>{s.primary_keyword}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SkeletonsClient({
  coreKeywords,
  resources,
  industryName,
  promptConfig: initialPromptConfig,
  clustersWithBriefs,
}: SkeletonsClientProps) {
  const [ctx, setCtx] = useState<SelectedContext | null>(null);
  const [counts, setCounts] = useState<ArticleCounts>({
    HUB: 1, GUIDE: 1, FAQ: 1, COMPARISON: 1, RISK: 1,
  });
  const [configOpen, setConfigOpen] = useState(false);

  // Prompt config loaded from DB via page — editable in General Controls
  const [promptConfig] = useState<PromptConfig>(initialPromptConfig);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [genTasks, setGenTasks] = useState<GenTask[]>([]);
  const [genProgress, setGenProgress] = useState(0);
  const [genCompleted, setGenCompleted] = useState<SkeletonData[]>([]);
  const [genElapsed, setGenElapsed] = useState(0);
  const [error, setError] = useState("");

  // Results
  const [skeletons, setSkeletons] = useState<SkeletonData[]>([]);
  const [editedSkeletons, setEditedSkeletons] = useState<SkeletonData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [allSaved, setAllSaved] = useState(false);

  // Track which clusters have had a brief saved (seed from server, update after save)
  const [briefCreatedClusters, setBriefCreatedClusters] = useState<Set<string>>(
    () => new Set(clustersWithBriefs)
  );

  // Elapsed timer while generating
  useEffect(() => {
    if (!generating) return;
    setGenElapsed(0);
    const id = setInterval(() => setGenElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [generating]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const resourceList =
    resources
      .map((r) => r.url ?? r.title ?? "")
      .filter(Boolean)
      .join(", ") || "none";

  async function generateSkeletons() {
    if (!ctx) return;

    // Build task list
    const tasks: GenTask[] = [];
    for (const t of ARTICLE_TYPES) {
      const n = counts[t.key];
      for (let i = 1; i <= n; i++) {
        tasks.push({ type: t.key, index: i, typeCount: n, label: t.label });
      }
    }
    if (tasks.length === 0) return;

    setGenTasks(tasks);
    setGenProgress(0);
    setGenCompleted([]);
    setGenerating(true);
    setError("");
    setSkeletons([]);
    setEditedSkeletons([]);
    setAllSaved(false);

    const results: SkeletonData[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setGenProgress(i);

      const typeAddon = promptConfig.typeAddons[task.type] ?? "";
      const vars: Record<string, string> = {
        type_addon: typeAddon,
        content_type: task.type,
        industry_name: industryName,
        core_keyword: ctx.core.keyword,
        bridge_keyword: ctx.bridge.keyword,
        cluster_id: ctx.cluster.cluster_id,
        article_index: String(task.index),
        type_count: String(task.typeCount),
        resources: resourceList,
        type_abbrev: TYPE_ABBREV[task.type] ?? task.type.toLowerCase(),
        zero_padded_index: String(task.index).padStart(2, "0"),
        is_core_article: task.type === "CORE" ? "true" : "false",
        current_year: String(new Date().getFullYear()),
      };

      const systemPrompt = interpolate(promptConfig.systemPrompt, vars);
      const userPrompt = interpolate(promptConfig.userPromptTemplate, vars);

      try {
        const res = await fetch("/api/generate-skeletons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate_one",
            system_prompt: systemPrompt,
            user_prompt: userPrompt,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "generation failed");
        results.push(data.skeleton);
        setGenCompleted([...results]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "generation failed");
        setGenerating(false);
        return;
      }
    }

    setGenerating(false);
    setSkeletons(results);
    setEditedSkeletons(results);
    // Select all by default
    setSelectedIds(new Set(results.map((s) => s.article_id)));
  }

  async function saveSkeletons() {
    if (!ctx || editedSkeletons.length === 0) return;
    const toSave = editedSkeletons.filter((s) => selectedIds.has(s.article_id));
    if (toSave.length === 0) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/generate-skeletons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          cluster_db_id: ctx.cluster.id,
          skeletons: toSave,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "save failed");
      }
      setSaveMessage(`${toSave.length} brief${toSave.length !== 1 ? "s" : ""} saved — cluster brief created.`);
      setAllSaved(true);
      // Mark this cluster as having a brief
      setBriefCreatedClusters((prev) => new Set([...prev, ctx.cluster.id]));
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelectId(articleId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(editedSkeletons.map((s) => s.article_id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  const allClusters = coreKeywords.flatMap((core) =>
    core.bridge_keywords.flatMap((bridge) =>
      bridge.clusters.map((cluster) => ({ core, bridge, cluster }))
    )
  );

  return (
    <div className="space-y-6">

      {/* Step 1: Pick a cluster */}
      <div>
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
          step 1 — select cluster
        </p>
        {allClusters.length === 0 ? (
          <div className="border border-border rounded-md p-5">
            <p className="text-xs font-light text-muted-foreground">
              no clusters yet — create them in the{" "}
              <a href="/admin/clusters" className="underline">clusters</a> page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {allClusters.map(({ core, bridge, cluster }) => {
              const isSelected = ctx?.cluster.id === cluster.id;
              const hasBrief = briefCreatedClusters.has(cluster.id);
              return (
                <button
                  key={cluster.id}
                  onClick={() => {
                    setCtx({ core, bridge, cluster });
                    setSkeletons([]);
                    setEditedSkeletons([]);
                    setSelectedIds(new Set());
                    setAllSaved(false);
                    setSaveMessage("");
                    setError("");
                    setConfigOpen(false);
                  }}
                  className={`w-full text-left border rounded-md px-4 py-3 transition-colors ${
                    isSelected
                      ? "border-foreground/30 bg-neutral-100"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{core.keyword}</span>
                      <span className="opacity-40">→</span>
                      <span>{bridge.keyword}</span>
                      <span className="opacity-40">→</span>
                      <span className="text-foreground text-xs">{cluster.display_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasBrief && (
                        <span className="text-[10px] tracking-widest uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                          ✓ created
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] tracking-widest uppercase text-foreground/40">selected</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Configure */}
      {ctx && (
        <div className="border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setConfigOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              {configOpen
                ? <ChevronDown size={13} className="text-foreground/40" />
                : <ChevronRight size={13} className="text-foreground/40" />}
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                step 2 — configure article types
              </p>
              <span className="text-[10px] text-muted-foreground">
                {ctx.cluster.display_name}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {totalCount} article{totalCount !== 1 ? "s" : ""}
            </span>
          </button>

          {configOpen && (
            <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-4">
              <div className="space-y-2">
                {ARTICLE_TYPES.map((type) => (
                  <div key={type.key} className="flex items-center gap-4">
                    <div className="w-44 text-xs font-light text-foreground">{type.label}</div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={counts[type.key]}
                      onChange={(e) =>
                        setCounts((prev) => ({ ...prev, [type.key]: parseInt(e.target.value) || 0 }))
                      }
                      className="w-16 text-xs font-light rounded-md border border-border px-2 py-1.5 bg-background text-center focus:outline-none focus:border-foreground/50"
                    />
                    <span className="text-[10px] text-muted-foreground">{type.wordRange}</span>
                  </div>
                ))}
              </div>
              {Object.values(counts).some((n) => n > 1) && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
                  <span className="text-[11px] font-light leading-snug">
                    Warning: one or more types have a count &gt; 1. Each type should appear at most once per cluster — multiple articles of the same type will create duplicate content.
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-light text-muted-foreground">
                    {totalCount} article{totalCount !== 1 ? "s" : ""} · {totalCount} separate Claude calls
                  </span>
                </div>
                <button
                  onClick={generateSkeletons}
                  disabled={generating || totalCount === 0}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                >
                  {generating ? "generating..." : "generate cluster brief"}
                </button>
              </div>
              {error && <p className="text-xs font-light text-red-500">{error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Generating progress */}
      {generating && (
        <GeneratingOverlay
          tasks={genTasks}
          progress={genProgress}
          completed={genCompleted}
          elapsed={genElapsed}
        />
      )}

      {/* Step 3: Review & Save Cluster Brief */}
      {skeletons.length > 0 && !generating && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-widest uppercase text-foreground/40">
              step 3 — review {skeletons.length} brief{skeletons.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              {/* Select / deselect helpers */}
              <button
                onClick={selectAll}
                className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                select all
              </button>
              <span className="text-[10px] text-muted-foreground/40">·</span>
              <button
                onClick={deselectAll}
                className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                deselect all
              </button>
              {saveMessage && (
                <span className={`text-xs font-light ${allSaved ? "text-emerald-600" : "text-red-500"}`}>
                  {saveMessage}
                </span>
              )}
              <button
                onClick={saveSkeletons}
                disabled={saving || selectedIds.size === 0}
                className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
              >
                {saving
                  ? "saving..."
                  : `save cluster brief${selectedIds.size < editedSkeletons.length ? ` (${selectedIds.size} selected)` : ""}`
                }
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {editedSkeletons.map((skeleton, i) => {
              const isChecked = selectedIds.has(skeleton.article_id);
              return (
                <div key={skeleton.article_id} className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="pt-3.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectId(skeleton.article_id)}
                      className="h-3.5 w-3.5 rounded border-border accent-foreground cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SkeletonCard
                      skeleton={skeleton}
                      saved={allSaved && isChecked}
                      onChange={(updated) => {
                        setAllSaved(false);
                        setEditedSkeletons((prev) => {
                          const next = [...prev];
                          next[i] = updated;
                          return next;
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

