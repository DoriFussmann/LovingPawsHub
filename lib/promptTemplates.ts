export interface PromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
  typeAddons: Record<string, string>;
}

// ── Writing style variants ────────────────────────────────────────────────────
// Injected as {{writing_style}} in the article system prompt.
// Rotate or pick randomly at generation time to vary prose texture.

export const WRITING_STYLES = {
  DATA_FORWARD: `DATA-FORWARD style: Open every section with a concrete statistic, finding, or named example. Build arguments from evidence up to conclusion — never lead with opinion then hunt for support. Cite real numbers and name specific sources, studies, or organisations where possible.`,
  EXPERT_PRACTITIONER: `EXPERT PRACTITIONER style: Write from the perspective of a working professional who has seen this first-hand. Use phrases like "In practice...", "What actually happens is...", "The mistake most people make here is...". State clear, opinionated recommendations and justify them. First-person plural ("We've seen", "Our experience shows") is acceptable.`,
  ANALYTICAL: `ANALYTICAL style: State the conclusion first, then justify it. Structure each section as: diagnosis → evidence → recommendation. Use a comparison table at least once where it clarifies choices. Avoid hedging — if the evidence points somewhere, say so directly.`,
} as const;

export type WritingStyleKey = keyof typeof WRITING_STYLES;

/** Pick a writing style deterministically based on a seed string (e.g. article_id). */
export function pickWritingStyle(seed: string): WritingStyleKey {
  const keys = Object.keys(WRITING_STYLES) as WritingStyleKey[];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return keys[hash % keys.length];
}

const ANTI_AI_TEXTURE_RULES = `
ANTI-PATTERN RULES — never use these:
- Do not open with "In today's...", "In the modern era...", "In an increasingly...", or "It's important to note..."
- Do not start a conclusion with "In conclusion", "To summarize", or "Overall"
- Never write "X is a crucial aspect of Y" without immediately proving why with data or an example
- Every claim needs a specific number, a named organisation, or a concrete before/after example
- At least one section must contain a clear editorial recommendation: state what the reader should do and why
- No padding phrases: "delve into", "it goes without saying", "needless to say", "at the end of the day"`;

export const DEFAULT_TYPE_ADDONS: Record<string, string> = {
  CORE: `This is a PILLAR article — the most authoritative and comprehensive piece in the cluster. Cover the topic exhaustively (2,500–4,000 words). Include a rich table of contents. Link out to every sibling article in the cluster. This article should single-handedly establish topical authority for the entire cluster. It is the article Google should rank for the broadest version of the bridge keyword.`,

  HUB: `This is a HUB article — a short cluster index page (500–800 words MAX). Do NOT write a comprehensive guide or cover the topic in depth. Structure: one brief intro paragraph (2–3 sentences only), then one H2 section per sibling article in the cluster (GUIDE, FAQ, COMPARISON, RISK). Each H2 section: 2–3 sentences summarising what that sibling covers and who it is for, with a direct internal link to it. Close with a single short "next steps" paragraph. Every section must reference a specific sibling — no standalone content. schema_type: "Article".`,

  FAQ: `This is a FAQ article. Answer 8–12 specific questions users are actively searching for around this keyword. Each question is an H2. Answers: 50–150 words each, direct and scannable. Use schema_type "FAQPage". Optimise for featured snippets and People Also Ask. Avoid filler — every Q&A must answer something real.`,

  COMPARISON: `This is a COMPARISON article (1,000–1,500 words). Compare 3–5 concrete options, products, services, or approaches side by side. Include a comparison table as a key content element. Close with a clear, opinionated recommendation section. Tone: balanced and genuinely helpful — not salesy.`,

  RISK: `This is a RISK article (800–1,200 words). Address concerns, pitfalls, mistakes to avoid, red flags, and what can go wrong. Tone: educational and cautious, never alarmist. The reader has anxiety or uncertainty — meet them there and resolve it. Make each risk specific and actionable ("avoid X because Y, instead do Z").`,

  GUIDE: `This is a GUIDE article (1,200–1,800 words). Step-by-step, actionable, process-oriented. Number each step clearly. Include what to expect at each stage and common mistakes per step. Users want to DO something — make every paragraph earn its place. Scannable H2s per step.`,
};

