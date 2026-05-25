import { createServiceClient as createClient } from "@/lib/supabase/server";
import ClustersClient from "./ClustersClient";

export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  let coreKeywords: Array<{
    id: string;
    keyword: string;
    core_id: string;
    meta_title: string | null;
    meta_description: string | null;
    description: string | null;
    bridge_keywords: Array<{
      id: string;
      keyword: string;
      bridge_id: string;
      clusters: Array<{
        id: string;
        cluster_id: string;
        display_name: string;
        status: string;
        link_health: string;
      }>;
    }>;
  }> = [];

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("core_keywords")
      .select(`
        id, keyword, core_id, meta_title, meta_description, description,
        bridge_keywords(
          id, keyword, bridge_id,
          clusters(id, cluster_id, display_name, status, link_health)
        )
      `)
      .order("keyword");
    coreKeywords = (data ?? []) as typeof coreKeywords;
  } catch (e) {
    console.error("[clusters page] DB error:", e);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          content hierarchy
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">clusters</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          view and manage all clusters grouped by core → bridge
        </p>
      </div>
      <ClustersClient coreKeywords={coreKeywords} />
    </div>
  );
}
