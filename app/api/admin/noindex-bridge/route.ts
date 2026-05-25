import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * GET /api/admin/noindex-bridge?bridge_id=xxx[&core_id=yyy]
 *
 * Returns a report of:
 *  - All published articles in the bridge (with their current robots_directive)
 *  - All articles on the site that have inbound internal links pointing to slugs in this bridge
 *
 * Use this to assess link equity before noindexing.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bridgeId = searchParams.get("bridge_id");
    const coreId = searchParams.get("core_id");

    if (!bridgeId) {
      return NextResponse.json({ error: "bridge_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch all published articles in the target bridge
    let query = supabase
      .from("articles")
      .select("article_id, h1_title, slug, core_id, bridge_id, robots_directive, published_at")
      .eq("bridge_id", bridgeId)
      .eq("status", "published");

    if (coreId) query = query.eq("core_id", coreId);

    const { data: bridgeArticles, error: bridgeError } = await query;
    if (bridgeError) return NextResponse.json({ error: bridgeError.message }, { status: 500 });

    const targetSlugs = new Set((bridgeArticles ?? []).map((a) => a.slug));

    if (targetSlugs.size === 0) {
      return NextResponse.json({
        bridge_id: bridgeId,
        core_id: coreId ?? null,
        articles_in_bridge: [],
        inbound_links: [],
        safe_to_noindex: true,
      });
    }

    // Find all published articles that link to any slug in this bridge
    const { data: allArticles, error: allError } = await supabase
      .from("articles")
      .select("article_id, h1_title, slug, core_id, bridge_id, internal_links_injected")
      .eq("status", "published")
      .not("bridge_id", "eq", bridgeId); // exclude the bridge itself

    if (allError) return NextResponse.json({ error: allError.message }, { status: 500 });

    type InboundLink = {
      source_article_id: string;
      source_title: string;
      source_url: string;
      links_to: string[];
    };

    const inboundLinks: InboundLink[] = [];

    for (const article of allArticles ?? []) {
      const hits = (article.internal_links_injected ?? [])
        .filter(
          (l: { target_slug: string; found: boolean }) =>
            l.found && targetSlugs.has(l.target_slug)
        )
        .map((l: { target_slug: string }) => l.target_slug);

      if (hits.length > 0) {
        inboundLinks.push({
          source_article_id: article.article_id,
          source_title: article.h1_title,
          source_url: `/${article.core_id}/${article.bridge_id}/${article.slug}/`,
          links_to: hits,
        });
      }
    }

    return NextResponse.json({
      bridge_id: bridgeId,
      core_id: coreId ?? null,
      articles_in_bridge: (bridgeArticles ?? []).map((a) => ({
        article_id: a.article_id,
        h1_title: a.h1_title,
        url: `/${a.core_id}/${a.bridge_id}/${a.slug}/`,
        robots_directive: a.robots_directive ?? "index, follow",
        published_at: a.published_at,
      })),
      inbound_links: inboundLinks,
      safe_to_noindex: inboundLinks.length === 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/noindex-bridge
 * Body: { bridge_id, core_id?, confirmed: boolean }
 *
 * Without confirmed:true, returns the same report as GET (dry run).
 * With confirmed:true, sets robots_directive = 'noindex, follow' on all
 * published articles in the bridge.
 */
export async function POST(request: NextRequest) {
  try {
    const { bridge_id, core_id, confirmed } = await request.json();

    if (!bridge_id) {
      return NextResponse.json({ error: "bridge_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Always fetch the bridge articles first
    let query = supabase
      .from("articles")
      .select("id, article_id, h1_title, slug, core_id, bridge_id, robots_directive")
      .eq("bridge_id", bridge_id)
      .eq("status", "published");

    if (core_id) query = query.eq("core_id", core_id);

    const { data: bridgeArticles, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!confirmed) {
      return NextResponse.json({
        dry_run: true,
        bridge_id,
        core_id: core_id ?? null,
        would_noindex: (bridgeArticles ?? []).map((a) => ({
          article_id: a.article_id,
          h1_title: a.h1_title,
          url: `/${a.core_id}/${a.bridge_id}/${a.slug}/`,
          current_directive: a.robots_directive ?? "index, follow",
        })),
        message: 'Send confirmed:true to proceed.',
      });
    }

    // Apply noindex
    const ids = (bridgeArticles ?? []).map((a) => a.id);
    if (ids.length === 0) {
      return NextResponse.json({
        bridge_id,
        updated: 0,
        message: "no published articles found in this bridge",
      });
    }

    const { error: updateError } = await supabase
      .from("articles")
      .update({
        robots_directive: "noindex, follow",
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      bridge_id,
      core_id: core_id ?? null,
      updated: ids.length,
      noindexed: (bridgeArticles ?? []).map((a) => ({
        article_id: a.article_id,
        url: `/${a.core_id}/${a.bridge_id}/${a.slug}/`,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
