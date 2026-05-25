import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic";
import { getSiteConfig, cfg } from "@/lib/site-config";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id } = body as { type: "core" | "bridge"; id: string };

    if (!type || !id) {
      return NextResponse.json({ error: "type and id required" }, { status: 400 });
    }
    if (type !== "core" && type !== "bridge") {
      return NextResponse.json({ error: "type must be 'core' or 'bridge'" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const config = await getSiteConfig();
    const industry = cfg(config, "site_name") || process.env.NEXT_PUBLIC_INDUSTRY_NAME || "this industry";

    let keyword: string;
    let parentKeyword: string | null = null;

    if (type === "core") {
      const { data, error } = await supabase
        .from("core_keywords")
        .select("keyword")
        .eq("id", id)
        .single();
      if (error || !data) return NextResponse.json({ error: "core keyword not found" }, { status: 404 });
      keyword = data.keyword;
    } else {
      const { data, error } = await supabase
        .from("bridge_keywords")
        .select("keyword, core_keywords(keyword)")
        .eq("id", id)
        .single();
      if (error || !data) return NextResponse.json({ error: "bridge keyword not found" }, { status: 404 });
      keyword = data.keyword;
      const ck = data.core_keywords as { keyword?: string } | null;
      parentKeyword = ck?.keyword ?? null;
    }

    const context = parentKeyword
      ? `This is a sub-topic page about "${keyword}" under the broader topic "${parentKeyword}".`
      : `This is a top-level topic page about "${keyword}".`;

    const prompt = `Write a concise SEO-optimized category page description (2–3 paragraphs, 200–350 words) for the following topic.

Context: ${context}
Site industry: ${industry}

The description will appear at the top of a category landing page that lists expert articles on this topic. Write in a clear, informative, third-person tone. Do not use the phrase "this page" or "this category". Avoid bullet points. Avoid marketing fluff. Focus on what readers will learn and why the topic matters.

Return only the description text — no headings, no preamble, no markdown formatting.`;

    const description = await callClaude(
      "You are a professional content writer specialising in informational web content.",
      prompt,
      600
    );

    if (!description?.trim()) {
      return NextResponse.json({ error: "Claude returned empty response" }, { status: 500 });
    }

    const table = type === "core" ? "core_keywords" : "bridge_keywords";
    const { error: updateError } = await supabase
      .from(table)
      .update({ description: description.trim() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ description: description.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
