import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";

interface CompleteRequest {
  term: string;
  description?: string;
  examples?: string[];
  resources?: { title: string; url: string }[];
  meta_title?: string;
  meta_description?: string;
  og_title?: string;
  og_description?: string;
  industry?: string;
}

interface CompletedTerm {
  description: string;
  examples: string[];
  resources: { title: string; url: string }[];
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CompleteRequest = await req.json();
    const { term, industry = "the industry" } = body;
    if (!term?.trim()) {
      return NextResponse.json({ error: "term is required" }, { status: 400 });
    }

    const alreadyFilled: string[] = [];
    if (body.description?.trim()) alreadyFilled.push(`description: "${body.description}"`);
    if (body.examples?.length) alreadyFilled.push(`examples: ${JSON.stringify(body.examples)}`);
    if (body.resources?.length) alreadyFilled.push(`resources: ${JSON.stringify(body.resources)}`);
    if (body.meta_title?.trim()) alreadyFilled.push(`meta_title: "${body.meta_title}"`);
    if (body.meta_description?.trim()) alreadyFilled.push(`meta_description: "${body.meta_description}"`);
    if (body.og_title?.trim()) alreadyFilled.push(`og_title: "${body.og_title}"`);
    if (body.og_description?.trim()) alreadyFilled.push(`og_description: "${body.og_description}"`);

    const system = `You are an expert SEO content strategist specialising in glossary content for ${industry}.
You produce structured JSON that is immediately usable — no markdown fences, no extra commentary.`;

    const user = `Complete the following glossary term entry for a ${industry} website.
Term: "${term}"
${alreadyFilled.length ? `\nAlready provided fields (keep them exactly as-is, do not change):\n${alreadyFilled.join("\n")}` : ""}

Return a single JSON object with ALL of the following fields filled in (preserve any already-provided values exactly):
- "description": 2-3 sentence plain-text definition suitable for a general audience
- "examples": array of 2-3 short plain-text example sentences showing the term in context
- "resources": array of 1-2 objects with "title" (descriptive link text) and "url" (a plausible authoritative URL)
- "meta_title": SEO title tag (50-60 characters, include the term)
- "meta_description": SEO meta description (140-155 characters, compelling and includes the term)
- "og_title": Open Graph title (can match meta_title or be slightly more engaging)
- "og_description": Open Graph description (can match meta_description or be slightly more engaging)

Return only the JSON object.`;

    const completed = await callClaudeJSON<CompletedTerm>(system, user, 2000);

    // Merge: preserve already-provided values
    const result = {
      description: body.description?.trim() || completed.description,
      examples: body.examples?.length ? body.examples : completed.examples,
      resources: body.resources?.length ? body.resources : completed.resources,
      meta_title: body.meta_title?.trim() || completed.meta_title,
      meta_description: body.meta_description?.trim() || completed.meta_description,
      og_title: body.og_title?.trim() || completed.og_title,
      og_description: body.og_description?.trim() || completed.og_description,
    };

    return NextResponse.json({ completed: result });
  } catch (err: unknown) {
    console.error("[glossary/complete]", err);
    const msg = err instanceof Error ? err.message : "AI completion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
