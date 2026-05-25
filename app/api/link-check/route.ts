import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface InternalLink {
  anchor_phrase: string;
  target_slug: string;
  found: boolean;
  target_url?: string;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** HEAD-only check for internal links (our own pages should respond fast). */
async function headCheck(url: string, timeoutMs = 5000): Promise<{ status: number | null; ok: boolean }> {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    return { status: resp.status, ok: resp.ok };
  } catch {
    return { status: null, ok: false };
  }
}

/**
 * Full check for external URLs:
 *  1. HEAD request to confirm the URL responds
 *  2. GET request to read the page title and detect soft-404s
 *     (pages that return HTTP 200 but show "404 Not Found" in the <title>)
 */
async function checkExternalUrl(url: string): Promise<{ status: number | null; ok: boolean; soft404: boolean }> {
  // Step 1: HEAD
  let headStatus: number | null = null;
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    headStatus = head.status;
    if (!head.ok) return { status: headStatus, ok: false, soft404: false };
  } catch {
    // HEAD failed — fall through to GET only
  }

  // Step 2: GET to read <title> for soft-404 detection
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
    return { status: headStatus ?? get.status, ok: get.ok && !soft404, soft404 };
  } catch {
    return { status: headStatus, ok: headStatus !== null && headStatus >= 200 && headStatus < 300, soft404: false };
  }
}

/** Extract all external markdown links from body. */
function extractExternalLinks(body: string): Array<{ url: string; anchor: string }> {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const results: Array<{ url: string; anchor: string }> = [];
  let match;
  while ((match = pattern.exec(body)) !== null) {
    results.push({ anchor: match[1], url: match[2] });
  }
  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cluster_id, article_db_id } = body as { cluster_id: string; article_db_id: string };

    if (!cluster_id || !article_db_id) {
      return NextResponse.json(
        { error: "cluster_id and article_db_id required" },
        { status: 400 }
      );
    }

    // Derive base URL from the incoming request so internal links resolve
    // correctly in both development (http://localhost:PORT) and production.
    const baseUrl = new URL(request.url).origin;
    const supabase = createServiceClient();

    // Fetch the specific article
    const { data: article } = await supabase
      .from("articles")
      .select("id, article_id, h1_title, body_markdown, core_id, bridge_id, slug, internal_links_injected, external_links")
      .eq("id", article_db_id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "article not found" }, { status: 404 });
    }

    const internalLinks = (article.internal_links_injected ?? []) as InternalLink[];

    // ── Internal link checks ─────────────────────────────────────────────────
    // For each injected internal link:
    //   (a) confirm the anchor is present in the article body
    //   (b) make an HTTP HEAD request to the actual page URL
    const internalResults = await Promise.all(
      internalLinks.map(async (link) => {
        const targetUrl = link.target_url ?? null;

        // (a) Anchor present in body markdown?
        const anchorInBody = targetUrl
          ? article.body_markdown.includes(`](${targetUrl})`)
          : false;

        // (b) HTTP check — only worth doing if the anchor is actually in the body
        let httpOk = false;
        let httpStatus: number | null = null;
        if (targetUrl) {
          const fullUrl = targetUrl.startsWith("http")
            ? targetUrl
            : `${baseUrl}${targetUrl}`;
          const result = await headCheck(fullUrl, 5000);
          httpOk = result.ok;
          httpStatus = result.status;
        }

        return {
          anchor_phrase: link.anchor_phrase,
          target_slug: link.target_slug,
          target_url: targetUrl,
          anchor_in_body: anchorInBody,
          http_status: httpStatus,
          http_ok: httpOk,
          // A link is fully ok only if both the anchor is in the body AND HTTP resolves
          ok: anchorInBody && httpOk,
        };
      })
    );

    // ── External link checks ─────────────────────────────────────────────────
    // Extract links from the live body markdown, then:
    //   (a) HEAD request to verify URL responds
    //   (b) GET request to read <title> and detect soft-404s
    const externalLinksInBody = extractExternalLinks(article.body_markdown);
    const externalResults = await Promise.all(
      externalLinksInBody.map(async ({ url, anchor }) => {
        const result = await checkExternalUrl(url);
        return { url, anchor, ...result };
      })
    );

    // ── Compute link_status (50% threshold) ──────────────────────────────────
    const totalInternal = internalResults.length;
    const okCount = internalResults.filter((r) => r.ok).length;
    const link_status: string =
      totalInternal === 0
        ? "wired"
        : okCount === totalInternal
        ? "wired"
        : okCount / totalInternal > 0.5
        ? "partial"
        : "unwired";

    // ── Persist results ──────────────────────────────────────────────────────
    const now = new Date().toISOString();

    await supabase
      .from("articles")
      .update({
        link_status,
        external_links: externalLinksInBody.map(({ url, anchor }) => ({ url, anchor })),
        updated_at: now,
      })
      .eq("id", article.id);

    // Update the cluster's last_link_check timestamp
    await supabase
      .from("clusters")
      .update({ last_link_check: now })
      .eq("id", cluster_id);

    return NextResponse.json({
      article_id: article.article_id,
      article_db_id: article.id,
      link_status,
      internal: internalResults,
      external: externalResults,
      checked_at: now,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
