import { createServiceClient as createClient } from "@/lib/supabase/server";
import SkeletonsClient from "./SkeletonsClient";
import { defaultConfig, PromptConfig, SKELETON_SETTINGS_KEY } from "@/lib/promptTemplates";

export const dynamic = "force-dynamic";

export default async function SkeletonsPage() {
  let coreKeywords: Array<{
    id: string;
    keyword: string;
    core_id: string;
    bridge_keywords: Array<{
      id: string;
      keyword: string;
      bridge_id: string;
      clusters: Array<{
        id: string;
        cluster_id: string;
        display_name: string;
      }>;
    }>;
  }> = [];

  let resources: Array<{ url: string | null; title: string | null; notes: string | null }> = [];
  let promptConfig: PromptConfig = defaultConfig();
  let clustersWithBriefs: string[] = [];

  try {
    const supabase = createClient();
    const [coresRes, resourcesRes, settingsRes] = await Promise.all([
      supabase
        .from("core_keywords")
        .select(`
          id, keyword, core_id,
          bridge_keywords(
            id, keyword, bridge_id,
            clusters(id, cluster_id, display_name)
          )
        `)
        .order("keyword"),
      supabase.from("resources").select("url, title, notes").limit(10),
      supabase.from("settings").select("value").eq("key", SKELETON_SETTINGS_KEY).maybeSingle(),
    ]);
    coreKeywords = (coresRes.data ?? []) as typeof coreKeywords;
    resources = resourcesRes.data ?? [];
    if (settingsRes.data?.value) {
      const saved = settingsRes.data.value as PromptConfig;
      promptConfig = { ...saved, typeAddons: { ...defaultConfig().typeAddons, ...saved.typeAddons } };
    }
    // Collect unique cluster DB-IDs that already have saved skeletons
    const { data: skeletonRows } = await supabase
      .from("article_skeletons")
      .select("cluster_id");
    clustersWithBriefs = Array.from(
      new Set((skeletonRows ?? []).map((s: { cluster_id: string }) => s.cluster_id).filter(Boolean))
    );
  } catch (e) {
    console.error("[skeletons page] DB error:", e);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          function c
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">cluster brief creation</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          generate and save article briefs for a cluster
        </p>
      </div>
      <SkeletonsClient
        coreKeywords={coreKeywords}
        resources={resources}
        industryName={process.env.NEXT_PUBLIC_INDUSTRY_NAME ?? ""}
        promptConfig={promptConfig}
        clustersWithBriefs={clustersWithBriefs}
      />
    </div>
  );
}
