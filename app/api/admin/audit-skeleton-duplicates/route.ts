import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface DuplicateGroup {
  cluster_id: string;
  cluster_display_name: string | null;
  content_type: string;
  count: number;
  skeletons: Array<{
    id: string;
    article_id: string;
    slug: string;
    created_at: string;
    has_article: boolean;
  }>;
}

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Find all (cluster_id, content_type) pairs with more than one skeleton
    const { data: skeletons, error } = await supabase
      .from("article_skeletons")
      .select("id, article_id, cluster_id, content_type, slug, created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by (cluster_id, content_type) and keep groups with count > 1
    const groupMap = new Map<string, typeof skeletons>();
    for (const s of skeletons ?? []) {
      const key = `${s.cluster_id}__${s.content_type}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(s);
    }

    const duplicateKeys = [...groupMap.entries()].filter(([, rows]) => rows.length > 1);

    if (duplicateKeys.length === 0) {
      return NextResponse.json({ duplicate_groups: 0, groups: [] });
    }

    // Fetch cluster display names
    const clusterIds = [...new Set(duplicateKeys.map(([, rows]) => rows[0].cluster_id))];
    const { data: clusters } = await supabase
      .from("clusters")
      .select("id, display_name")
      .in("id", clusterIds);

    const clusterNameMap = new Map((clusters ?? []).map((c) => [c.id, c.display_name]));

    // Check which skeletons have a generated article referencing them
    const allSkeletonIds = duplicateKeys.flatMap(([, rows]) => rows.map((r) => r.id));
    const { data: articles } = await supabase
      .from("articles")
      .select("skeleton_id")
      .in("skeleton_id", allSkeletonIds);

    const skeletonIdsWithArticle = new Set((articles ?? []).map((a) => a.skeleton_id));

    const groups: DuplicateGroup[] = duplicateKeys.map(([, rows]) => ({
      cluster_id: rows[0].cluster_id,
      cluster_display_name: clusterNameMap.get(rows[0].cluster_id) ?? null,
      content_type: rows[0].content_type,
      count: rows.length,
      // Already sorted newest-first because we ordered by created_at desc above
      skeletons: rows.map((r) => ({
        id: r.id,
        article_id: r.article_id,
        slug: r.slug,
        created_at: r.created_at,
        has_article: skeletonIdsWithArticle.has(r.id),
      })),
    }));

    return NextResponse.json({ duplicate_groups: groups.length, groups });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

// DELETE: remove all but the newest skeleton for a given (cluster_id, content_type) pair.
// Articles referencing deleted skeletons are cascade-deleted via FK.
export async function DELETE(request: NextRequest) {
  try {
    const { cluster_id, content_type } = await request.json();
    if (!cluster_id || !content_type) {
      return NextResponse.json({ error: "cluster_id and content_type required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: rows, error: fetchError } = await supabase
      .from("article_skeletons")
      .select("id, created_at")
      .eq("cluster_id", cluster_id)
      .eq("content_type", content_type)
      .order("created_at", { ascending: false });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ deleted: 0, message: "no duplicates to remove" });
    }

    // Keep the first (newest); delete the rest
    const toDelete = rows.slice(1).map((r) => r.id);
    const { error: delError } = await supabase
      .from("article_skeletons")
      .delete()
      .in("id", toDelete);

    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    return NextResponse.json({ deleted: toDelete.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
