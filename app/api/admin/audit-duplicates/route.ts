import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

interface ArticleRow {
  article_id: string;
  h1_title: string;
  meta_title: string | null;
  primary_keyword: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  canonical_url: string | null;
  redirect_to: string | null;
  internal_links_injected: Array<{ anchor_phrase: string; target_slug: string; found: boolean }> | null;
  published_at: string | null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: articles, error } = await supabase
      .from("articles")
      .select(
        "article_id, h1_title, meta_title, primary_keyword, slug, core_id, bridge_id, canonical_url, redirect_to, internal_links_injected, published_at"
      )
      .eq("status", "published")
      .order("primary_keyword");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (articles ?? []) as ArticleRow[];

    // Group by normalized primary_keyword
    const keywordMap = new Map<string, ArticleRow[]>();
    for (const row of rows) {
      const key = normalize(row.primary_keyword);
      if (!keywordMap.has(key)) keywordMap.set(key, []);
      keywordMap.get(key)!.push(row);
    }

    // Also group by normalized meta_title/h1_title to catch near-duplicates
    const titleMap = new Map<string, ArticleRow[]>();
    for (const row of rows) {
      const key = normalize(row.meta_title || row.h1_title);
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(row);
    }

    type DuplicateGroup = {
      match_type: "keyword" | "title";
      matched_value: string;
      articles: Array<{
        article_id: string;
        h1_title: string;
        url: string;
        inbound_link_count: number;
        canonical_url: string | null;
        redirect_to: string | null;
        published_at: string | null;
        recommendation: "canonical_target" | "canonical_source" | "redirect_source";
      }>;
    };

    const groups: DuplicateGroup[] = [];

    // Compute inbound link counts across all articles once
    const inboundCounts = new Map<string, number>();
    for (const row of rows) {
      for (const link of row.internal_links_injected ?? []) {
        if (link.found) {
          inboundCounts.set(link.target_slug, (inboundCounts.get(link.target_slug) ?? 0) + 1);
        }
      }
    }

    function buildGroup(
      matchType: "keyword" | "title",
      matchedValue: string,
      dupes: ArticleRow[]
    ): DuplicateGroup {
      const withCounts = dupes.map((a) => ({
        article_id: a.article_id,
        h1_title: a.h1_title,
        url: `/${a.core_id}/${a.bridge_id}/${a.slug}/`,
        inbound_link_count: inboundCounts.get(a.slug) ?? 0,
        canonical_url: a.canonical_url,
        redirect_to: a.redirect_to,
        published_at: a.published_at,
      }));

      // The article with the most inbound links is the canonical target
      const maxLinks = Math.max(...withCounts.map((a) => a.inbound_link_count));

      return {
        match_type: matchType,
        matched_value: matchedValue,
        articles: withCounts.map((a) => ({
          ...a,
          recommendation:
            a.inbound_link_count === maxLinks && maxLinks > 0
              ? "canonical_target"
              : a.redirect_to
              ? "redirect_source"
              : "canonical_source",
        })),
      };
    }

    const seenGroups = new Set<string>();

    for (const [key, dupes] of keywordMap) {
      if (dupes.length > 1) {
        const groupKey = dupes.map((d) => d.article_id).sort().join("|");
        if (!seenGroups.has(groupKey)) {
          seenGroups.add(groupKey);
          groups.push(buildGroup("keyword", key, dupes));
        }
      }
    }

    for (const [key, dupes] of titleMap) {
      if (dupes.length > 1) {
        const groupKey = dupes.map((d) => d.article_id).sort().join("|");
        if (!seenGroups.has(groupKey)) {
          seenGroups.add(groupKey);
          groups.push(buildGroup("title", key, dupes));
        }
      }
    }

    return NextResponse.json({
      total_published: rows.length,
      duplicate_groups: groups.length,
      groups,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Set canonical_url or redirect_to on an article.
 * Body: { article_id, canonical_url?, redirect_to? }
 */
export async function POST(request: Request) {
  try {
    const { article_id, canonical_url, redirect_to } = await request.json();
    if (!article_id) {
      return NextResponse.json({ error: "article_id required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updates: Record<string, string | null> = {};
    if (canonical_url !== undefined) updates.canonical_url = canonical_url;
    if (redirect_to !== undefined) updates.redirect_to = redirect_to;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "canonical_url or redirect_to required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("articles")
      .update(updates)
      .eq("article_id", article_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, article_id, updates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
