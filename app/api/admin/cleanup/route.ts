import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

const SCOPES = [
  "articles",
  "skeletons",
  "clusters",
  "bridges",
  "cores",
  "resources",
  "glossary",
  "site_settings",
  "general_controls",
  "everything_keep_controls",
  "everything",
] as const;

type Scope = (typeof SCOPES)[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope } = body as { scope: Scope };

    if (!SCOPES.includes(scope)) {
      return NextResponse.json({ error: "invalid scope" }, { status: 400 });
    }

    const supabase = createServiceClient();

    switch (scope) {
      case "articles": {
        const { error } = await supabase.from("articles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "skeletons": {
        // Cascades to articles via FK
        const { error } = await supabase.from("article_skeletons").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "clusters": {
        // Cascades to skeletons → articles
        const { error } = await supabase.from("clusters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "bridges": {
        // Cascades to clusters → skeletons → articles
        const { error } = await supabase.from("bridge_keywords").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "cores": {
        // Cascades to bridges → clusters → skeletons → articles
        const { error } = await supabase.from("core_keywords").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "resources": {
        const { error } = await supabase.from("resources").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "glossary": {
        const { error } = await supabase.from("glossary_terms").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "site_settings": {
        // Delete the singleton site_config row
        const { error } = await supabase.from("site_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "general_controls": {
        // Delete all stored prompt configs and scoring weights — falls back to code defaults on next load
        const controlKeys = ["skeleton_prompts", "article_prompts", "core_article_prompts", "scoring_weights"];
        const { error } = await supabase.from("settings").delete().in("key", controlKeys);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        break;
      }
      case "everything_keep_controls":
      case "everything": {
        // Delete industry row — cascades all content tables via FK
        const { error } = await supabase.from("industry").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Also wipe site_config and glossary_terms (not FK-linked to industry)
        await supabase.from("site_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("glossary_terms").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        // Wipe general controls unless the caller wants to keep them
        if (scope === "everything") {
          const controlKeys = ["skeleton_prompts", "article_prompts", "core_article_prompts", "scoring_weights"];
          await supabase.from("settings").delete().in("key", controlKeys);
        }

        // Clear NEXT_PUBLIC_INDUSTRY_NAME from the env file.
        // Check .env.local first (Next.js convention), then fall back to .env.
        try {
          const candidates = [".env.local", ".env"];
          for (const name of candidates) {
            const envPath = path.join(process.cwd(), name);
            if (fs.existsSync(envPath)) {
              const content = fs.readFileSync(envPath, "utf-8");
              if (/^NEXT_PUBLIC_INDUSTRY_NAME=/m.test(content)) {
                const updated = content.replace(
                  /^NEXT_PUBLIC_INDUSTRY_NAME=.*/m,
                  "NEXT_PUBLIC_INDUSTRY_NAME="
                );
                fs.writeFileSync(envPath, updated, "utf-8");
                break; // done — only write one file
              }
            }
          }
        } catch {
          // Non-fatal — DB is already cleared
        }
        break;
      }
    }

    return NextResponse.json({ success: true, scope });
  } catch (e) {
    console.error("[/api/admin/cleanup]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
