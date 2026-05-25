"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import KeywordRow from "@/components/admin/KeywordRow";

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

interface CompetitorResult {
  domain: string;
  estimated_traffic: number;
  avg_position: number;
}

interface SavedCoreKeyword {
  id: string;
  keyword: string;
  core_id: string;
  search_volume: number | null;
  cpc: number | null;
  keyword_difficulty: number | null;
  trend_data: number[] | null;
}

interface ResearchClientProps {
  savedCoreKeywords: SavedCoreKeyword[];
  industryId: string | null;
  industryName: string;
  initialWeights?: { volume: number; cpc: number; kd: number; competition: number };
}

// Default weights (must sum to 100)
const DEFAULT_WEIGHTS = {
  volume: 40,
  cpc: 30,
  kd: 20,       // inverse — lower KD scores higher
  competition: 10, // inverse — lower competition scores higher
};

type SortKey = "search_volume" | "cpc" | "keyword_difficulty" | "competition" | "cps" | "score";

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "score", label: "score" },
  { key: "search_volume", label: "volume" },
  { key: "cpc", label: "cpc" },
  { key: "keyword_difficulty", label: "kd" },
  { key: "competition", label: "comp" },
  { key: "cps", label: "cps" },
];

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}

function computeScores(keywords: KeywordResult[], weights: typeof DEFAULT_WEIGHTS): number[] {
  if (keywords.length === 0) return [];

  const normVol = normalize(keywords.map((k) => k.search_volume));
  const normCpc = normalize(keywords.map((k) => k.cpc));
  const normKdInv = normalize(keywords.map((k) => 100 - k.keyword_difficulty)); // invert
  const normCompInv = normalize(keywords.map((k) => 1 - k.competition));        // invert

  const wVol = weights.volume / 100;
  const wCpc = weights.cpc / 100;
  const wKd = weights.kd / 100;
  const wComp = weights.competition / 100;

  return keywords.map((_, i) =>
    Math.round(
      (normVol[i] * wVol + normCpc[i] * wCpc + normKdInv[i] * wKd + normCompInv[i] * wComp) * 100
    )
  );
}