export const TYPE_ABBREV: Record<string, string> = {
  CORE: "core",
  HUB: "hub",
  FAQ: "faq",
  COMPARISON: "comp",
  RISK: "risk",
  GUIDE: "guide",
};

export const DEFAULT_SYSTEM_PROMPT =
`You are a senior SEO content strategist. Generate ONE article brief skeleton. Return ONLY a valid JSON object — no preamble, no markdown fences, no explanation. Begin with { and end with }.

The current year is {{current_year}}. Never include a specific year in meta_title or h1_suggestion unless the content directly covers that year's data.

{{type_addon}}`;

export const DEFAULT_USER_PROMPT_TEMPLATE =
`Generate a {{content_type}} skeleton for this content cluster.

Industry: {{industry_name}}
Core Keyword: {{core_keyword}}
Bridge Keyword: {{bridge_keyword}}
Cluster ID: {{cluster_id}}
Article position: {{article_index}} of {{type_count}} {{content_type}} articles in this cluster
Resources / competitor domains (use for external_link_suggestions): {{resources}}

Return this exact JSON structure (one object, not an array):
{
  "article_id": "{{cluster_id}}_{{type_abbrev}}_{{zero_padded_index}}",
  "content_type": "{{content_type}}",
  "is_core_article": {{is_core_article}},
  "primary_keyword": "string — exact target search phrase",
  "slug": "string — kebab-case from primary_keyword",
  "h1_suggestion": "string — no year unless content is year-specific",
  "meta_title": "string — max 38 chars, keyword-first. CRITICAL: the site appends '| Site Name' making the full SERP title ~60 chars total. Staying under 38 chars is mandatory. No year unless content is year-specific.",
  "meta_description": "string — max 155 chars, benefit-driven",
  "key_messages": ["3–5 specific, factual points this article must make — no generic filler"],
  "suggested_word_count_min": number,
  "suggested_word_count_max": number,
  "schema_type": "Article|FAQPage|Product",
  "external_link_suggestions": [
    { "url": "string", "context": "why this is relevant to link to" }
  ]
}

Rules:
- article_id: all lowercase snake_case
- slug: all lowercase kebab-case
- meta_title: HARD LIMIT 38 chars — this is non-negotiable
- key_messages: specific and factual — no generics like "provide value" or "help the user"`;

// ── Article writer prompts ────────────────────────────────────────────────────

export interface ArticlePromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
}

export const DEFAULT_ARTICLE_SYSTEM_PROMPT =
`You are an elite content writer and SEO specialist. Write a complete, publication-ready article. Return ONLY a single valid JSON object, no preamble, no markdown fences. Begin with '{' and end with '}'.

The current year is {{current_year}}. Never include a specific year in meta_title or h1_title unless the content directly covers that year's data. If year context is needed in the body, use {{current_year}}.

WRITING STYLE FOR THIS ARTICLE:
{{writing_style}}
${ANTI_AI_TEXTURE_RULES}`;

export const DEFAULT_ARTICLE_USER_PROMPT_TEMPLATE =
`Write a full article for this skeleton brief.

SKELETON BRIEF:
{{skeleton_json}}

INDUSTRY CONTEXT:
Industry: {{industry_name}}
Core Keyword: {{core_keyword}}
Bridge Keyword: {{bridge_keyword}}
Authoritative resources to reference where relevant: {{resources}}

PUBLISHED SIBLING ARTICLES (for internal linking context):
{{siblings}}

CRITICAL WRITING RULES:
1. Every key_message listed in the skeleton brief MUST be explicitly addressed in the article body — treat them as mandatory editorial checkboxes
2. Minimum word count: {{word_count_min}} words — do not cut short
3. Use H2 and H3 headings throughout
4. Include relevant external links as markdown links using external_link_suggestions
5. No AI fluff, no generic intros — dense, specific, expert-level prose from the first sentence
6. Use double asterisks sparingly for genuinely critical terms only
7. Do NOT add any internal links — internal linking is handled separately after all articles are published

OUTPUT — return this exact JSON structure:
{
  "article_id": "{{article_id}}",
  "h1_title": "string — no year unless content is year-specific",
  "table_of_contents": [{ "heading_level": "h2", "text": "string", "anchor": "string" }],
  "body_markdown": "string — full article in Markdown, no internal links",
  "meta_title": "string — HARD LIMIT 38 chars (site appends '| Site Name' for ~60 total). Keyword-first. No year unless year-specific.",
  "meta_description": "string — max 155 chars, benefit-driven",
  "og_title": "string",
  "og_description": "string",
  "schema_type": "{{schema_type}}",
  "schema_markup": { "@context": "https://schema.org", "@type": "{{schema_type}}" },
  "key_highlights": ["string — 3-7 concise bullet points, one sentence each, covering the most important takeaways a reader should remember"],
  "related_articles": [{ "article_id": "string", "title": "string", "slug": "string" }],
  "external_links": [{ "url": "string", "anchor": "string" }]
}`;

