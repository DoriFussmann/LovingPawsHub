import { NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";

export interface EditorialStandardSuggestion {
  title: string;
  body: string;
}

export interface SiteConfigSuggestions {
  site_name: string;
  site_description: string;
  industry_name: string;
  homepage_title: string;
  homepage_headline: string;
  homepage_subheadline: string;
  hero_body_text: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  twitter_handle: string;
  about_text: string;
  footer_copyright: string;
  homepage_about_headline: string;
  homepage_about_text: string;
  logo_banner_text: string;
  about_editorial_standards: EditorialStandardSuggestion[];
}

const SYSTEM = `You are a copywriter and SEO specialist helping configure a content website.
Given a plain-English description of the site, return a JSON object with copy for all fields.
Be concise, brand-appropriate, and SEO-friendly. Do not wrap the JSON in markdown fences.`;

function buildPrompt(description: string): string {
  return `Site description: "${description}"

Return a JSON object with EXACTLY these keys:

site_name                    — short brand name (2–4 words, title case)
industry_name                — the industry in plain lowercase words (e.g. "legal services", "personal finance")
site_description             — default meta description (140–160 characters, sentence case)
homepage_title               — <title> tag for the homepage (50–60 chars, may differ from site_name)
homepage_headline            — H1 hero heading (2–5 words, lowercase, no punctuation)
homepage_subheadline         — one-line subheadline below the H1 (lowercase, concise)
hero_body_text               — 1–2 sentence marketing paragraph below the subheadline describing what the site covers (lowercase, professional, mention depth and clarity)
hero_cta_primary             — label for the primary CTA button (3–5 words, e.g. "read the guide", "explore articles")
hero_cta_secondary           — label for the secondary CTA button (2–4 words, e.g. "browse articles", "view topics")
twitter_handle               — suggested @handle without the @ symbol (no spaces, lowercase)
about_text                   — mission paragraph for the /about page (2–3 sentences, professional tone). Use {SITE_NAME} and {INDUSTRY_NAME} as placeholders.
footer_copyright             — short name for the © copyright line (usually same as site_name)
homepage_about_headline      — 5–10 word headline for the "who we are" section on the homepage (lowercase, no punctuation)
homepage_about_text          — 2–3 sentence description of the team/editorial approach for the homepage (professional, human tone)
logo_banner_text             — short trust/tagline line shown below the hero (e.g. "trusted by professionals in X worldwide", max 12 words)
about_editorial_standards    — JSON array of exactly 3 objects with keys "title" (string) and "body" (1–2 sentences). These are the editorial principles shown on the about page (e.g. Independence, Accuracy, Currency — but tailored to the site's industry).

Return ONLY the JSON object.`;
}

export async function POST(request: Request) {
  try {
    const { description } = await request.json();
    if (!description?.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const suggestions = await callClaudeJSON<SiteConfigSuggestions>(
      SYSTEM,
      buildPrompt(description.trim()),
      1500
    );

    // Ensure all string fields are present
    const stringRequired: (keyof Omit<SiteConfigSuggestions, "about_editorial_standards">)[] = [
      "site_name",
      "site_description",
      "industry_name",
      "homepage_title",
      "homepage_headline",
      "homepage_subheadline",
      "hero_body_text",
      "hero_cta_primary",
      "hero_cta_secondary",
      "twitter_handle",
      "about_text",
      "footer_copyright",
      "homepage_about_headline",
      "homepage_about_text",
      "logo_banner_text",
    ];
    for (const key of stringRequired) {
      if (typeof suggestions[key] !== "string") suggestions[key] = "";
    }

    // Ensure editorial_standards is a valid array
    if (!Array.isArray(suggestions.about_editorial_standards)) {
      suggestions.about_editorial_standards = [];
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
