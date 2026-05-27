import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/article-reassign
 * Updates an article's core_id and bridge_id, then re-assigns its skeleton
 * to the first available cluster under the new bridge keyword.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { article_db_id, core_id, bridge_id } = await request.json();

    if (!article_db_id || !core_id || !bridge_id) {
      return NextResponse.json(
        { error: "article_db_id, core_id, and bridge_id are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 1. Fetch the article to get its skeleton_id
    const { data: article, error: articleFetchError } = await supabase
      .from("articles")
      .select("id, skeleton_id, core_id, bridge_id")
      .eq("id", article_db_id)
      .single();

    if (articleFetchError || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // 2. Update the article's core_id and bridge_id
    const { error: articleUpdateError } = await supabase
      .from("articles")
      .update({ core_id, bridge_id })
      .eq("id", article_db_id);

    if (articleUpdateError) {
      return NextResponse.json({ error: articleUpdateError.message }, { status: 500 });
    }

    let newClusterDbId: string | null = null;
    let newClusterDisplayName: string | null = null;

    // 3. If the article has a skeleton, reassign it to the right cluster
    if (article.skeleton_id) {
      // Find the bridge_keyword record for new core_id + bridge_id
      const { data: bridgeKw } = await supabase
        .from("bridge_keywords")
        .select("id, bridge_id, core_keyword_id, core_keywords!inner(core_id)")
        .eq("bridge_id", bridge_id)
        .eq("core_keywords.core_id", core_id)
        .maybeSingle();

      if (bridgeKw) {
        // Find the first cluster for that bridge keyword
        const { data: cluster } = await supabase
          .from("clusters")
          .select("id, cluster_id, display_name")
          .eq("bridge_keyword_id", bridgeKw.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const newClusterId = cluster?.id ?? null;
        newClusterDbId = newClusterId;
        newClusterDisplayName = cluster?.display_name ?? null;

        // Update the skeleton's cluster_id
        const { error: skeletonUpdateError } = await supabase
          .from("article_skeletons")
          .update({ cluster_id: newClusterId })
          .eq("id", article.skeleton_id);

        if (skeletonUpdateError) {
          return NextResponse.json({ error: skeletonUpdateError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      new_cluster_db_id: newClusterDbId,
      new_cluster_display_name: newClusterDisplayName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
