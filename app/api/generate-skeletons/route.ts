import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { validateSnakeCase, validateSlug } from "@/lib/slugify";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = request.nextUrl.searchParams.get("id");
    const clusterId = request.nextUrl.searchParams.get("cluster_id");

    if (clusterId) {
      const { error } = await supabase.from("article_skeletons").delete().eq("cluster_id", clusterId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "id or cluster_id required" }, { status: 400 });
    const { error } = await supabase.from("article_skeletons").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}

const SYSTEM_PROMPT = `You are a senior SEO content strategist. Generate article brief skeletons for a content cluster. Return ONLY a valid JSON array, no preamble, no markdown fences.`;

interface SkeletonInput {
  article_id: string;
  content_type: string;
  is_core_article: boolean;
  primary_keyword: string;
  slug: string;
  h1_suggestion: string;
  meta_title: string;
  meta_description: string;
  key_messages: string[];
  suggested_word_count_min: number;
  suggested_word_count_max: number;
  schema_type: string;
  internal_link_targets: Array<{
    article_id: string;
    slug: string;
    anchor_phrase: string;
    direction: string;
  }>;
  external_link_suggestions: Array<{ url: string; context: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Save action
    if (body.action === "save") {
      const { cluster_db_id, skeletons } = body;
      const supabase = createServiceClient();

      const inserts = (skeletons as SkeletonInput[]).map((s) => {
        if (!validateSnakeCase(s.article_id)) {
          throw new Error(`invalid article_id: ${s.article_id}`);
        }
        if (!validateSlug(s.slug)) {
          throw new Error(`invalid slug: ${s.slug}`);
        }
        return {
          cluster_id: cluster_db_id,
          article_id: s.article_id,
          content_type: s.content_type,
          is_core_article: s.is_core_article,
          primary_keyword: s.primary_keyword,
          slug: s.slug,
          h1_suggestion: s.h1_suggestion,
          meta_title: s.meta_title,
          meta_description: s.meta_description,
          key_messages: s.key_messages,
          suggested_word_count_min: s.suggested_word_count_min,
          suggested_word_count_max: s.suggested_word_count_max,
          schema_type: s.schema_type,
          internal_link_targets: s.internal_link_targets,
          external_link_suggestions: s.external_link_suggestions,
          status: "skeleton",
        };
      });

      // Enforce one skeleton per content_type per cluster.
      const typeSeen = new Set<string>();
      for (const s of inserts) {
        if (typeSeen.has(s.content_type)) {
          return NextResponse.json(
            { error: `Duplicate content_type in brief batch: ${s.content_type}. Each type may appear only once per cluster.` },
            { status: 400 }
          );
        }
        typeSeen.add(s.content_type);
      }

      // Delete existing skeletons for this cluster only, then insert fresh.
      // Using upsert on article_id was unsafe — article_ids across clusters can
      // collide if Claude abbreviates two different cluster names the same way,
      // silently overwriting the other cluster's briefs.
      const { error: delError } = await supabase
        .from("article_skeletons")
        .delete()
        .eq("cluster_id", cluster_db_id);

      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

      const { error } = await supabase
        .from("article_skeletons")
        .insert(inserts);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Generate single skeleton (new per-skeleton approach)
    if (body.action === "generate_one") {
      const { system_prompt, user_prompt } = body;
      if (!system_prompt || !user_prompt) {
        return NextResponse.json({ error: "system_prompt and user_prompt required" }, { status: 400 });
      }
      const skeleton = await callClaudeJSON<SkeletonInput>(system_prompt, user_prompt, 2000);
      return NextResponse.json({ skeleton });
    }

    // Legacy: generate all at once (kept for backwards compatibility)
    const {
      cluster_id,
      core_keyword,
      core_id,
      bridge_keyword,
      bridge_id,
      type_breakdown,
      total_count,
      resources,
      industry_name,
    } = body;

    const resourceList = (resources as Array<{ url?: string | null; title?: string | null }>)
      ?.map((r) => r.url ?? r.title ?? "")
      .filter(Boolean)
      .join(", ") ?? "none";

    const userPrompt = `Generate ${total_count} article skeletons for this cluster.

Industry: ${industry_name}
Core Keyword: ${core_keyword} (core_id: ${core_id})
Bridge Keyword: ${bridge_keyword} (bridge_id: ${bridge_id})
Cluster ID: ${cluster_id}
Resources / Competitor Domains to reference: ${resourceList}

Article types requested:
${type_breakdown}

Rules:
- article_id: all lowercase snake_case, format {cluster_id}_{type_abbrev}_{zero_padded_index}
- slug: all lowercase kebab-case
- Every article must have at minimum: one link up to bridge, one link up to core, two sibling links (if siblings exist)
- key_messages: 3–5 specific, factual points this article must make — no generics
- Generate ALL skeletons in one response as a JSON array`;

    const skeletons = await callClaudeJSON<SkeletonInput[]>(SYSTEM_PROMPT, userPrompt, 8000);
    return NextResponse.json({ skeletons });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
