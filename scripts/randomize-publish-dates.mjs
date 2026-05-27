/**
 * scripts/randomize-publish-dates.mjs
 *
 * Sets a unique random published_at date (within the last 30 days) for every article.
 * Run: node scripts/randomize-publish-dates.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local into process.env
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

function randomDateInPast30Days() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const randomMs = Math.floor(Math.random() * thirtyDaysMs);
  return new Date(now - randomMs).toISOString();
}

async function main() {
  // Fetch all article IDs
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, slug")
    .order("id");

  if (error) {
    console.error("Failed to fetch articles:", error.message);
    process.exit(1);
  }

  console.log(`Found ${articles.length} articles. Updating published_at…\n`);

  let updated = 0;
  let failed = 0;

  for (const article of articles) {
    const newDate = randomDateInPast30Days();
    const { error: updateError } = await supabase
      .from("articles")
      .update({ published_at: newDate })
      .eq("id", article.id);

    if (updateError) {
      console.error(`  ✗ [${article.id}] ${article.slug ?? "(no slug)"} — ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✓ [${article.id}] ${article.slug ?? "(no slug)"} → ${newDate}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}  Failed: ${failed}`);
}

main();
