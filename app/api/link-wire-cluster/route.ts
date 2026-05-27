import { NextRequest, NextResponse } from "next/server";
import { injectInternalLinks } from "@/lib/linkwire";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const maxDuration = 120;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function extractExternalLinks(body: string): Array<{ url: string; anchor: string }> {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const results: Array<{ url: string; anchor: string }> = [];
  let match;
  while ((match = pattern.exec(body)) !== null) {
    results.push({ anchor: match[1], url: match[2] });
  }
  return results;
}

async function checkUrl(url: string, timeoutMs = 5000): Promise<{ status: number | null; ok: boolean }> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const resp = await fetch(url, {
        method,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      return { status: resp.status, ok: resp.ok };
    } catch {
      // try next method
    }
  }
  return { status: null, ok: false };
}

/**
 * Robust external URL check used during wiring:
 *  1. HEAD request (fast, confirms the server responds)
 *  2. GET request to read <title> and catch soft-404s
 *     (pages that return HTTP 200 but show "404" in the title)
 */
async function checkExternalUrlRobust(url: string): Promise<{ ok: boolean; soft404: boolean }> {
  // Step 1: HEAD
  let headOk = false;
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!head.ok) return { ok: false, soft404: false };
    headOk = true;
  } catch {
    // HEAD failed — fall through to GET
  }

  // Step 2: GET to detect soft-404s
  try {
    const get = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    const text = await get.text();
    const titleMatch = text.match(/<title[^>]*>([^<]{0,300})<\/title>/i);
    const title = (titleMatch?.[1] ?? "").toLowerCase();
    const soft404 = /\b(404|not found|page not found|doesn.t exist)\b/.test(title);
    return { ok: get.ok && !soft404, soft404 };
  } catch {
    return { ok: headOk, soft404: false };
  }
}

function buildNormalizationVariants(url: string): string[] {
  const variants = new Set<string>();
  try {
    const parsed = new URL(url);
    const protocols = ["https:", "http:"];
    const host = parsed.hostname;
    const hostVariants = [host, host.startsWith("www.") ? host.slice(4) : `www.${host}`];
    const pathWithSlash = parsed.pathname.endsWith("/") ? parsed.pathname : parsed.pathname + "/";
    const pathWithout = parsed.pathname.endsWith("/")
      ? parsed.pathname.slice(0, -1) || "/"
      : parsed.pathname;
    for (const proto of protocols) {
      for (const h of hostVariants) {
        for (const p of [pathWithSlash, pathWithout]) {
          const candidate = `${proto}//${h}${p}${parsed.search}${parsed.hash}`;
          if (candidate !== url) variants.add(candidate);
        }
      }
    }
  } catch { /* invalid URL */ }
  return Array.from(variants);
}

async function findWaybackUrl(url: string): Promise<string | null> {
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      archived_snapshots?: { closest?: { available: boolean; url: string } };
    };
    const closest = data.archived_snapshots?.closest;
    if (closest?.available && closest.url) return closest.url;
  } catch { /* unreachable */ }
  return null;
}

// Append a sentence to the article body — before the last ## heading if possible,
// else at the very end.
function appendToBody(body: string, sentence: string): string {
  // Find the last h2 heading position
  const lastH2 = body.lastIndexOf("\n## ");
  if (lastH2 > 0) {
    return body.slice(0, lastH2) + "\n\n" + sentence + body.slice(lastH2);
  }
  return body.trimEnd() + "\n\n" + sentence;
}

// ─── Shared DB fetch ─────────────────────────────────────────────────────────

interface ClusterArticle {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  primary_keyword: string;
  body_markdown: string;
  core_id: string;
  bridge_id: string;
  content_type: string;
  is_core_article: boolean;
  link_status: string;
  internal_links_injected: Array<{ anchor_phrase: string; target_slug: string; found: boolean; target_url?: string }> | null;
  external_links: Array<{ url: string; anchor: string }> | null;
}

const ARTICLE_SELECT = "id, article_id, h1_title, slug, primary_keyword, body_markdown, core_id, bridge_id, content_type, is_core_article, link_status, internal_links_injected, external_links";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchClusterArticles(clusterId: string) {
  const supabase = createServiceClient();

  // Synthetic key: articles published without a skeleton/cluster assignment.
  // The Links Hub groups these as "${core_id}__${bridge_id}" instead of a real UUID.
  if (!UUID_RE.test(clusterId) && clusterId.includes("__")) {
    const separatorIdx = clusterId.indexOf("__");
    const core_id = clusterId.slice(0, separatorIdx);
    const bridge_id = clusterId.slice(separatorIdx + 2);
    const { data: rawArticles } = await supabase
      .from("articles")
      .select(ARTICLE_SELECT)
      .eq("core_id", core_id)
      .eq("bridge_id", bridge_id)
      .eq("status", "published");
    return { supabase, skeletonIds: [], articles: (rawArticles ?? []) as ClusterArticle[] };
  }

  // Normal path: real cluster UUID — join via article_skeletons.
  const { data: skeletons } = await supabase
    .from("article_skeletons")
    .select("id")
    .eq("cluster_id", clusterId);

  const skeletonIds = (skeletons ?? []).map((s: { id: string }) => s.id);
  if (skeletonIds.length === 0) return { supabase, skeletonIds, articles: [] };

  const { data: rawArticles } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .in("skeleton_id", skeletonIds)
    .eq("status", "published");

  return { supabase, skeletonIds, articles: (rawArticles ?? []) as ClusterArticle[] };
}

