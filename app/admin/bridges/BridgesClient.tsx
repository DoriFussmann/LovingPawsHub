"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight, Edit2, Check, X, EyeOff } from "lucide-react";
import KeywordRow from "@/components/admin/KeywordRow";

interface CoreKeyword {
  id: string;
  keyword: string;
  core_id: string;
  search_volume: number | null;
}

interface SavedBridge {
  id: string;
  keyword: string;
  bridge_id: string;
  core_keyword_id: string;
  search_volume: number | null;
  cpc: number | null;
  keyword_difficulty: number | null;
  trend_data: number[] | null;
  competition: number | null;
  competition_level: string | null;
  search_intent: string | null;
  cps: number | null;
  meta_title: string | null;
  meta_description: string | null;
  description: string | null;
}

interface KeywordResult {
  keyword: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number;
  trend: number[];
  suggested_id: string;
  competition: number;
  competition_level: string;
  search_intent: string;
  cps: number;
}

const WEIGHTS = { volume: 40, cpc: 30, kd: 20, competition: 10 };

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}

function computeScores(keywords: KeywordResult[]): number[] {
  if (keywords.length === 0) return [];
  const normVol    = normalize(keywords.map((k) => k.search_volume));
  const normCpc    = normalize(keywords.map((k) => k.cpc));
  const normKdInv  = normalize(keywords.map((k) => 100 - k.keyword_difficulty));
  const normCompInv = normalize(keywords.map((k) => 1 - (k.competition ?? 0)));
  return keywords.map((_, i) =>
    Math.round(
      (normVol[i] * (WEIGHTS.volume / 100) +
       normCpc[i] * (WEIGHTS.cpc / 100) +
       normKdInv[i] * (WEIGHTS.kd / 100) +
       normCompInv[i] * (WEIGHTS.competition / 100)) * 100
    )
  );
}

function savedBridgeToResult(b: SavedBridge): KeywordResult {
  return {
    keyword: b.keyword,
    search_volume: b.search_volume ?? 0,
    cpc: b.cpc ?? 0,
    keyword_difficulty: b.keyword_difficulty ?? 50,
    trend: b.trend_data ?? [],
    suggested_id: b.bridge_id,
    competition: b.competition ?? 0.5,
    competition_level: b.competition_level ?? "MEDIUM",
    search_intent: b.search_intent ?? "informational",
    cps: b.cps ?? 0,
  };
}

const KPI_HEADERS = ["score", "volume", "cpc", "kd", "comp", "cps", "intent", "trend"] as const;

