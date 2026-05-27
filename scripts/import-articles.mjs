/**
 * scripts/import-articles.mjs
 *
 * One-time import of BlogArticle.json into Supabase.
 * Run: node scripts/import-articles.mjs
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Bootstrap ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local (or .env) into process.env
let envPath = join(root, ".env.local");
try { readFileSync(envPath); } catch { envPath = join(root, ".env"); }
readFileSync(envPath, "utf-8")
  .split("\n")
  .forEach((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
    if (match) process.env[match[1]] = match[2].trim();
  });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/** @type {any[]} */
const RAW = JSON.parse(readFileSync(join(root, "BlogArticle.json"), "utf-8"));
console.log(`Loaded ${RAW.length} articles from BlogArticle.json`);

// ── Helpers ────────────────────────────────────────────────────────────────────

function toKebabCase(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toSnakeCase(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_");
}

/** kebab-slug → snake_case for article_id */
function slugToSnake(slug) {
  return (slug || "").replace(/-/g, "_").toLowerCase();
}

/** Generate a URL slug from a title. */
function slugifyTitle(title) {
  return toKebabCase(title).slice(0, 80);
}

/** Generate TOC from body markdown. */
function extractTOC(markdown) {
  if (!markdown) return [];
  const toc = [];
  for (const line of markdown.split("\n")) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) {
      const text = h2[1].replace(/\*\*/g, "").trim();
      toc.push({ heading_level: 2, text, anchor: toKebabCase(text) });
    } else if (h3) {
      const text = h3[1].replace(/\*\*/g, "").trim();
      toc.push({ heading_level: 3, text, anchor: toKebabCase(text) });
    }
  }
  return toc;
}

/** Map JSON type fields to DB content_type enum. */
function resolveContentType(article) {
  // Prefer the `type` field, fall back to cluster_role, then article_type
  const raw = (article.type || article.cluster_role || article.article_type || "").toLowerCase();
  if (raw === "overview") return "CORE";
  if (raw === "faq") return "FAQ";
  if (raw === "comparison") return "COMPARISON";
  if (raw === "risk" || raw === "safety") return "RISK";
  if (raw === "guide" || raw === "supporting") return "GUIDE";
  // pillar flag is a fallback
  if (article.pillar_article === true) return "CORE";
  return "GUIDE";
}

