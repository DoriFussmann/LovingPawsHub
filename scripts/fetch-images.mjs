/**
 * scripts/fetch-images.mjs
 *
 * Fetches Unsplash images for every published article that has no featured_image_url.
 * Run: node scripts/fetch-images.mjs
 *
 * Unsplash free tier: 50 requests/hour — we add a 1.5s delay between calls.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let envPath = join(root, ".env.local");
try { readFileSync(envPath); } catch { envPath = join(root, ".env"); }
readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
  if (match) process.env[match[1]] = match[2].trim();
});

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!UNSPLASH_KEY) {
  console.error("UNSPLASH_ACCESS_KEY not set in .env.local");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchUnsplash(query) {
  const params = new URLSearchParams({ query, per_page: "1", orientation: "landscape" });
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) {
    console.warn(`  Unsplash ${res.status} for query: "${query}"`);
    return { url: null, alt: null };
  }
  const json = await res.json();
  const photo = json?.results?.[0];
  if (!photo) return { url: null, alt: null };
  return {
    url: photo.urls?.regular ?? null,
    alt: photo.alt_description || photo.description || query,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // Fetch ALL published articles and refresh every image with our own key
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, primary_keyword, h1_title, featured_image_url")
    .eq("status", "published");

  if (error) { console.error("Fetch error:", error); process.exit(1); }
  console.log(`Found ${articles.length} articles without images.\n`);

  let updated = 0;
  let failed = 0;

  for (const [i, article] of articles.entries()) {
    const query = article.primary_keyword || article.h1_title;
    process.stdout.write(`[${i + 1}/${articles.length}] "${query}" ... `);

    const { url, alt } = await fetchUnsplash(query);

    if (url) {
      const { error: updateErr } = await supabase
        .from("articles")
        .update({ featured_image_url: url, featured_image_alt: alt })
        .eq("id", article.id);

      if (updateErr) {
        console.log(`✗ DB error: ${updateErr.message}`);
        failed++;
      } else {
        console.log(`✓`);
        updated++;
      }
    } else {
      console.log(`– no result`);
      failed++;
    }

    // Respect Unsplash free tier (50 req/hr) — 1.5s gap = ~40 req/min
    if (i < articles.length - 1) await sleep(1500);
  }

  console.log(`
╔══════════════════════════════╗
║      Images Complete         ║
╠══════════════════════════════╣
║  Updated : ${String(updated).padEnd(19)}║
║  Failed  : ${String(failed).padEnd(19)}║
╚══════════════════════════════╝`);
}

run().catch((e) => { console.error(e); process.exit(1); });