export default function ResearchClient({
  savedCoreKeywords: initialSavedCoreKeywords,
  industryId,
  industryName,
  initialWeights,
}: ResearchClientProps) {
  const [savedCoreKeywords, setSavedCoreKeywords] = useState(initialSavedCoreKeywords);
  const [seedConcept, setSeedConcept] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMock, setIsMock] = useState(false);

  const [keywords, setKeywords] = useState<KeywordResult[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [importingDomain, setImportingDomain] = useState<string | null>(null);
  const [competitorsOpen, setCompetitorsOpen] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Scoring weights modal
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [weights, setWeights] = useState(initialWeights ?? DEFAULT_WEIGHTS);
  const [draftWeights, setDraftWeights] = useState(initialWeights ?? DEFAULT_WEIGHTS);

  // Collapsible panels
  const [savedOpen, setSavedOpen] = useState(false);
  const [band2Open, setBand2Open] = useState(false);
  const [band3Open, setBand3Open] = useState(false);

  // Manual add-keyword flow
  const [addInput, setAddInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addResult, setAddResult] = useState<(KeywordResult & { score: number }) | null>(null);
  const [addIsMock, setAddIsMock] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [, setAddSaved] = useState(false);

  const savedKeywordSet = new Set(savedCoreKeywords.map((k) => k.keyword.toLowerCase()));

  async function deleteCore(coreId: string) {
    const res = await fetch(`/api/research?core_id=${encodeURIComponent(coreId)}`, { method: "DELETE" });
    if (res.ok) {
      setSavedCoreKeywords((prev) => prev.filter((k) => k.core_id !== coreId));
    }
  }

  async function lookupKeyword() {
    const kw = addInput.trim();
    if (!kw) return;
    setAddLoading(true);
    setAddError("");
    setAddResult(null);
    setAddIsMock(false);
    setAddSaved(false);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup_exact", keyword: kw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "lookup failed");
      const kwr: KeywordResult = data.keyword;
      const sc = computeScores([kwr], weights);
      setAddResult({ ...kwr, score: sc[0] });
      setAddIsMock(data.is_mock ?? false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "lookup failed");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveManualKeyword() {
    if (!addResult) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          industry_id: industryId,
          keywords: [addResult],
          industry_name: industryName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setAddSaved(true);
      setAddResult(null);
      setAddInput("");
      window.location.reload();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "save failed");
    } finally {
      setAddSaving(false);
    }
  }

  // Compute scores for all keywords
  const scores = useMemo(() => computeScores(keywords, weights), [keywords, weights]);

  // Scores for saved keywords (competition/cps unknown → use neutral defaults)
  const savedAsKeywordResults: KeywordResult[] = useMemo(() =>
    savedCoreKeywords.map((k) => ({
      keyword: k.keyword,
      search_volume: k.search_volume ?? 0,
      cpc: k.cpc ?? 0,
      keyword_difficulty: k.keyword_difficulty ?? 50,
      trend: k.trend_data ?? [],
      suggested_id: k.core_id,
      competition: 0.5,
      competition_level: "MEDIUM",
      search_intent: "commercial",
      cps: 1,
    })),
  [savedCoreKeywords]);

  const savedScores = useMemo(() => computeScores(savedAsKeywordResults, weights), [savedAsKeywordResults, weights]);

  // Attach scores, sort, and slice into display bands
  const sortedKeywords = useMemo(() => {
    const withScores = keywords.map((kw, i) => ({ ...kw, score: scores[i] }));
    return [...withScores].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [keywords, scores, sortKey, sortDir]);

  const band1 = useMemo(() => sortedKeywords.slice(0, 20), [sortedKeywords]);
  const band2 = useMemo(() => sortedKeywords.slice(20, 100), [sortedKeywords]);
  const band3 = useMemo(() => sortedKeywords.slice(100), [sortedKeywords]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="opacity-20"><ChevronDown size={10} /></span>;
    return sortDir === "desc" ? <ChevronDown size={10} /> : <ChevronUp size={10} />;
  }

  const weightTotal = draftWeights.volume + draftWeights.cpc + draftWeights.kd + draftWeights.competition;

  async function runResearch() {
    if (!seedConcept.trim()) return;
    setLoading(true);
    setError("");
    setIsMock(false);
    setKeywords([]);
    setCompetitors([]);
    setSelected(new Set());
    setCompetitorsOpen(false);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed_keyword: seedConcept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setKeywords(data.keywords ?? []);
      setCompetitors(data.competitors ?? []);
      setIsMock(data.is_mock ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "research failed");
    } finally {
      setLoading(false);
    }
  }

  function autoSelect(kws: KeywordResult[], sc: number[]) {
    const withScores = kws.map((k, i) => ({ id: k.suggested_id, score: sc[i] }));
    const top5 = [...withScores].sort((a, b) => b.score - a.score).slice(0, 5).map((x) => x.id);
    setSelected(new Set(top5));
  }

  // Auto-select top 5 whenever keywords load
  useEffect(() => {
    if (keywords.length > 0) {
      autoSelect(keywords, scores);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords]);

  function toggleKeyword(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyWeights() {
    if (weightTotal !== 100) return;
    setWeights(draftWeights);
    setWeightsOpen(false);
    // Re-select top 5 with new weights
    const newScores = computeScores(keywords, draftWeights);
    autoSelect(keywords, newScores);
  }

  async function saveSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    setSaveMessage("");
    const toSave = keywords.filter((k) => selected.has(k.suggested_id));

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          industry_id: industryId,
          keywords: toSave,
          industry_name: industryName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setSaveMessage(`${toSave.length} core keyword${toSave.length !== 1 ? "s" : ""} saved.`);
      window.location.reload();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function importCompetitor(domain: string) {
    setImportingDomain(domain);
    try {
      await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_competitor",
          industry_id: industryId,
          domain,
        }),
      });
    } finally {
      setImportingDomain(null);
    }
  }

  // Shared table header for keyword tables
  function KeywordTableHeader() {
    return (
      <thead className="border-b border-border bg-muted/30">
        <tr>
          <th className="px-3 py-2 w-8" />
          <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">keyword</th>
          {COLUMNS.map(({ key, label }) => (
            <th
              key={key}
              onClick={() => handleSort(key)}
              className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40 cursor-pointer hover:text-foreground/70 select-none"
            >
              <span className="inline-flex items-center gap-1 justify-end">
                {label}
                <SortIcon col={key} />
              </span>
            </th>
          ))}
          <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">intent</th>
          <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">trend</th>
        </tr>
      </thead>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Saved Core Keywords (top, collapsed by default) ── */}
      {savedCoreKeywords.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setSavedOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              {savedOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">saved core keywords</p>
              <span className="text-[10px] text-muted-foreground">{savedCoreKeywords.length} keyword{savedCoreKeywords.length !== 1 ? "s" : ""}</span>
            </div>
          </button>
          {savedOpen && (
            <div className="border-t border-border/50">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">keyword</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">score</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">volume</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">cpc</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">kd</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">comp</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">cps</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">intent</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">trend</th>
                  </tr>
                </thead>
                <tbody>
                  {savedAsKeywordResults.map((kw, i) => (
                    <KeywordRow
                      key={kw.suggested_id}
                      keyword={kw.keyword}
                      searchVolume={kw.search_volume}
                      cpc={kw.cpc}
                      keywordDifficulty={kw.keyword_difficulty}
                      trend={kw.trend}
                      suggestedId={kw.suggested_id}
                      score={savedScores[i]}
                      checked={false}
                      onToggle={() => {}}
                      onDelete={() => deleteCore(kw.suggested_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add a specific keyword ── */}
      <div className="border border-border rounded-md p-5 space-y-4">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40">add a specific keyword</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value); setAddResult(null); setAddError(""); setAddIsMock(false); setAddSaved(false); }}
            onKeyDown={(e) => e.key === "Enter" && lookupKeyword()}
            placeholder="e.g. keyword phrase"
            className="flex-1 text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
          />
          <button
            onClick={lookupKeyword}
            disabled={addLoading || !addInput.trim()}
            className="px-3 py-2 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50 whitespace-nowrap"
          >
            {addLoading ? "looking up..." : "look up"}
          </button>
        </div>

        {addError && <p className="text-xs font-light text-red-500">{addError}</p>}

        {addResult && addIsMock && (
          <div className="border border-amber-200 bg-amber-50 rounded-md px-4 py-2">
            <p className="text-xs font-light text-amber-700">
              [mock data — DataForSEO unavailable] metrics shown are placeholders. you can still save this keyword.
            </p>
          </div>
        )}

        {addResult && (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">keyword</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">score</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">volume</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widest text-foreground/40">cpc</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widests text-foreground/40">kd</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-widests text-foreground/40">comp</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widests text-foreground/40">intent</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widests text-foreground/40">action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-xs font-light hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-foreground">{addResult.keyword}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={`font-mono text-[11px] ${addResult.score >= 60 ? "text-emerald-600" : addResult.score >= 30 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {addResult.score}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{addResult.search_volume.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">${addResult.cpc.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{addResult.keyword_difficulty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{(addResult.competition * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[11px]">{addResult.search_intent}</td>
                  <td className="px-3 py-2.5">
                    {savedKeywordSet.has(addResult.keyword.toLowerCase()) ? (
                      <span className="text-[10px] text-muted-foreground">already saved</span>
                    ) : (
                      <button
                        onClick={saveManualKeyword}
                        disabled={addSaving}
                        className="px-2.5 py-1 text-[10px] font-light rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
                      >
                        {addSaving ? "saving..." : "add to core keywords"}
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Trigger panel ── */}
      <div className="border border-border rounded-md p-5">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
              industry
            </label>
            <p className="text-xs font-light text-muted-foreground px-3 py-2 border border-border/50 rounded-md bg-muted/30">
              {industryName || "not set — add NEXT_PUBLIC_INDUSTRY_NAME to .env.local"}
            </p>
          </div>
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
              seed concept
            </label>
            <input
              type="text"
              value={seedConcept}
              onChange={(e) => setSeedConcept(e.target.value)}
              placeholder="e.g. small business loans"
              onKeyDown={(e) => e.key === "Enter" && runResearch()}
              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
            />
          </div>
          <button
            onClick={runResearch}
            disabled={loading || !seedConcept.trim()}
            className="px-3 py-2 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "running sweep..." : "run research sweep"}
          </button>
        </div>
        {error && <p className="mt-3 text-xs font-light text-red-500">{error}</p>}
      </div>

      {/* Results */}
      {keywords.length > 0 && (
        <div className="space-y-6">
          {isMock && (
            <div className="border border-amber-200 bg-amber-50 rounded-md px-4 py-2">
              <p className="text-xs font-light text-amber-700">
                [mock data — API unavailable] showing example keywords for demonstration.
              </p>
            </div>
          )}

          {/* Keyword table */}
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                keyword suggestions ({keywords.length})
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setDraftWeights(weights); setWeightsOpen(true); }}
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-light rounded border border-border hover:bg-muted"
                >
                  <SlidersHorizontal size={10} />
                  score weights
                </button>
                <span className="text-xs font-light text-muted-foreground">{selected.size} selected</span>
                {saveMessage && <span className="text-xs font-light text-muted-foreground">{saveMessage}</span>}
                <button
                  onClick={saveSelected}
                  disabled={saving || selected.size === 0}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                >
                  {saving ? "saving..." : "save selected core keywords"}
                </button>
              </div>
            </div>

            {/* Band 1: top 20 — always visible */}
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full">
                <KeywordTableHeader />
                <tbody>
                  {band1.map((kw) => (
                    <KeywordRow
                      key={kw.suggested_id}
                      keyword={kw.keyword}
                      searchVolume={kw.search_volume}
                      cpc={kw.cpc}
                      keywordDifficulty={kw.keyword_difficulty}
                      trend={kw.trend}
                      suggestedId={kw.suggested_id}
                      checked={selected.has(kw.suggested_id)}
                      disabled={savedKeywordSet.has(kw.keyword.toLowerCase())}
                      savedLabel={savedKeywordSet.has(kw.keyword.toLowerCase()) ? "saved" : undefined}
                      onToggle={() => toggleKeyword(kw.suggested_id)}
                      competition={kw.competition}
                      competitionLevel={kw.competition_level}
                      searchIntent={kw.search_intent}
                      cps={kw.cps}
                      score={kw.score}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Band 2: 21–100 — collapsible */}
            {band2.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setBand2Open((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {band2Open ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
                    <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                      results 21–{Math.min(100, sortedKeywords.length)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{band2.length} keywords</span>
                  </div>
                </button>
                {band2Open && (
                  <div className="border-t border-border/50">
                    <table className="w-full">
                      <KeywordTableHeader />
                      <tbody>
                        {band2.map((kw) => (
                          <KeywordRow
                            key={kw.suggested_id}
                            keyword={kw.keyword}
                            searchVolume={kw.search_volume}
                            cpc={kw.cpc}
                            keywordDifficulty={kw.keyword_difficulty}
                            trend={kw.trend}
                            suggestedId={kw.suggested_id}
                            checked={selected.has(kw.suggested_id)}
                            disabled={savedKeywordSet.has(kw.keyword.toLowerCase())}
                            savedLabel={savedKeywordSet.has(kw.keyword.toLowerCase()) ? "saved" : undefined}
                            onToggle={() => toggleKeyword(kw.suggested_id)}
                            competition={kw.competition}
                            competitionLevel={kw.competition_level}
                            searchIntent={kw.search_intent}
                            cps={kw.cps}
                            score={kw.score}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Band 3: 101+ — collapsible */}
            {band3.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setBand3Open((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {band3Open ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
                    <p className="text-[10px] tracking-widest uppercase text-foreground/40">
                      results 101–{sortedKeywords.length}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{band3.length} keywords</span>
                  </div>
                </button>
                {band3Open && (
                  <div className="border-t border-border/50">
                    <table className="w-full">
                      <KeywordTableHeader />
                      <tbody>
                        {band3.map((kw) => (
                          <KeywordRow
                            key={kw.suggested_id}
                            keyword={kw.keyword}
                            searchVolume={kw.search_volume}
                            cpc={kw.cpc}
                            keywordDifficulty={kw.keyword_difficulty}
                            trend={kw.trend}
                            suggestedId={kw.suggested_id}
                            checked={selected.has(kw.suggested_id)}
                            disabled={savedKeywordSet.has(kw.keyword.toLowerCase())}
                            savedLabel={savedKeywordSet.has(kw.keyword.toLowerCase()) ? "saved" : undefined}
                            onToggle={() => toggleKeyword(kw.suggested_id)}
                            competition={kw.competition}
                            competitionLevel={kw.competition_level}
                            searchIntent={kw.search_intent}
                            cps={kw.cps}
                            score={kw.score}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              score = normalized blend of volume, cpc, kd (inverse), competition (inverse) · weights adjustable via &ldquo;score weights&rdquo; · top 5 pre-selected
            </p>
          </div>

          {/* Competitors */}
          {competitors.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setCompetitorsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {competitorsOpen ? <ChevronDown size={13} className="text-foreground/40" /> : <ChevronRight size={13} className="text-foreground/40" />}
                  <p className="text-[10px] tracking-widest uppercase text-foreground/40">competitor domains</p>
                  <span className="text-[10px] text-muted-foreground">{competitors.length} domains</span>
                </div>
              </button>
              {competitorsOpen && (
                <div className="border-t border-border/50">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        {["domain", "est. traffic", "avg position", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-widest text-foreground/40">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {competitors.map((c) => (
                        <tr key={c.domain} className="border-b border-border/20 last:border-0 text-xs font-light hover:bg-muted/30">
                          <td className="px-3 py-2 text-foreground">{c.domain}</td>
                          <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.estimated_traffic.toLocaleString()}</td>
                          <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.avg_position.toFixed(1)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => importCompetitor(c.domain)}
                              disabled={importingDomain === c.domain}
                              className="px-2 py-1 text-[10px] font-light rounded border border-border hover:bg-muted disabled:opacity-50"
                            >
                              {importingDomain === c.domain ? "adding..." : "add to resources"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* Score Weights Modal */}
      {weightsOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-md p-6 w-96 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-light">score weights</h3>
              <button onClick={() => setWeightsOpen(false)}>
                <X size={14} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground mb-5 leading-relaxed">
              the opportunity score is a weighted blend of four normalized factors. adjust weights below — they must sum to 100. the table re-sorts and top 5 are re-selected when you apply.
            </p>

            <div className="space-y-4">
              {(
                [
                  { key: "volume" as const, label: "search volume", desc: "higher is better" },
                  { key: "cpc" as const, label: "cpc", desc: "higher = more commercial intent" },
                  { key: "kd" as const, label: "keyword difficulty (inverse)", desc: "lower kd scores higher" },
                  { key: "competition" as const, label: "competition (inverse)", desc: "lower competition scores higher" },
                ] as const
              ).map(({ key, label, desc }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-light text-foreground">{label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{desc}</span>
                    </div>
                    <span className="text-xs font-light tabular-nums w-10 text-right">{draftWeights[key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={draftWeights[key]}
                    onChange={(e) =>
                      setDraftWeights((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))
                    }
                    className="w-full h-1 accent-foreground"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className={`text-xs font-light ${weightTotal === 100 ? "text-emerald-600" : "text-red-500"}`}>
                total: {weightTotal}% {weightTotal !== 100 && "(must equal 100)"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDraftWeights(DEFAULT_WEIGHTS)}
                  className="px-2 py-1 text-[10px] font-light rounded border border-border hover:bg-muted"
                >
                  reset
                </button>
                <button
                  onClick={applyWeights}
                  disabled={weightTotal !== 100}
                  className="px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
                >
                  apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
