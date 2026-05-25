import { createServiceClient as createClient } from "@/lib/supabase/server";
import ResearchClient from "./ResearchClient";
import { DEFAULT_SCORING_WEIGHTS, SCORING_WEIGHTS_KEY, type ScoringWeights } from "@/components/admin/ScoringWeightsModal";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  let savedCoreKeywords: Array<{
    id: string;
    keyword: string;
    core_id: string;
    search_volume: number | null;
    cpc: number | null;
    keyword_difficulty: number | null;
    trend_data: number[] | null;
  }> = [];

  let industryId: string | null = null;
  let scoringWeights: ScoringWeights = DEFAULT_SCORING_WEIGHTS;

  try {
    const supabase = createClient();
    const [coresRes, industryRes, weightsRes] = await Promise.all([
      supabase
        .from("core_keywords")
        .select("id, keyword, core_id, search_volume, cpc, keyword_difficulty, trend_data")
        .order("created_at", { ascending: false }),
      supabase.from("industry").select("id").limit(1).single(),
      supabase.from("settings").select("value").eq("key", SCORING_WEIGHTS_KEY).maybeSingle(),
    ]);
    if (coresRes.error) console.error("[research page] core_keywords:", coresRes.error.message);
    if (industryRes.error) console.error("[research page] industry:", industryRes.error.message);
    savedCoreKeywords = coresRes.data ?? [];
    industryId = industryRes.data?.id ?? null;
    if (weightsRes.data?.value) scoringWeights = weightsRes.data.value as ScoringWeights;
  } catch (e) {
    console.error("[research page] DB error:", e);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          function a
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">core keywords</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          keyword research & competitor discovery
        </p>
      </div>
      <ResearchClient
        savedCoreKeywords={savedCoreKeywords}
        industryId={industryId}
        industryName={process.env.NEXT_PUBLIC_INDUSTRY_NAME ?? ""}
        initialWeights={scoringWeights}
      />
    </div>
  );
}
