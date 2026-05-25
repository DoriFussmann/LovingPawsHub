import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SeedArticle {
  id: string;
  article_id: string;
  h1_title: string;
  slug: string;
  core_id: string;
  bridge_id: string;
  is_core_article: boolean;
  status: string;
  is_seed: boolean;
  body_markdown: string;
  internal_links_injected: Array<{ target_slug: string; found: boolean }> | null;
  canonical_url: string | null;
}

type TaggedArticle = SeedArticle & { articleType: "core" | "spoke" };

function sseChunk(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function ogTagPresent(html: string, property: string): boolean {
  return (
    new RegExp(
      `<meta\\s[^>]*property=["']${property}["'][^>]*content=["'][^"']+["']`,
      "i"
    ).test(html) ||
    new RegExp(
      `<meta\\s[^>]*content=["'][^"']+["'][^>]*property=["']${property}["']`,
      "i"
    ).test(html)
  );
}

export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => controller.enqueue(sseChunk(data));

      try {
        const supabase = createServiceClient();

        const { data: seedArticles, error } = await supabase
          .from("articles")
          .select(
            `id, article_id, h1_title, slug, core_id, bridge_id,
             is_core_article, status, is_seed, body_markdown,
             internal_links_injected, canonical_url`
          )
          .eq("is_seed", true);

        if (error) {
          emit({ type: "error", message: `DB error: ${error.message}` });
          controller.close();
          return;
        }

        if (!seedArticles || seedArticles.length === 0) {
          emit({
            type: "error",
            message:
              "No seed articles found. Mark articles with is_seed = true to use this panel.",
          });
          controller.close();
          return;
        }

        const rawCore = (seedArticles as SeedArticle[]).find(
          (a) => a.is_core_article
        );
        const rawSpoke = (seedArticles as SeedArticle[]).find(
          (a) => !a.is_core_article
        );

        const articles: TaggedArticle[] = [
          rawCore ? { ...rawCore, articleType: "core" as const } : null,
          rawSpoke ? { ...rawSpoke, articleType: "spoke" as const } : null,
        ].filter((a): a is TaggedArticle => a !== null);

        // Pre-fetch sitemap once
        emit({ type: "status", message: "fetching /sitemap.xml…" });
        let sitemapContent = "";
        try {
          const sitemapRes = await fetch(`${siteUrl}/sitemap.xml`, {
            cache: "no-store",
          });
          if (sitemapRes.ok) sitemapContent = await sitemapRes.text();
        } catch {
          // sitemap unavailable — will surface in check 8
        }

        for (const article of articles) {
          const label = `${article.articleType}: ${article.h1_title}`;
          const canonicalUrl = `${siteUrl}/${article.core_id}/${article.bridge_id}/${article.slug}/`;

          // ── Check 1: Record exists in DB ────────────────────────────────
          emit({ type: "status", message: `[${label}] verifying DB record` });
          const recordPass =
            article.status === "published" && article.is_seed === true;
          emit({
            type: "check",
            article: label,
            check: "Record exists in DB",
            status: recordPass ? "pass" : "fail",
            detail: recordPass
              ? `status=${article.status}, is_seed=true`
              : `status=${article.status}, is_seed=${article.is_seed} — expected status=published and is_seed=true`,
          });

          // Fetch page HTML — reused for checks 2–7
          emit({ type: "status", message: `[${label}] fetching live page…` });
          let pageHtml = "";
          let httpStatus = 0;
          try {
            const pageRes = await fetch(canonicalUrl, { cache: "no-store" });
            httpStatus = pageRes.status;
            if (pageRes.ok) pageHtml = await pageRes.text();
          } catch {
            httpStatus = -1;
          }
          const htmlAvail = pageHtml.length > 0;

          // ── Check 2: Live route renders ──────────────────────────────────
          emit({
            type: "check",
            article: label,
            check: "Live route renders",
            status: httpStatus === 200 ? "pass" : "fail",
            detail:
              httpStatus === 200
                ? `HTTP 200 — ${canonicalUrl}`
                : `HTTP ${httpStatus === -1 ? "network error" : httpStatus} — ${canonicalUrl}`,
          });

          // ── Check 3: Meta title present ──────────────────────────────────
          const titleMatch = pageHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
          const titleContent = titleMatch?.[1]?.trim() ?? "";
          emit({
            type: "check",
            article: label,
            check: "Meta title present",
            status: titleContent ? "pass" : "fail",
            detail: titleContent
              ? `"${titleContent.substring(0, 100)}"`
              : htmlAvail
              ? "no <title> tag found"
              : "page unavailable — could not inspect HTML",
          });

          // ── Check 4: Meta description present ───────────────────────────
          const metaDescMatch =
            pageHtml.match(
              /<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
            ) ??
            pageHtml.match(
              /<meta\s[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
            );
          const metaDescContent = metaDescMatch?.[1]?.trim() ?? "";
          emit({
            type: "check",
            article: label,
            check: "Meta description present",
            status: metaDescContent ? "pass" : "fail",
            detail: metaDescContent
              ? `"${metaDescContent.substring(0, 120)}"`
              : htmlAvail
              ? "no <meta name=\"description\"> found"
              : "page unavailable — could not inspect HTML",
          });

          // ── Check 5: Canonical tag correct ───────────────────────────────
          const canonicalMatch =
            pageHtml.match(
              /<link\s[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
            ) ??
            pageHtml.match(
              /<link\s[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i
            );
          const foundCanonical = canonicalMatch?.[1]?.trim() ?? "";
          const canonicalPass = foundCanonical === canonicalUrl;
          emit({
            type: "check",
            article: label,
            check: "Canonical tag correct",
            status: canonicalPass ? "pass" : "fail",
            detail: canonicalPass
              ? foundCanonical
              : `expected: ${canonicalUrl} | found: ${foundCanonical || "not found"}`,
          });

          // ── Check 6: OG tags present ─────────────────────────────────────
          const OG_TAGS = [
            "og:title",
            "og:description",
            "og:url",
            "og:image",
          ] as const;
          const missingOg = OG_TAGS.filter((tag) => !ogTagPresent(pageHtml, tag));
          emit({
            type: "check",
            article: label,
            check: "OG tags present",
            status: missingOg.length === 0 ? "pass" : "fail",
            detail:
              missingOg.length > 0
                ? htmlAvail
                  ? `missing: ${missingOg.join(", ")}`
                  : "page unavailable — could not inspect HTML"
                : "og:title, og:description, og:url, og:image — all present and non-empty",
          });

          // ── Check 7: JSON-LD present ─────────────────────────────────────
          const jsonldMatch = pageHtml.match(
            /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
          );
          let jsonldPass = false;
          let jsonldDetail = htmlAvail
            ? 'no <script type="application/ld+json"> found'
            : "page unavailable — could not inspect HTML";
          if (jsonldMatch) {
            try {
              JSON.parse(jsonldMatch[1]);
              jsonldPass = true;
              jsonldDetail = "valid, parseable JSON-LD block found";
            } catch (e) {
              jsonldDetail = `invalid JSON: ${
                e instanceof Error ? e.message : "parse error"
              }`;
            }
          }
          emit({
            type: "check",
            article: label,
            check: "JSON-LD present",
            status: jsonldPass ? "pass" : "fail",
            detail: jsonldDetail,
          });

          // ── Check 8: Appears in sitemap ──────────────────────────────────
          const inSitemap = sitemapContent.includes(canonicalUrl);
          emit({
            type: "check",
            article: label,
            check: "Appears in sitemap",
            status: inSitemap ? "pass" : "fail",
            detail: inSitemap
              ? canonicalUrl
              : sitemapContent
              ? `${canonicalUrl} not found in /sitemap.xml`
              : "sitemap fetch failed — could not verify",
          });

          // ── Check 9: Internal link resolves ──────────────────────────────
          emit({
            type: "status",
            message: `[${label}] checking internal links`,
          });
          const otherArticle = articles.find(
            (a) => a.article_id !== article.article_id
          );
          if (!otherArticle) {
            emit({
              type: "check",
              article: label,
              check: "Internal link resolves",
              status: "fail",
              detail:
                "only one seed article found — both a core and a spoke article are required",
            });
          } else {
            const targetSlug = otherArticle.slug;
            const targetHref = `/${otherArticle.core_id}/${otherArticle.bridge_id}/${targetSlug}/`;
            const bodyMd = article.body_markdown ?? "";
            const injectedLinks = (article.internal_links_injected ??
              []) as Array<{ target_slug: string; found: boolean }>;

            // Check body markdown for the full path, or the slug alone
            const inBody =
              bodyMd.includes(targetHref) || bodyMd.includes(`/${targetSlug}/`);
            const inInjected = injectedLinks.some(
              (l) => l.target_slug === targetSlug && l.found
            );
            const linkExists = inBody || inInjected;

            if (!linkExists) {
              emit({
                type: "check",
                article: label,
                check: "Internal link resolves",
                status: "fail",
                detail: `no link to "${targetHref}" found in body_markdown or internal_links_injected`,
              });
            } else {
              // Verify target URL actually resolves
              const targetUrl = `${siteUrl}${targetHref}`;
              let targetStatus = 0;
              try {
                const headRes = await fetch(targetUrl, {
                  method: "HEAD",
                  cache: "no-store",
                });
                targetStatus = headRes.status;
              } catch {
                targetStatus = -1;
              }
              emit({
                type: "check",
                article: label,
                check: "Internal link resolves",
                status: targetStatus === 200 ? "pass" : "fail",
                detail:
                  targetStatus === 200
                    ? `link to "${targetHref}" present in body → target returns HTTP 200`
                    : `link to "${targetHref}" found in body, but target returned HTTP ${
                        targetStatus === -1 ? "network error" : targetStatus
                      }`,
              });
            }
          }
        }

        emit({ type: "done" });
      } catch (e) {
        emit({
          type: "error",
          message: e instanceof Error ? e.message : "unexpected error",
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
