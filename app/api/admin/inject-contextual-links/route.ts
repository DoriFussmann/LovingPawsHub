import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { injectInternalLinks } from "@/lib/linkwire";
import { revalidatePath } from "next/cache";

export const maxDuration = 120;

const MAX_INLINE_LINKS = 4;

interface ClusterArticle {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  body_markdown: string;
  link_status: string;
  internal_links_injected: Array<{
    anchor_phrase: string;
    target_slug: string;
    found: boolean;
    target_url?: string;
  }> | null;
}

/**
 * GET /api/admin/inject-contextual-links?cluster_id=xxx
 *
 * Returns:
 *  - Suggested keyword→slug pairs from article_skeletons.internal_link_targets for this cluster
 *  - Current inline link counts per article
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clusterId = searchParams.get("cluster_id");

    if (!clusterId) {
      return NextResponse.json({ error: "cluster_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get skeletons for this cluster and their internal_link_targets
    const { data: skeletons, error: skelError } = await supabase
      .from("article_skeletons")
      .select("id, article_id, slug, internal_link_targets")
      .eq("cluster_id", clusterId);

    if (skelError) return NextResponse.json({ error: skelError.message }, { status: 500 });

    const skeletonIds = (skeletons ?? []).map((s: { id: string }) => s.id);
    if (skeletonIds.length === 0) {
      return NextResponse.json({ error: "no skeletons found for cluster" }, { status: 404 });
    }

    // Get published articles for this cluster
    const { data: articles, error: artError } = await supabase
      .from("articles")
      .select("article_id, h1_title, slug, core_id, bridge_id, internal_links_injected")
      .in("skeleton_id", skeletonIds)
      .eq("status", "published");

    if (artError) return NextResponse.json({ error: artError.message }, { status: 500 });

    // Build slug→article map for resolving target_slug references
    const slugToArticle = new Map(
      (articles ?? []).map((a: { slug: string; core_id: string; bridge_id: string }) => [
        a.slug,
        { core_id: a.core_id, bridge_id: a.bridge_id },
      ])
    );

    // Aggregate suggested pairs from all skeleton internal_link_targets
    const suggestedPairs: Array<{
      keyword: string;
      target_slug: string;
      target_url: string | null;
      source_article_id: string;
    }> = [];

    for (const skeleton of skeletons ?? []) {
      const targets = skeleton.internal_link_targets as Array<{
        anchor_phrase: string;
        slug: string;
        article_id: string;
        direction?: string;
      }> | null;

      for (const t of targets ?? []) {
        if (!t.anchor_phrase || !t.slug) continue;
        const targetInfo = slugToArticle.get(t.slug);
        suggestedPairs.push({
          keyword: t.anchor_phrase,
          target_slug: t.slug,
          target_url: targetInfo
            ? `/${targetInfo.core_id}/${targetInfo.bridge_id}/${t.slug}/`
            : null,
          source_article_id: skeleton.article_id,
        });
      }
    }

    // Deduplicate by keyword+target_slug
    const seen = new Set<string>();
    const uniquePairs = suggestedPairs.filter((p) => {
      const key = `${p.keyword}|${p.target_slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Per-article current link counts
    const articleSummary = (articles ?? []).map((a) => ({
      article_id: a.article_id,
      h1_title: a.h1_title,
      slug: a.slug,
      current_inline_links: (a.internal_links_injected ?? []).filter((l: { found?: boolean }) => l.found).length,
      remaining_capacity: Math.max(
        0,
        MAX_INLINE_LINKS - (a.internal_links_injected ?? []).filter((l: { found?: boolean }) => l.found).length
      ),
    }));

    return NextResponse.json({
      cluster_id: clusterId,
      suggested_pairs: uniquePairs,
      articles: articleSummary,
      max_inline_links: MAX_INLINE_LINKS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/inject-contextual-links
 * Body: { cluster_id, pairs: [{keyword, target_slug}][], dry_run?: boolean }
 *
 * For each article in the cluster:
 *  - Adds new entries to internal_links_injected (deduped, up to MAX cap)
 *  - Calls injectInternalLinks to find and replace them in body_markdown
 *  - Writes updated body and link status back to DB
 */