export function defaultArticleConfig(): ArticlePromptConfig {
  return {
    systemPrompt: DEFAULT_ARTICLE_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_ARTICLE_USER_PROMPT_TEMPLATE,
  };
}

// ── Core article prompts ──────────────────────────────────────────────────────

export interface CoreArticlePromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
}

export const DEFAULT_CORE_ARTICLE_SYSTEM_PROMPT =
`You are an elite content writer and SEO specialist creating comprehensive pillar content. Write a complete, publication-ready authoritative article that establishes topical authority for the entire topic. Return ONLY a single valid JSON object, no preamble, no markdown fences. Begin with '{' and end with '}'.

The current year is {{current_year}}. Never include a specific year in meta_title or h1_title unless the content directly covers that year's data. If year context is needed in the body, use {{current_year}}.

WRITING STYLE FOR THIS ARTICLE:
{{writing_style}}
${ANTI_AI_TEXTURE_RULES}`;

export const DEFAULT_CORE_ARTICLE_USER_PROMPT_TEMPLATE =
`Write a comprehensive pillar article for this core topic.

CORE TOPIC: {{core_keyword}}
INDUSTRY: {{industry_name}}
H1 TITLE: {{h1_title}}
TARGET WORD COUNT: {{word_count}} words
ADDITIONAL NOTES: {{notes}}

RELATED SUBTOPICS (for comprehensive coverage — use these to structure the article's scope):
{{related_topics}}

AUTHORITATIVE RESOURCES TO REFERENCE WHERE RELEVANT:
{{resources}}

CRITICAL WRITING RULES:
1. This is a PILLAR article — the most authoritative, comprehensive piece on this core topic
2. Minimum {{word_count}} words — cover the topic exhaustively
3. Use H2 and H3 headings throughout for scannability
4. Include relevant external links as markdown links using the resources provided
5. No AI fluff, no generic intros — dense, specific, expert-level prose from the first sentence
6. Do NOT add any internal links — internal linking is handled separately after publishing

OUTPUT — return this exact JSON structure:
{
  "article_id": "{{article_id}}",
  "h1_title": "string — no year unless content is year-specific",
  "table_of_contents": [{ "heading_level": "h2", "text": "string", "anchor": "string" }],
  "body_markdown": "string — full article in Markdown, no internal links",
  "meta_title": "string — HARD LIMIT 38 chars (site appends '| Site Name' for ~60 total). Keyword-first. No year unless year-specific.",
  "meta_description": "string — max 155 chars, benefit-driven",
  "og_title": "string",
  "og_description": "string",
  "schema_type": "Article",
  "schema_markup": { "@context": "https://schema.org", "@type": "Article" },
  "key_highlights": ["string — 3-7 concise bullet points, one sentence each, covering the most important takeaways a reader should remember"],
  "related_articles": [],
  "external_links": [{ "url": "string", "anchor": "string" }]
}`;

export function defaultCoreArticleConfig(): CoreArticlePromptConfig {
  return {
    systemPrompt: DEFAULT_CORE_ARTICLE_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_CORE_ARTICLE_USER_PROMPT_TEMPLATE,
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export const SKELETON_SETTINGS_KEY = "skeleton_prompts";
export const ARTICLE_SETTINGS_KEY = "article_prompts";
export const CORE_ARTICLE_SETTINGS_KEY = "core_article_prompts";

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function defaultConfig(): PromptConfig {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
    typeAddons: { ...DEFAULT_TYPE_ADDONS },
  };
}

// Save to DB via API (client-side)
export async function saveSettingsToDB(key: string, value: unknown): Promise<void> {
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}
