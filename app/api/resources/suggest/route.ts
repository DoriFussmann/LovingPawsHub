import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";

interface SuggestedResource {
  url: string;
  title: string;
  notes: string;
}

const SYSTEM_PROMPT = `You are an SEO research assistant. When given an industry, return a JSON array of 12–16 highly relevant websites: competitor domains, authoritative reference sites, industry associations, government/regulatory bodies, and leading publications. Return ONLY a valid JSON array, no preamble, no markdown fences.`;

export async function POST(request: NextRequest) {
  try {
    const { industry_name } = await request.json();
    if (!industry_name) {
      return NextResponse.json({ error: "industry_name required" }, { status: 400 });
    }

    const userPrompt = `Industry: ${industry_name}

Suggest 12–16 websites that would be valuable reference resources for an SEO content site in this industry. Include a mix of:
- Top competitor domains (sites ranking for industry keywords)
- Authoritative industry publications or blogs
- Government or regulatory bodies (if applicable)
- Industry associations or trade bodies
- Data/statistics sources

For each, return exactly this JSON structure:
{
  "url": "https://example.com",
  "title": "Site Name — short descriptor",
  "notes": "1–2 sentence note on why this is relevant and how to reference it"
}

Return a JSON array of these objects.`;

    const suggestions = await callClaudeJSON<SuggestedResource[]>(SYSTEM_PROMPT, userPrompt, 4000);

    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
