import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { toKebabCase } from "@/lib/slugify";

interface SuggestedTerm {
  term: string;
  slug: string;
  description: string;
  examples: string[];
  resources: { title: string; url: string }[];
  meta_title: string;
  meta_description: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const existingTerms: string[] = body.existingTerms ?? [];
    const industry: string = body.industry ?? "the industry";

    const system = `You are an expert SEO content strategist specialising in glossary content for ${industry}.
You produce structured JSON that is immediately usable — no markdown fences, no extra commentary.`;

    const exclusion = existingTerms.length
      ? `Do NOT suggest any of these already-existing terms: ${existingTerms.join(", ")}.`
      : "";

    const user = `Generate exactly 5 new glossary term entries for a ${industry} website.
${exclusion}

Return a JSON array of exactly 5 objects. Each object must have these fields:
- "term": clear, concise term name (2-5 words max)
- "slug": kebab-case URL slug derived from the term
- "description": 2-3 sentence plain-text definition, suitable for a general audience
- "examples": array of 2-3 short plain-text example sentences showing the term in context
- "resources": array of 1-2 objects with "title" (descriptive link text) and "url" (a plausible authoritative URL for this topic)
- "meta_title": SEO title tag (50-60 characters, include the term)
- "meta_description": SEO meta description (140-155 characters, compelling and includes the term)

Return only the JSON array.`;

    const suggestions = await callClaudeJSON<SuggestedTerm[]>(system, user, 4000);

    // Normalise slugs to ensure they are valid kebab-case
    const normalised = suggestions.map((s) => ({
      ...s,
      slug: s.slug ? toKebabCase(s.slug) : toKebabCase(s.term),
    }));

    return NextResponse.json({ suggestions: normalised });
  } catch (err: unknown) {
    console.error("[glossary/suggest]", err);
    const msg = err instanceof Error ? err.message : "AI suggestion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