export async function POST(request: NextRequest) {
  try {
    const { cluster_id, pairs, dry_run } = await request.json() as {
      cluster_id: string;
      pairs: Array<{ keyword: string; target_slug: string }>;
      dry_run?: boolean;
    };

    if (!cluster_id) {
      return NextResponse.json({ error: "cluster_id required" }, { status: 400 });
    }
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({ error: "pairs array required" }, { status: 400 });
    }

    // Validate pairs
    const validPairs = pairs.filter((p) => p.keyword?.trim() && p.target_slug?.trim());
    if (validPairs.length === 0) {
      return NextResponse.json({ error: "no valid pairs (each needs keyword and target_slug)" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch skeletons → articles
    const { data: skeletons } = await supabase
      .from("article_skeletons")
      .select("id")
      .eq("cluster_id", cluster_id);

    const skeletonIds = (skeletons ?? []).map((s: { id: string }) => s.id);
    if (skeletonIds.length === 0) {
      return NextResponse.json({ error: "no skeletons found for cluster" }, { status: 404 });
    }

    const { data: rawArticles, error: artError } = await supabase
      .from("articles")
      .select("id, article_id, h1_title, slug, core_id, bridge_id, body_markdown, link_status, internal_links_injected")
      .in("skeleton_id", skeletonIds)
      .eq("status", "published");

    if (artError) return NextResponse.json({ error: artError.message }, { status: 500 });

    const articles = (rawArticles ?? []) as ClusterArticle[];

    if (articles.length === 0) {
      return NextResponse.json({ error: "no published articles found in cluster" }, { status: 404 });
    }

    const results: Array<{
      article_id: string;
      slug: string;
      pairs_added: number;
      links_injected: number;
      skipped_self_link: number;
      skipped_cap: number;
      dry_run: boolean;
    }> = [];

    for (const article of articles) {
      const existingLinks = article.internal_links_injected ?? [];
      const existingSlugs = new Set(existingLinks.map((l) => l.target_slug));
      const existingKeywords = new Set(
        existingLinks.map((l) => l.anchor_phrase.toLowerCase())
      );
      const currentFoundCount = existingLinks.filter((l) => l.found).length;

      const newEntries: Array<{ anchor_phrase: string; target_slug: string; found: boolean }> = [];
      let skippedSelf = 0;
      let skippedCap = 0;

      for (const pair of validPairs) {
        // Skip self-links
        if (pair.target_slug === article.slug) {
          skippedSelf++;
          continue;
        }
        // Skip already-present slug
        if (existingSlugs.has(pair.target_slug)) continue;
        // Skip duplicate keyword (one link per keyword per article)
        if (existingKeywords.has(pair.keyword.toLowerCase())) continue;
        // Respect cap (count existing found + new entries)
        if (currentFoundCount + newEntries.length >= MAX_INLINE_LINKS) {
          skippedCap++;
          continue;
        }

        newEntries.push({
          anchor_phrase: pair.keyword,
          target_slug: pair.target_slug,
          found: false,
        });
        existingKeywords.add(pair.keyword.toLowerCase());
      }

      if (newEntries.length === 0) {
        results.push({
          article_id: article.article_id,
          slug: article.slug,
          pairs_added: 0,
          links_injected: 0,
          skipped_self_link: skippedSelf,
          skipped_cap: skippedCap,
          dry_run: dry_run ?? false,
        });
        continue;
      }

      const mergedLinks = [...existingLinks, ...newEntries];

      if (dry_run) {
        results.push({
          article_id: article.article_id,
          slug: article.slug,
          pairs_added: newEntries.length,
          links_injected: 0,
          skipped_self_link: skippedSelf,
          skipped_cap: skippedCap,
          dry_run: true,
        });
        continue;
      }

      // Run injection
      const wired = await injectInternalLinks(
        { ...article, internal_links_injected: mergedLinks },
        supabase,
        MAX_INLINE_LINKS
      );

      const injectedCount = (
        wired.internal_links_injected as Array<{ found: boolean; anchor_phrase: string }>
      ).filter((l) => l.found && newEntries.some((e) => e.anchor_phrase === l.anchor_phrase)).length;

      await supabase
        .from("articles")
        .update({
          body_markdown: wired.body_markdown,
          internal_links_injected: wired.internal_links_injected,
          link_status: wired.link_status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);

      revalidatePath(`/${article.core_id}/${article.bridge_id}/${article.slug}`);

      results.push({
        article_id: article.article_id,
        slug: article.slug,
        pairs_added: newEntries.length,
        links_injected: injectedCount,
        skipped_self_link: skippedSelf,
        skipped_cap: skippedCap,
        dry_run: false,
      });
    }

    return NextResponse.json({
      cluster_id,
      dry_run: dry_run ?? false,
      articles_processed: results.length,
      total_pairs_added: results.reduce((s, r) => s + r.pairs_added, 0),
      total_links_injected: results.reduce((s, r) => s + r.links_injected, 0),
      results,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