/** Build FAQPage schema markup from faq_items. */
function buildFAQSchema(article) {
  if (!article.faq_items || article.faq_items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faq_items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Build Article schema markup. */
function buildArticleSchema(article, coreId, bridgeId, slug, siteUrl) {
  const url = `${siteUrl}/${coreId}/${bridgeId}/${slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title || article.h1_title || "",
    description: article.meta_description || "",
    url,
  };
}

/** Map sources[] → external_links []. */
function mapExternalLinks(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((s) => s.url)
    .map((s) => ({ url: s.url, anchor: s.publication || s.article_title || s.url }));
}

/** Map internal_links[] → internal_links_injected []. */
function mapInternalLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .filter((l) => l.slug && l.slug !== "null" && l.title)
    .map((l) => ({
      anchor_phrase: l.title,
      target_slug: l.slug,
      found: false,
    }));
}

// ── Normalise & deduplicate slugs ──────────────────────────────────────────────

const usedSlugs = new Set();

function ensureSlug(article) {
  let slug = article.slug && article.slug !== "null" ? article.slug : slugifyTitle(article.title);
  if (!slug) slug = "untitled-article";
  // deduplicate
  let candidate = slug;
  let counter = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${slug}-${counter++}`;
  }
  usedSlugs.add(candidate);
  return candidate;
}

// ── Core keyword → core_id map ────────────────────────────────────────────────

const CORE_MAP = {
  "Cat Nutrition": "cat-nutrition",
  "Dog Health": "dog-health",
  "Dog Nutrition": "dog-nutrition",
  "Cat Behavior": "cat-behavior",
  "Cat Care": "cat-care",
  "Dog Training": "dog-training",
};

// ── Determine if an article is a pillar / core ────────────────────────────────

function isPillar(article) {
  return (
    article.pillar_article === true ||
    (article.type || "").toLowerCase() === "overview" ||
    (article.cluster_role || "").toLowerCase() === "overview"
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://lovingpawshub.com").replace(/\/$/, "");

  // ── 1. Industry ─────────────────────────────────────────────────────────────
  console.log("\n[1/5] Inserting industry...");
  const { data: industryData, error: industryErr } = await supabase
    .from("industry")
    .insert({ name: "Pet Care", description: "Cat and dog health, nutrition, training, and behavior resources." })
    .select()
    .single();

  if (industryErr) {
    // Might already exist if script is re-run
    const { data: existing } = await supabase.from("industry").select().limit(1).single();
    if (!existing) { console.error("Industry insert failed:", industryErr); process.exit(1); }
    console.log("  Industry already exists, using:", existing.id);
    var industryId = existing.id;
  } else {
    console.log("  Created industry:", industryData.id);
    var industryId = industryData.id;
  }

  // ── 2. Core Keywords ─────────────────────────────────────────────────────────
  console.log("\n[2/5] Inserting core keywords...");
  const coreIdMap = {}; // core_keyword string → { id: uuid, core_id: kebab }

  for (const [keyword, coreId] of Object.entries(CORE_MAP)) {
    const { data, error } = await supabase
      .from("core_keywords")
      .insert({ industry_id: industryId, keyword, core_id: coreId })
      .select()
      .single();

    if (error) {
      // Already exists — fetch it
      const { data: existing } = await supabase
        .from("core_keywords")
        .select()
        .eq("core_id", coreId)
        .single();
      if (!existing) { console.error(`  Failed for ${keyword}:`, error); continue; }
      coreIdMap[keyword] = { id: existing.id, core_id: coreId };
      console.log(`  Core exists: ${keyword} (${coreId})`);
    } else {
      coreIdMap[keyword] = { id: data.id, core_id: coreId };
      console.log(`  Created core: ${keyword} (${coreId})`);
    }
  }

  // ── 3. Bridge Keywords ───────────────────────────────────────────────────────
  // Each unique (core_keyword, focus_keyword) pair → one bridge_keyword row.
  // Pillar articles → bridge_id = 'overview' (one per core).
  console.log("\n[3/5] Inserting bridge keywords...");

  // bridgeKey = `${coreKeyword}||${bridgeId}` → { id: uuid, bridge_id }
  const bridgeKeyMap = {};

  // Collect unique bridges needed
  const bridgesNeeded = new Map(); // key → { core_keyword, keyword, bridge_id, is_overview }

  // First pass: overview bridges (one per core that has pillar articles)
  const coresWithPillar = new Set(RAW.filter(isPillar).map((a) => a.core_keyword).filter(Boolean));
  for (const coreKeyword of coresWithPillar) {
    const core = coreIdMap[coreKeyword];
    if (!core) continue;
    const key = `${coreKeyword}||overview`;
    if (!bridgesNeeded.has(key)) {
      bridgesNeeded.set(key, {
        core_keyword: coreKeyword,
        keyword: `${coreKeyword} Overview`,
        bridge_id: "overview",
      });
    }
  }

  // Second pass: per-focus-keyword bridges for non-pillar articles
  for (const article of RAW) {
    if (!article.core_keyword || !article.focus_keyword) continue;
    if (isPillar(article)) continue; // pillar → overview already handled
    const core = coreIdMap[article.core_keyword];
    if (!core) continue;
    const bridgeId = toKebabCase(article.focus_keyword);
    const key = `${article.core_keyword}||${bridgeId}`;
    if (!bridgesNeeded.has(key)) {
      bridgesNeeded.set(key, {
        core_keyword: article.core_keyword,
        keyword: article.focus_keyword,
        bridge_id: bridgeId,
      });
    }
  }

  for (const [key, bridge] of bridgesNeeded) {
    const core = coreIdMap[bridge.core_keyword];
    if (!core) continue;

    const { data, error } = await supabase
      .from("bridge_keywords")
      .insert({ core_keyword_id: core.id, keyword: bridge.keyword, bridge_id: bridge.bridge_id })
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from("bridge_keywords")
        .select()
        .eq("core_keyword_id", core.id)
        .eq("bridge_id", bridge.bridge_id)
        .single();
      if (!existing) { console.error(`  Bridge failed [${key}]:`, error.message); continue; }
      bridgeKeyMap[key] = { id: existing.id, bridge_id: bridge.bridge_id };
      console.log(`  Bridge exists: ${key}`);
    } else {
      bridgeKeyMap[key] = { id: data.id, bridge_id: bridge.bridge_id };
      console.log(`  Created bridge: ${key}`);
    }
  }

  // ── 4. Clusters ──────────────────────────────────────────────────────────────
  // One cluster per bridge_keyword.
  console.log("\n[4/5] Inserting clusters...");
  const clusterMap = {}; // bridgeKey → cluster { id, cluster_id }

  for (const [key, bridge] of Object.entries(bridgeKeyMap)) {
    const clusterId = toSnakeCase(key.replace("||", "_"));
    const displayName = key.split("||")[1] === "overview"
      ? `${key.split("||")[0]} Pillar`
      : key.split("||")[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const { data, error } = await supabase
      .from("clusters")
      .insert({ bridge_keyword_id: bridge.id, cluster_id: clusterId, display_name: displayName })
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from("clusters")
        .select()
        .eq("bridge_keyword_id", bridge.id)
        .eq("cluster_id", clusterId)
        .single();
      if (!existing) { console.error(`  Cluster failed [${key}]:`, error.message); continue; }
      clusterMap[key] = { id: existing.id, cluster_id: clusterId };
      console.log(`  Cluster exists: ${displayName}`);
    } else {
      clusterMap[key] = { id: data.id, cluster_id: clusterId };
      console.log(`  Created cluster: ${displayName}`);
    }
  }

  // ── 5. Articles ──────────────────────────────────────────────────────────────
  console.log("\n[5/5] Inserting articles...");
  let inserted = 0;
  let skipped = 0;

  // Track which core_keywords already have their primary pillar article inserted
  // (to handle the -extra-16 duplicates gracefully)
  const coreOverviewSlugs = {}; // coreKeyword → Set of slugs already used in overview bridge

  for (const article of RAW) {
    const coreKeyword = article.core_keyword;
    if (!coreKeyword || !coreIdMap[coreKeyword]) {
      console.warn(`  Skipping: unknown core_keyword "${coreKeyword}" for "${article.title}"`);
      skipped++;
      continue;
    }

    const core = coreIdMap[coreKeyword];
    const contentType = resolveContentType(article);
    const pillar = isPillar(article);

    // Determine bridge
    let bridgeKey;
    if (pillar) {
      bridgeKey = `${coreKeyword}||overview`;
    } else {
      const focusKeyword = article.focus_keyword;
      if (!focusKeyword) {
        // No focus keyword → skip or assign to overview
        console.warn(`  Skipping: no focus_keyword for "${article.title}"`);
        skipped++;
        continue;
      }
      const bridgeId = toKebabCase(focusKeyword);
      bridgeKey = `${coreKeyword}||${bridgeId}`;
    }

    const bridge = bridgeKeyMap[bridgeKey];
    const cluster = clusterMap[bridgeKey];
    if (!bridge || !cluster) {
      console.warn(`  Skipping: no bridge/cluster for key "${bridgeKey}" (article: ${article.title})`);
      skipped++;
      continue;
    }

    // Slug
    const slug = ensureSlug(article);
    const coreId = core.core_id;
    const bridgeId = bridge.bridge_id;

    // article_id: snake_case unique identifier
    const articleId = `${slugToSnake(coreId)}__${slugToSnake(bridgeId)}__${slugToSnake(slug)}`;

    // Body content
    const bodyMarkdown = article.seo_optimized_content || article.content || "";
    const toc = extractTOC(bodyMarkdown);

    // Schema markup
    const faqSchema = buildFAQSchema(article);
    const articleSchema = buildArticleSchema(article, coreId, bridgeId, slug, siteUrl);
    const schemaMarkup = faqSchema || articleSchema;

    // Related articles — store titles as-is; slug resolution can happen later
    const relatedArticles = Array.isArray(article.related_articles)
      ? article.related_articles
          .filter((r) => typeof r === "string" && r.length < 200)
          .slice(0, 8)
          .map((title) => ({ title, article_id: null, slug: null }))
      : [];

    const row = {
      article_id: articleId,
      content_type: contentType,
      is_core_article: pillar,
      primary_keyword: article.focus_keyword || article.keyword || article.core_keyword || "",
      slug,
      core_id: coreId,
      bridge_id: bridgeId,
      h1_title: article.title || slug,
      body_markdown: bodyMarkdown,
      table_of_contents: toc.length > 0 ? toc : null,
      featured_image_url: article.featured_image || article.og_image || null,
      featured_image_alt: article.primary_image_alt || null,
      meta_title: article.meta_title || null,
      meta_description: article.meta_description || null,
      canonical_url: article.canonical_url || `${siteUrl}/${coreId}/${bridgeId}/${slug}/`,
      og_title: article.og_title || null,
      og_description: article.og_description || null,
      robots_directive: article.robots || "index, follow",
      schema_markup: schemaMarkup,
      key_highlights: Array.isArray(article.key_points) ? article.key_points : [],
      internal_links_injected: mapInternalLinks(article.internal_links),
      related_articles: relatedArticles,
      external_links: mapExternalLinks(article.sources),
      status: "published",
      link_status: "unwired",
      is_seed: false,
      published_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("articles").insert(row);

    if (error) {
      if (error.code === "23505") {
        // Unique violation — article_id already exists (script re-run)
        console.log(`  Already exists: ${articleId}`);
      } else {
        console.error(`  Failed: ${articleId} —`, error.message);
      }
      skipped++;
    } else {
      console.log(`  ✓ ${coreId}/${bridgeId}/${slug}`);
      inserted++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
╔═══════════════════════════════════════╗
║          Import Complete              ║
╠═══════════════════════════════════════╣
║  Core keywords  : ${String(Object.keys(coreIdMap).length).padEnd(18)} ║
║  Bridge keywords: ${String(Object.keys(bridgeKeyMap).length).padEnd(18)} ║
║  Clusters       : ${String(Object.keys(clusterMap).length).padEnd(18)} ║
║  Articles       : ${String(inserted).padEnd(18)} ║
║  Skipped        : ${String(skipped).padEnd(18)} ║
╚═══════════════════════════════════════╝

Next steps:
  1. Visit /admin/links to wire internal links per cluster
  2. Visit /admin/site-settings to set LovingPawsHub branding
  3. Deploy to Vercel with the same env vars
`);
}

run().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