// ─── Step 1: inject_core_bridge ───────────────────────────────────────────────

async function injectCoreBridge(clusterId: string) {
  const { supabase, articles } = await fetchClusterArticles(clusterId);
  if (articles.length === 0) return { error: "no published articles found" };

  const coreArticle = articles.find((a) => a.is_core_article);
  const hubArticle = articles.find((a) => a.content_type === "HUB");

  const results: Array<{ article_id: string; links_added: number; links_total: number }> = [];

  for (const article of articles) {
    let body = article.body_markdown;
    const newLinks: Array<{ anchor_phrase: string; target_slug: string; found: boolean }> = [];

    // Link to CORE (skip if this IS the core article)
    if (coreArticle && article.article_id !== coreArticle.article_id) {
      const sentence = `For a complete overview of ${coreArticle.primary_keyword}, see [${coreArticle.h1_title}](/${coreArticle.core_id}/${coreArticle.bridge_id}/${coreArticle.slug}/).`;
      body = appendToBody(body, sentence);
      newLinks.push({ anchor_phrase: coreArticle.h1_title, target_slug: coreArticle.slug, found: true });
    }

    // Link to HUB (skip if this IS the hub article, and skip if already linked to core which is the hub)
    if (
      hubArticle &&
      article.article_id !== hubArticle.article_id &&
      hubArticle.article_id !== coreArticle?.article_id
    ) {
      const sentence = `For a broader look at ${hubArticle.primary_keyword}, see [${hubArticle.h1_title}](/${hubArticle.core_id}/${hubArticle.bridge_id}/${hubArticle.slug}/).`;
      body = appendToBody(body, sentence);
      newLinks.push({ anchor_phrase: hubArticle.h1_title, target_slug: hubArticle.slug, found: true });
    }

    // Keep existing placed links, discard stale unfound entries
    const existingLinks = (article.internal_links_injected ?? []).filter((l) => l.found);
    const existingSlugs = new Set(existingLinks.map((l) => l.target_slug));
    const deduped = newLinks.filter((l) => !existingSlugs.has(l.target_slug));
    const merged = [...existingLinks, ...deduped];

    if (deduped.length > 0) {
      await supabase
        .from("articles")
        .update({
          body_markdown: body,
          internal_links_injected: merged,
          link_status: "wired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
    }

    results.push({ article_id: article.article_id, links_added: deduped.length, links_total: merged.length });
  }

  return { results };
}

// ─── Step 2: inject_siblings ──────────────────────────────────────────────────

async function injectSiblings(clusterId: string) {
  const { supabase, articles } = await fetchClusterArticles(clusterId);
  if (articles.length === 0) return { error: "no published articles found" };

  const results: Array<{ article_id: string; links_added: number; links_total: number }> = [];

  for (const article of articles) {
    // All siblings in the cluster except self and CORE/HUB (which are already in step 1)
    // Deterministic order — sorted by article_id for consistency.
    const selected = articles
      .filter((s) => {
        if (s.article_id === article.article_id) return false;
        if (s.content_type === "CORE" || s.content_type === "HUB") return false;
        return true;
      })
      .sort((a, b) => a.article_id.localeCompare(b.article_id));

    // Keep existing placed links, discard any unfound stale entries
    const existingLinks = (article.internal_links_injected ?? []).filter((l) => l.found);
    const existingSlugs = new Set(existingLinks.map((l) => l.target_slug));
    const newLinks: Array<{ anchor_phrase: string; target_slug: string; found: boolean }> = [];

    const readMoreItems: string[] = [];
    for (const sibling of selected) {
      if (existingSlugs.has(sibling.slug)) continue;
      const href = `/${sibling.core_id}/${sibling.bridge_id}/${sibling.slug}/`;
      readMoreItems.push(`[${sibling.h1_title}](${href})`);
      newLinks.push({ anchor_phrase: sibling.h1_title, target_slug: sibling.slug, found: true });
    }

    const merged = [...existingLinks, ...newLinks];

    if (readMoreItems.length > 0) {
      const readMoreSection = "\n\n---\n\n**Read more:**\n" +
        readMoreItems.map((item) => `· ${item}`).join("\n");
      const body = article.body_markdown.trimEnd() + readMoreSection;

      await supabase
        .from("articles")
        .update({
          body_markdown: body,
          internal_links_injected: merged,
          link_status: "wired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
    } else if (newLinks.length === 0 && existingLinks.length > 0) {
      // No new siblings to add but existing links are there — still wired
      await supabase
        .from("articles")
        .update({ link_status: "wired", updated_at: new Date().toISOString() })
        .eq("id", article.id);
    }

    results.push({ article_id: article.article_id, links_added: newLinks.length, links_total: merged.length });
  }

  return { results };
}

// ─── Step 3: fix_external ─────────────────────────────────────────────────────

async function fixExternal(clusterId: string) {
  const { supabase, articles } = await fetchClusterArticles(clusterId);
  if (articles.length === 0) return { error: "no published articles found" };

  const results: Array<{
    article_id: string;
    checked: number;
    fixed: number;
    stripped: number;
  }> = [];

  for (const article of articles) {
    const externalLinks = extractExternalLinks(article.body_markdown);
    if (externalLinks.length === 0) {
      results.push({ article_id: article.article_id, checked: 0, fixed: 0, stripped: 0 });
      continue;
    }

    let body = article.body_markdown;
    let fixed = 0;
    let stripped = 0;

    for (const { url, anchor } of externalLinks) {
      const { ok } = await checkUrl(url, 4000);
      if (ok) continue;

      // Try normalization variants
      let replacement: string | null = null;
      const variants = buildNormalizationVariants(url);
      for (const v of variants) {
        const { ok: vOk } = await checkUrl(v, 3000);
        if (vOk) { replacement = v; break; }
      }

      // Try Wayback Machine
      if (!replacement) {
        replacement = await findWaybackUrl(url);
        if (replacement) {
          const { ok: wOk } = await checkUrl(replacement, 4000);
          if (!wOk) replacement = null;
        }
      }

      const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      if (replacement) {
        // Replace the broken URL with the working one
        body = body.replace(
          new RegExp(`\\]\\(${escapedUrl}\\)`, "g"),
          `](${replacement})`
        );
        fixed++;
      } else {
        // Strip the link, keep the anchor text
        body = body.replace(
          new RegExp(`\\[${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\(${escapedUrl}\\)`, "g"),
          anchor
        );
        stripped++;
      }
    }

    const updatedExternal = extractExternalLinks(body).map(({ url, anchor }) => ({ url, anchor }));
    await supabase
      .from("articles")
      .update({
        body_markdown: body,
        external_links: updatedExternal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    results.push({ article_id: article.article_id, checked: externalLinks.length, fixed, stripped });
  }

  return { results };
}

// ─── Step 4: check_and_publish ────────────────────────────────────────────────

async function checkAndPublish(clusterId: string) {
  const { supabase, articles } = await fetchClusterArticles(clusterId);
  if (articles.length === 0) return { error: "no published articles found" };

  const results: Array<{
    article_id: string;
    slug: string;
    links_wired: number;
    links_total: number;
    unfound_anchors: string[];
    link_status: string;
  }> = [];

  for (const article of articles) {
    const wired = await injectInternalLinks(
      {
        ...article,
        internal_links_injected: article.internal_links_injected ?? [],
      },
      supabase
    );

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

    const injected = wired.internal_links_injected as Array<{ found: boolean; anchor_phrase: string }>;
    const linksWired = injected.filter((l) => l.found).length;
    const unfoundAnchors = injected.filter((l) => !l.found).map((l) => l.anchor_phrase);
    results.push({
      article_id: article.article_id,
      slug: article.slug,
      links_wired: linksWired,
      links_total: injected.length,
      unfound_anchors: unfoundAnchors,
      link_status: wired.link_status,
    });
  }

  revalidatePath("/articles");

  const allWired = results.every((r) => r.link_status === "wired");
  const anyWired = results.some((r) => r.links_wired > 0);
  const clusterHealth = allWired ? "healthy" : anyWired ? "issues" : "unchecked";

  await supabase
    .from("clusters")
    .update({ link_health: clusterHealth, last_link_check: new Date().toISOString() })
    .eq("id", clusterId);

  return {
    results,
    summary: {
      total: results.length,
      wired: results.filter((r) => r.link_status === "wired").length,
      partial: results.filter((r) => r.link_status === "partial").length,
      unwired: results.filter((r) => r.link_status === "unwired").length,
    },
  };
}

// ─── Step: wire_single_article ────────────────────────────────────────────────
// Skips link injection (steps 1-3). Focuses on external link health and
// re-running the injectInternalLinks verification pass.
//
// External links: uses the stored external_links list from the last check-links
// run as the starting set, falling back to body extraction. Each link is verified
// with a full HEAD → GET → soft-404 pass before any fix attempt.

async function wireSingleArticle(clusterId: string, articleId: string) {
  const { supabase, articles } = await fetchClusterArticles(clusterId);

  const article = articles.find((a) => a.article_id === articleId || a.id === articleId);
  if (!article) return { error: `article ${articleId} not found or not published in cluster` };

  // ── Steps 1-3 skipped (link injection is managed separately) ───────────────
  // Reported back to the UI via skipped_injection: true.

  // ── Fix external links ──────────────────────────────────────────────────────
  // Use the stored list from the last check-links run if available — avoids
  // re-parsing the markdown and respects what the check already found.
  const externalLinks =
    article.external_links && article.external_links.length > 0
      ? article.external_links
      : extractExternalLinks(article.body_markdown);

  let body = article.body_markdown;
  let extOk = 0;
  let extFixed = 0;
  let extStripped = 0;

  for (const { url, anchor } of externalLinks) {
    // Full robust check: HEAD → GET → soft-404 title scan
    const { ok } = await checkExternalUrlRobust(url);
    if (ok) { extOk++; continue; }

    // Try URL normalization variants (protocol, www, trailing slash)
    let replacement: string | null = null;
    for (const v of buildNormalizationVariants(url)) {
      const { ok: vOk } = await checkExternalUrlRobust(v);
      if (vOk) { replacement = v; break; }
    }

    // Try Wayback Machine as last resort
    if (!replacement) {
      const wayback = await findWaybackUrl(url);
      if (wayback) {
        const { ok: wOk } = await checkExternalUrlRobust(wayback);
        if (wOk) replacement = wayback;
      }
    }

    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (replacement) {
      body = body.replace(new RegExp(`\\]\\(${escapedUrl}\\)`, "g"), `](${replacement})`);
      extFixed++;
    } else {
      // Dead link — strip hyperlink, keep anchor text
      body = body.replace(
        new RegExp(`\\[${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\(${escapedUrl}\\)`, "g"),
        anchor
      );
      extStripped++;
    }
  }

  // ── Re-run injectInternalLinks verification pass ────────────────────────────
  // Confirms all entries in internal_links_injected are present as live links
  // in the body and recomputes link_status (wired / partial / unwired).
  const existingLinks = article.internal_links_injected ?? [];
  const wired = await injectInternalLinks(
    { ...article, body_markdown: body, internal_links_injected: existingLinks },
    supabase
  );

  // ── Save + revalidate ───────────────────────────────────────────────────────
  await supabase
    .from("articles")
    .update({
      body_markdown: wired.body_markdown,
      internal_links_injected: wired.internal_links_injected,
      external_links: extractExternalLinks(wired.body_markdown),
      link_status: wired.link_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", article.id);

  revalidatePath(`/${article.core_id}/${article.bridge_id}/${article.slug}`);

  return {
    article_id: article.article_id,
    skipped_injection: true,
    external: {
      checked: externalLinks.length,
      ok: extOk,
      fixed: extFixed,
      stripped: extStripped,
    },
    published: true,
  };
}

// ─── Step: finalize_cluster ───────────────────────────────────────────────────
// Lightweight step called after all articles are wired to persist cluster health.

async function finalizeCluster(clusterId: string) {
  const supabase = createServiceClient();
  await supabase
    .from("clusters")
    .update({ link_health: "healthy", last_link_check: new Date().toISOString() })
    .eq("id", clusterId);
  revalidatePath("/articles");
  return { success: true };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { cluster_id, article_id, action } = await request.json();

    if (!cluster_id) {
      return NextResponse.json({ error: "cluster_id required" }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: "action required: wire_single_article | inject_core_bridge | inject_siblings | fix_external | check_and_publish" }, { status: 400 });
    }

    switch (action) {
      case "finalize_cluster": {
        const result = await finalizeCluster(cluster_id);
        return NextResponse.json(result);
      }
      case "wire_single_article": {
        if (!article_id) return NextResponse.json({ error: "article_id required for wire_single_article" }, { status: 400 });
        const result = await wireSingleArticle(cluster_id, article_id);
        return NextResponse.json(result);
      }
      case "inject_core_bridge": {
        const result = await injectCoreBridge(cluster_id);
        return NextResponse.json(result);
      }
      case "inject_siblings": {
        const result = await injectSiblings(cluster_id);
        return NextResponse.json(result);
      }
      case "fix_external": {
        const result = await fixExternal(cluster_id);
        return NextResponse.json(result);
      }
      case "check_and_publish": {
        const result = await checkAndPublish(cluster_id);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
