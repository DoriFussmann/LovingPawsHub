import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let envPath = join(root, ".env.local");
try { readFileSync(envPath); } catch { envPath = join(root, ".env"); }
console.log("Loading env from:", envPath);
const envContent = readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
  if (match) process.env[match[1]] = match[2].trim();
});
console.log("URL set:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY set:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tables = ["industry", "core_keywords", "bridge_keywords", "clusters", "article_skeletons", "articles"];
for (const t of tables) {
  const { data, error } = await sb.from(t).select("id").limit(1);
  if (error) {
    console.log(`  ✗ ${t}: ${error.message}`);
  } else {
    console.log(`  ✓ ${t}: exists (${data.length} row sampled)`);
  }
}
