import { createServiceClient as createClient } from "@/lib/supabase/server";
import BridgesClient from "./BridgesClient";

export const dynamic = "force-dynamic";

export default async function BridgesPage() {
  let coreKeywords: Array<{
    id: string;
    keyword: string;
    core_id: string;
    search_volume: number | null;
  }> = [];

  let savedBridges: Array<{
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
  }> = [];

  try {
    const supabase = createClient();
    const [coresRes, bridgesRes] = await Promise.all([
      supabase
        .from("core_keywords")
        .select("id, keyword, core_id, search_volume")
        .order("keyword"),
      supabase
        .from("bridge_keywords")
        .select("id, keyword, bridge_id, core_keyword_id, search_volume, cpc, keyword_difficulty, trend_data, competition, competition_level, search_intent, cps, meta_title, meta_description, description"),
    ]);
    coreKeywords = coresRes.data ?? [];
    savedBridges = bridgesRes.data ?? [];
  } catch (e) {
    console.error("[bridges page] DB error:", e);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          function b
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">bridge keywords</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          bridge keyword selection — 10–15 per core keyword
        </p>
      </div>
      <BridgesClient coreKeywords={coreKeywords} savedBridges={savedBridges} />
    </div>
  );
}
