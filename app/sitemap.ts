import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/articles/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/glossary/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/tools/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // /resources/ is intentionally excluded — page sets robots: noindex
  ];

  try {
    const supabase = createClient();

    const { data: articles } = await supabase
      .from("articles")
      .select("core_id, bridge_id, slug, is_core_article, updated_at, robots_directive, canonical_url, author_url")
      .eq("status", "published");

    const rows = (articles ?? []).filter((a) => {
      // Exclude articles that have a noindex directive
      if (a.robots_directive && a.robots_directive.toLowerCase().includes("noindex")) return false;
      // Exclude articles that point to a different canonical (they are consolidated)
      if (a.canonical_url) {
        const expected = `${siteUrl}/${a.core_id}/${a.bridge_id}/${a.slug}/`;
        if (a.canonical_url !== expected) return false;
      }
      return true;
    });

    // Derive unique core category pages
    const coreLatest = new Map<string, string>();
    for (const a of rows) {
      const current = coreLatest.get(a.core_id);
      if (!current || a.updated_at > current) coreLatest.set(a.core_id, a.updated_at);
    }
    const corePages: MetadataRoute.Sitemap = Array.from(coreLatest.entries()).map(
      ([core_id, updated_at]) => ({
        url: `${siteUrl}/${core_id}/`,
        lastModified: new Date(updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })
    );

    // Derive unique bridge category pages
    const bridgeLatest = new Map<string, { core_id: string; updated_at: string }>();
    for (const a of rows) {
      const key = `${a.core_id}/${a.bridge_id}`;
      const current = bridgeLatest.get(key);
      if (!current || a.updated_at > current.updated_at)
        bridgeLatest.set(key, { core_id: a.core_id, updated_at: a.updated_at });
    }
    const bridgePages: MetadataRoute.Sitemap = Array.from(bridgeLatest.entries()).map(
      ([key, { updated_at }]) => {
        const [core_id, bridge_id] = key.split("/");
        return {
          url: `${siteUrl}/${core_id}/${bridge_id}/`,
          lastModified: new Date(updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        };
      }
    );

    // Article pages — deduplicate by URL
    const seenArticles = new Set<string>();
    const articlePages: MetadataRoute.Sitemap = [];
    for (const a of rows) {
      const url = `${siteUrl}/${a.core_id}/${a.bridge_id}/${a.slug}/`;
      if (!seenArticles.has(url)) {
        seenArticles.add(url);
        articlePages.push({
          url,
          lastModified: new Date(a.updated_at),
          changeFrequency: "weekly" as const,
          priority: a.is_core_article ? 0.8 : 0.7,
        });
      }
    }

    // Author profile pages
    const seenAuthors = new Set<string>();
    const authorPages: MetadataRoute.Sitemap = [];
    for (const a of rows) {
      if (a.author_url && !seenAuthors.has(a.author_url)) {
        seenAuthors.add(a.author_url);
        // Ensure absolute URL
        const url = a.author_url.startsWith("http")
          ? a.author_url
          : `${siteUrl}${a.author_url.startsWith("/") ? "" : "/"}${a.author_url}`;
        authorPages.push({
          url,
          lastModified: new Date(a.updated_at),
          changeFrequency: "monthly" as const,
          priority: 0.4,
        });
      }
    }

    // Glossary term pages
    const { data: glossaryTerms } = await supabase
      .from("glossary_terms")
      .select("slug, updated_at")
      .eq("status", "published");

    const glossaryPages: MetadataRoute.Sitemap = (glossaryTerms ?? []).map((t) => ({
      url: `${siteUrl}/glossary/${t.slug}/`,
      lastModified: new Date(t.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...corePages, ...bridgePages, ...articlePages, ...authorPages, ...glossaryPages];
  } catch {
    return staticPages;
  }
}