function KeywordTableHeader({ includeAction = true, includeCore = false }: { includeAction?: boolean; includeCore?: boolean }) {
  return (
    <thead className="border-b border-border bg-muted/30">
      <tr>
        {includeCore && <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">core</th>}
        {includeAction && <th className="px-3 py-2 w-8" />}
        <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">bridge keyword</th>
        {KPI_HEADERS.map((h) => (
          <th key={h} className={`px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-foreground/40 ${h === "intent" || h === "trend" ? "text-left" : "text-right"}`}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

interface BridgesClientProps {
  coreKeywords: CoreKeyword[];
  savedBridges: SavedBridge[];
}

export default function BridgesClient({ coreKeywords, savedBridges }: BridgesClientProps) {
  const [selectedCore, setSelectedCore] = useState<CoreKeyword | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bridges, setBridges] = useState<KeywordResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Panel open states — all collapsed by default
  const [coreOpen, setCoreOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [openCores, setOpenCores] = useState<Set<string>>(new Set());
  const [savedBridgesOpen, setSavedBridgesOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  // Bridge SEO metadata editing state
  const [editingBridgeId, setEditingBridgeId] = useState<string | null>(null);
  const [editingBridgeDbId, setEditingBridgeDbId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ meta_title: "", meta_description: "", description: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Noindex bridge state
  type NoindexReport = {
    articles_in_bridge: Array<{ article_id: string; h1_title: string; url: string; robots_directive: string }>;
    inbound_links: Array<{ source_article_id: string; source_title: string; source_url: string; links_to: string[] }>;
    safe_to_noindex: boolean;
  };
  const [noindexBridgeId, setNoindexBridgeId] = useState<string | null>(null);
  const [noindexReport, setNoindexReport] = useState<NoindexReport | null>(null);
  const [noindexLoading, setNoindexLoading] = useState(false);
  const [noindexApplying, setNoindexApplying] = useState(false);
  const [noindexMessage, setNoindexMessage] = useState<string | null>(null);
  const [noindexError, setNoindexError] = useState<string | null>(null);

  function openBridgeEdit(bridge: SavedBridge) {
    setEditingBridgeId(bridge.bridge_id);
    setEditingBridgeDbId(bridge.id);
    setEditFields({
      meta_title: bridge.meta_title ?? "",
      meta_description: bridge.meta_description ?? "",
      description: bridge.description ?? "",
    });
    setEditError(null);
  }

  async function generateDescription() {
    if (!editingBridgeDbId) return;
    setGeneratingDesc(true);
    setEditError(null);
    try {
      const res = await fetch("/api/admin/generate-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bridge", id: editingBridgeDbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generation failed");
      setEditFields((f) => ({ ...f, description: data.description }));
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "generation failed");
    } finally {
      setGeneratingDesc(false);
    }
  }

  function closeBridgeEdit() {
    setEditingBridgeId(null);
    setEditError(null);
  }

  async function saveBridgeEdit(bridgeId: string) {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/bridges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridge_id: bridgeId, ...editFields }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "save failed");
      }
      setEditingBridgeId(null);
      window.location.reload();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "save failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function openNoindex(bridge: SavedBridge, coreId: string) {
    setNoindexBridgeId(bridge.bridge_id);
    setNoindexReport(null);
    setNoindexMessage(null);
    setNoindexError(null);
    setNoindexLoading(true);
    try {
      const res = await fetch(
        `/api/admin/noindex-bridge?bridge_id=${encodeURIComponent(bridge.bridge_id)}&core_id=${encodeURIComponent(coreId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to load report");
      setNoindexReport(data);
    } catch (e) {
      setNoindexError(e instanceof Error ? e.message : "failed to load report");
    } finally {
      setNoindexLoading(false);
    }
  }

  async function applyNoindex(bridgeId: string, coreId: string) {
    setNoindexApplying(true);
    setNoindexError(null);
    try {
      const res = await fetch("/api/admin/noindex-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridge_id: bridgeId, core_id: coreId, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "noindex failed");
      setNoindexMessage(`noindexed ${data.updated} article${data.updated !== 1 ? "s" : ""}.`);
      setNoindexReport(null);
    } catch (e) {
      setNoindexError(e instanceof Error ? e.message : "noindex failed");
    } finally {
      setNoindexApplying(false);
    }
  }

  function closeNoindex() {
    setNoindexBridgeId(null);
    setNoindexReport(null);
    setNoindexMessage(null);
    setNoindexError(null);
  }

  function toggleCore(coreId: string) {
    setOpenCores((prev) => {
      const next = new Set(prev);
      if (next.has(coreId)) next.delete(coreId);
      else next.add(coreId);
      return next;
    });
  }

  const coreSavedBridges = useMemo(
    () => selectedCore ? savedBridges.filter((b) => b.core_keyword_id === selectedCore.id) : [],
    [selectedCore, savedBridges]
  );
  const savedBridgeIds = new Set(coreSavedBridges.map((b) => b.keyword.toLowerCase()));

  // All saved bridges flattened with their core keyword for the overview
  const allSavedBridges = coreKeywords.flatMap((core) =>
    savedBridges
      .filter((b) => b.core_keyword_id === core.id)
      .map((b) => ({ ...b, coreKeyword: core.keyword, coreId: core.core_id }))
  );

  // Scores for live suggestions
  const scores = useMemo(() => computeScores(bridges), [bridges]);

  // Scores for per-core saved bridges
  const coreSavedResults = useMemo(() => coreSavedBridges.map((b) => savedBridgeToResult(b)), [coreSavedBridges]);
  const coreSavedScores = useMemo(() => computeScores(coreSavedResults), [coreSavedResults]);

  const sortedBridges = useMemo(() => {
    return [...bridges]
      .map((b, i) => ({ ...b, score: scores[i] ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }, [bridges, scores]);

  // Auto-select top 10 and open suggestions panel when results load
  useEffect(() => {
    if (bridges.length === 0) return;
    const top10 = sortedBridges
      .filter((b) => !savedBridgeIds.has(b.keyword.toLowerCase()))
      .slice(0, 10)
      .map((b) => b.suggested_id);
    setSelected(new Set(top10));
    setSuggestionsOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridges]);

  async function generateBridges() {
    if (!selectedCore) return;
    setLoading(true);
    setError("");
    setBridges([]);
    setSelected(new Set());

    try {
      const res = await fetch("/api/bridges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          core_keyword: selectedCore.keyword,
          core_id: selectedCore.core_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setBridges(data.bridges ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "generation failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleBridge(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSelected() {
    if (!selectedCore || selected.size === 0) return;
    setSaving(true);
    setSaveMessage("");
    const toSave = bridges.filter((b) => selected.has(b.suggested_id));

    try {
      const res = await fetch("/api/bridges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          core_keyword_id: selectedCore.id,
          bridges: toSave,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveMessage(`${toSave.length} bridge${toSave.length !== 1 ? "s" : ""} saved.`);
      window.location.reload();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Core Keywords panel ── */}
      <div className="border border-border rounded-md overflow-hidden">
        <button
          onClick={() => setCoreOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            {coreOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
            <p className="text-[10px] tracking-widest uppercase text-foreground/40">core keywords</p>
            <span className="text-[10px] text-muted-foreground">
              {coreKeywords.length} keyword{coreKeywords.length !== 1 ? "s" : ""}
              {selectedCore && <> · <span className="text-foreground/60">{selectedCore.keyword} selected</span></>}
            </span>
          </div>
        </button>
        {coreOpen && (
          <div className="border-t border-border/50">
            {coreKeywords.length === 0 ? (
              <p className="px-5 py-4 text-xs font-light text-muted-foreground">
                no core keywords saved yet — run research first.
              </p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">core keyword</th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">volume</th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">bridges saved</th>
                    <th className="px-4 py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {coreKeywords.map((core) => {
                    const bridgeCount = savedBridges.filter((b) => b.core_keyword_id === core.id).length;
                    const isSelected = selectedCore?.id === core.id;
                    return (
                      <tr
                        key={core.id}
                        onClick={() => { setSelectedCore(core); setBridges([]); setSelected(new Set()); setSaveMessage(""); setSavedBridgesOpen(false); }}
                        className={`border-b border-border/20 last:border-0 text-xs font-light cursor-pointer transition-colors ${
                          isSelected ? "bg-foreground/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <td className="px-4 py-3 text-foreground">{core.keyword}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                          {core.search_volume != null ? core.search_volume.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{bridgeCount}</td>
                        <td className="px-4 py-3 text-right">
                          {isSelected && (
                            <span className="text-[10px] tracking-widest uppercase text-foreground/40">selected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── All saved bridges overview (no core selected) ── */}
      {allSavedBridges.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setOverviewOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              {overviewOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">all saved bridges</p>
              <span className="text-[10px] text-muted-foreground">{allSavedBridges.length} keyword{allSavedBridges.length !== 1 ? "s" : ""}</span>
            </div>
          </button>
          {overviewOpen && (
            <div className="border-t border-border/50 divide-y divide-border/30">
              {coreKeywords.map((core) => {
                const coreBridges = allSavedBridges.filter((b) => b.core_keyword_id === core.id);
                if (coreBridges.length === 0) return null;
                const coreResults = coreBridges.map((b) => savedBridgeToResult(b));
                const coreScores = computeScores(coreResults);
                const isOpen = openCores.has(core.id);
                return (
                  <div key={core.id}>
                    <button
                      onClick={() => toggleCore(core.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                    >
                      {isOpen
                        ? <ChevronDown size={12} className="text-foreground/30 shrink-0" />
                        : <ChevronRight size={12} className="text-foreground/30 shrink-0" />}
                      <span className="text-xs font-light text-foreground/70 capitalize">{core.keyword}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {coreBridges.length} bridge{coreBridges.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border/30">
                        <table className="w-full">
                          <KeywordTableHeader includeAction={false} />
                          <tbody>
                            {coreResults.map((kw, i) => (
                              <KeywordRow
                                key={kw.suggested_id}
                                keyword={kw.keyword}
                                searchVolume={kw.search_volume}
                                cpc={kw.cpc}
                                keywordDifficulty={kw.keyword_difficulty}
                                trend={kw.trend}
                                score={coreScores[i]}
                                competition={kw.competition}
                                competitionLevel={kw.competition_level}
                                searchIntent={kw.search_intent}
                                cps={kw.cps}
                                checked={false}
                                onToggle={() => {}}
                                hideAction
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
          )}
        </div>
      )}

      {/* ── Per-core panels (shown once a core is selected) ── */}
      {selectedCore && (
        <div className="space-y-3">

          {/* Generate row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] tracking-widest uppercase text-foreground/40">
              generating for <span className="text-foreground/60 normal-case">{selectedCore.keyword}</span>
            </p>
            <div className="flex items-center gap-3">
              {error && <span className="text-xs font-light text-red-500">{error}</span>}
              <button
                onClick={generateBridges}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
              >
                {loading ? "generating..." : "generate bridge suggestions"}
              </button>
            </div>
          </div>

          {/* Saved bridges for this core */}
          {coreSavedBridges.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setSavedBridgesOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {savedBridgesOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
                  <p className="text-[10px] tracking-widest uppercase text-foreground/40">saved bridges</p>
                  <span className="text-[10px] text-muted-foreground">{coreSavedBridges.length} keyword{coreSavedBridges.length !== 1 ? "s" : ""}</span>
                </div>
              </button>
              {savedBridgesOpen && (
                <div className="border-t border-border/50">
                  <table className="w-full">
                    <KeywordTableHeader includeAction={false} />
                    <tbody>
                      {coreSavedResults.map((kw, i) => (
                        <KeywordRow
                          key={kw.suggested_id}
                          keyword={kw.keyword}
                          searchVolume={kw.search_volume}
                          cpc={kw.cpc}
                          keywordDifficulty={kw.keyword_difficulty}
                          trend={kw.trend}
                          score={coreSavedScores[i]}
                          competition={kw.competition}
                          competitionLevel={kw.competition_level}
                          searchIntent={kw.search_intent}
                          cps={kw.cps}
                          checked={false}
                          onToggle={() => {}}
                          hideAction
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Bridge SEO Metadata */}
          {coreSavedBridges.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setSeoOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {seoOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
                  <p className="text-[10px] tracking-widests uppercase text-foreground/40">bridge seo metadata</p>
                  <span className="text-[10px] text-muted-foreground">meta titles, descriptions &amp; page text</span>
                </div>
              </button>
              {seoOpen && (
                <div className="border-t border-border/50 divide-y divide-border/20">
                  {coreSavedBridges.map((bridge) => (
                    <div key={bridge.bridge_id} className="px-5 py-3">
                      {editingBridgeId === bridge.bridge_id ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-light text-foreground capitalize">{bridge.keyword}</p>
                            <button onClick={closeBridgeEdit} className="text-muted-foreground hover:text-foreground transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] tracking-widests uppercase text-foreground/40">meta title</label>
                              <span className="text-[10px] text-muted-foreground">{editFields.meta_title.length}/60</span>
                            </div>
                            <input
                              type="text"
                              maxLength={60}
                              value={editFields.meta_title}
                              onChange={(e) => setEditFields((f) => ({ ...f, meta_title: e.target.value }))}
                              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
                              placeholder="60 char max — keyword-first"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] tracking-widests uppercase text-foreground/40">meta description</label>
                              <span className="text-[10px] text-muted-foreground">{editFields.meta_description.length}/155</span>
                            </div>
                            <input
                              type="text"
                              maxLength={155}
                              value={editFields.meta_description}
                              onChange={(e) => setEditFields((f) => ({ ...f, meta_description: e.target.value }))}
                              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
                              placeholder="155 char max — benefit-driven"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] tracking-widests uppercase text-foreground/40">page description</label>
                              <button
                                type="button"
                                onClick={generateDescription}
                                disabled={generatingDesc}
                                className="text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                              >
                                {generatingDesc ? "generating..." : "✦ generate with AI"}
                              </button>
                            </div>
                            <textarea
                              rows={3}
                              value={editFields.description}
                              onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 resize-none"
                              placeholder="200–400 words shown on the bridge category page"
                            />
                          </div>
                          {editError && <p className="text-xs text-red-500 font-light">{editError}</p>}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveBridgeEdit(bridge.bridge_id)}
                              disabled={editSaving}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-foreground/30 bg-foreground text-background disabled:opacity-50"
                            >
                              <Check size={11} />
                              {editSaving ? "saving..." : "save"}
                            </button>
                            <button onClick={closeBridgeEdit} className="px-3 py-1.5 text-xs font-light rounded-md border border-border text-foreground/60 hover:text-foreground transition-colors">
                              cancel
                            </button>
                          </div>
                        </div>
                      ) : noindexBridgeId === bridge.bridge_id ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-light text-foreground capitalize">noindex: {bridge.keyword}</p>
                            <button onClick={closeNoindex} className="text-muted-foreground hover:text-foreground transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                          {noindexMessage ? (
                            <p className="text-xs font-light text-green-600">{noindexMessage}</p>
                          ) : noindexLoading ? (
                            <p className="text-xs font-light text-muted-foreground">checking inbound links...</p>
                          ) : noindexReport ? (
                            <div className="space-y-2">
                              <p className="text-xs font-light text-foreground/70">
                                {noindexReport.articles_in_bridge.length} article{noindexReport.articles_in_bridge.length !== 1 ? "s" : ""} will be noindexed.
                              </p>
                              {noindexReport.inbound_links.length > 0 ? (
                                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md px-3 py-2">
                                  <p className="text-[10px] font-medium uppercase tracking-widest text-yellow-700 dark:text-yellow-400 mb-1">
                                    {noindexReport.inbound_links.length} page{noindexReport.inbound_links.length !== 1 ? "s" : ""} link here
                                  </p>
                                  <ul className="space-y-0.5">
                                    {noindexReport.inbound_links.slice(0, 5).map((l) => (
                                      <li key={l.source_article_id} className="text-[11px] text-yellow-700 dark:text-yellow-300 font-light truncate">
                                        {l.source_title}
                                      </li>
                                    ))}
                                    {noindexReport.inbound_links.length > 5 && (
                                      <li className="text-[11px] text-yellow-600 font-light">
                                        +{noindexReport.inbound_links.length - 5} more
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-[11px] text-green-600 font-light">no inbound links found — safe to noindex.</p>
                              )}
                              {noindexError && <p className="text-xs text-red-500 font-light">{noindexError}</p>}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => selectedCore && applyNoindex(bridge.bridge_id, selectedCore.core_id)}
                                  disabled={noindexApplying}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                  <EyeOff size={11} />
                                  {noindexApplying ? "applying..." : "confirm noindex"}
                                </button>
                                <button onClick={closeNoindex} className="px-3 py-1.5 text-xs font-light rounded-md border border-border text-foreground/60 hover:text-foreground transition-colors">
                                  cancel
                                </button>
                              </div>
                            </div>
                          ) : noindexError ? (
                            <p className="text-xs text-red-500 font-light">{noindexError}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-light text-foreground capitalize mb-0.5">{bridge.keyword}</p>
                            {bridge.meta_title ? (
                              <p className="text-[11px] text-muted-foreground truncate">{bridge.meta_title}</p>
                            ) : (
                              <p className="text-[11px] text-foreground/25 italic">no meta title set</p>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-3 mt-0.5">
                            <button
                              onClick={() => openBridgeEdit(bridge)}
                              className="flex items-center gap-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 size={11} />
                              edit
                            </button>
                            <button
                              onClick={() => selectedCore && openNoindex(bridge, selectedCore.core_id)}
                              className="flex items-center gap-1 text-[10px] font-light text-muted-foreground hover:text-red-600 transition-colors"
                              title="Noindex this bridge cluster"
                            >
                              <EyeOff size={11} />
                              noindex
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bridge suggestions */}
          {bridges.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setSuggestionsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {suggestionsOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
                  <p className="text-[10px] tracking-widest uppercase text-foreground/40">bridge suggestions</p>
                  <span className="text-[10px] text-muted-foreground">{bridges.length} results · {selected.size} selected</span>
                </div>
                {suggestionsOpen && (
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {saveMessage && (
                      <span className="text-xs font-light text-muted-foreground">{saveMessage}</span>
                    )}
                    <button
                      onClick={saveSelected}
                      disabled={saving || selected.size === 0}
                      className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                    >
                      {saving ? "saving..." : "save selected"}
                    </button>
                  </div>
                )}
              </button>
              {suggestionsOpen && (
                <div className="border-t border-border/50">
                  <table className="w-full">
                    <KeywordTableHeader />
                    <tbody>
                      {sortedBridges.map((b) => (
                        <KeywordRow
                          key={b.suggested_id}
                          keyword={b.keyword}
                          searchVolume={b.search_volume}
                          cpc={b.cpc}
                          keywordDifficulty={b.keyword_difficulty}
                          trend={b.trend}
                          suggestedId={b.suggested_id}
                          score={b.score}
                          competition={b.competition}
                          competitionLevel={b.competition_level}
                          searchIntent={b.search_intent}
                          cps={b.cps}
                          checked={selected.has(b.suggested_id)}
                          disabled={savedBridgeIds.has(b.keyword.toLowerCase())}
                          onToggle={() => toggleBridge(b.suggested_id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
