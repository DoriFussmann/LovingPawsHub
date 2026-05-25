import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const maxDuration = 60;

const READ_MORE_HEADER = "**Read more:**";

/**
 * Parse all markdown links from a text block.
 * Returns [{text, href}] in order of appearance.
 */
function parseMarkdownLinks(text: string): Array<{ text: string; href: string }> {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const results: Array<{ text: string; href: string }> = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({ text: match[1], href: match[2] });
  }
  return results;
}

/**
 * Extract the index of "**Read more:**" in the body and the section that follows it.
 */
function findReadMoreSection(body: string): { start: number; section: string } | null {
  const idx = body.indexOf(READ_MORE_HEADER);
  if (idx === -1) return null;
  return { start: idx, section: body.slice(idx) };
}

/**
 * For a single article body:
 * 1. Find the Read more section.
 * 2. Collect all links in the rest of the body (before the Read more block).
 * 3. Deduplicate Read more links — remove any whose href already appears in the body text
 *    above OR appears more than once in the Read more list itself.
 * Returns the cleaned body and a report of how many links were removed.
 */
function cleanReadMore(body: string): { body: string; removed: number; total_before: number } {
  const rm = findReadMoreSection(body);
  if (!rm) return { body, removed: 0, total_before: 0 };

  const bodyAbove = body.slice(0, rm.start);
  const linksAbove = parseMarkdownLinks(bodyAbove);
  const hrefsAbove = new Set(linksAbove.map((l) => l.href));

  // Split Read more section into lines, process each link line
  const rmSection = rm.section;
  const lines = rmSection.split("\n");
  const seenHrefs = new Set<string>();
  const cleanedLines: string[] = [];
  let removed = 0;

  for (const line of lines) {
    const links = parseMarkdownLinks(line);
    if (links.length === 0) {
      // Non-link line (header, separator, blank) — always keep
      cleanedLines.push(line);
      continue;
    }

    // Line has a link — check for duplicates
    let isDuplicate = false;
    for (const link of links) {
      if (hrefsAbove.has(link.href) || seenHrefs.has(link.href)) {
        isDuplicate = true;
        break;
      }
      seenHrefs.add(link.href);
    }

    if (isDuplicate) {
      removed++;
    } else {
      cleanedLines.push(line);
    }
  }

  const cleanedSection = cleanedLines.join("\n");

  // If the entire Read more block is now empty (only header + separator remain), remove it
  const contentLines = cleanedLines.filter(
    (l) => l.trim() && l.trim() !== "---" && l.trim() !== READ_MORE_HEADER
  );
  const newBody =
    contentLines.length === 0
      ? bodyAbove.trimEnd()
      : bodyAbove + cleanedSection;

  return { body: newBody, removed, total_before: seenHrefs.size + removed };
}

/**
 * GET /api/admin/cleanup-readmore?article_id=xxx
 * Preview mode: returns what would be cleaned without writing.
 *
 * GET /api/admin/cleanup-readmore (no article_id)
 * Scans all published articles and returns a summary of which have duplicate Read more links.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("article_id");

    if (articleId) {
      const { data, error } = await supabase
        .from("articles")
        .select("article_id, h1_title, body_markdown, core_id, bridge_id, slug")
        .eq("article_id", articleId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "article not found" }, { status: 404 });
      }

      const result = cleanReadMore(data.body_markdown);
      return NextResponse.json({
        article_id: data.article_id,
        h1_title: data.h1_title,
        url: `/${data.core_id}/${data.bridge_id}/${data.slug}/`,
        has_read_more: findReadMoreSection(data.body_markdown) !== null,
        links_before: result.total_before,
        duplicates_found: result.removed,
        preview_body: result.removed > 0 ? result.body : null,
      });
    }

    // Scan all published articles
    const { data: articles, error } = await supabase
      .from("articles")
      .select("article_id, h1_title, body_markdown, core_id, bridge_id, slug")
      .eq("status", "published");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const report = (articles ?? [])
      .filter((a) => findReadMoreSection(a.body_markdown) !== null)
      .map((a) => {
        const result = cleanReadMore(a.body_markdown);
        return {
          article_id: a.article_id,
          h1_title: a.h1_title,
          url: `/${a.core_id}/${a.bridge_id}/${a.slug}/`,
          links_in_readmore: result.total_before,
          duplicates_found: result.removed,
        };
      })
      .filter((r) => r.duplicates_found > 0);

    return NextResponse.json({
      articles_with_read_more: (articles ?? []).filter(
        (a) => findReadMoreSection(a.body_markdown) !== null
      ).length,
      articles_with_duplicates: report.length,
      report,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cleanup-readmore
 * Body: { article_id } — clean a single article.
 * Body: { all: true } — clean all published articles with duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const { article_id, all } = await request.json();
    const supabase = createServiceClient();

    if (all) {
      const { data: articles, error } = await supabase
        .from("articles")
        .select("id, article_id, h1_title, body_markdown, core_id, bridge_id, slug")
        .eq("status", "published");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const results: Array<{
        article_id: string;
        removed: number;
        updated: boolean;
      }> = [];

      for (const article of articles ?? []) {
        if (!findReadMoreSection(article.body_markdown)) continue;
        const { body: cleaned, removed } = cleanReadMore(article.body_markdown);
        if (removed === 0) continue;

        await supabase
          .from("articles")
          .update({
            body_markdown: cleaned,
            updated_at: new Date().toISOString(),
          })
          .eq("id", article.id);

        revalidatePath(`/${article.core_id}/${article.bridge_id}/${article.slug}`);
        results.push({ article_id: article.article_id, removed, updated: true });
      }

      return NextResponse.json({
        updated: results.length,
        total_links_removed: results.reduce((s, r) => s + r.removed, 0),
        results,
      });
    }

    if (!article_id) {
      return NextResponse.json(
        { error: "article_id or all:true required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("articles")
      .select("id, article_id, h1_title, body_markdown, core_id, bridge_id, slug")
      .eq("article_id", article_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "article not found" }, { status: 404 });
    }

    const { body: cleaned, removed } = cleanReadMore(data.body_markdown);

    if (removed === 0) {
      return NextResponse.json({ article_id, removed: 0, message: "no duplicate links found" });
    }

    await supabase
      .from("articles")
      .update({
        body_markdown: cleaned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    revalidatePath(`/${data.core_id}/${data.bridge_id}/${data.slug}`);

    return NextResponse.json({ article_id, removed, updated: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
