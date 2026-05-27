import { createClient } from "@/lib/supabase/server";
import { callClaudeJSON } from "@/lib/anthropic";

const SYSTEM = `You are a knowledgeable friend who has worked as a licensed veterinarian for 20 years. You speak plainly, with zero jargon. You genuinely love animals and care about the people who care for them. You give honest, practical, science-backed guidance — not vague reassurances. You always meet people where they are, whether they have a new kitten or a senior dog, and you help them find exactly what they need to read next.`;

interface ArticleRow {
  h1_title: string;
  content_type: string;
  meta_description: string | null;
  core_id: string;
  bridge_id: string;
  slug: string;
}

interface RecommendedArticle {
  title: string;
  content_type: string;
  core_id: string;
  bridge_id: string;
  slug: string;
  reason: string;
}

interface JourneyResult {
  assessment: string;
  articles: RecommendedArticle[];
}

export async function POST(req: Request) {
  const { answers } = await req.json();

  const supabase = createClient();

  const { data: articles } = await supabase
    .from("articles")
    .select("h1_title, content_type, meta_description, core_id, bridge_id, slug")
    .eq("status", "published")
    .limit(60);

  const articleList = ((articles as ArticleRow[]) ?? [])
    .map(
      (a, i) =>
        `[${i + 1}] "${a.h1_title}" (type: ${a.content_type}, path: /${a.core_id}/${a.bridge_id}/${a.slug})${a.meta_description ? ` — ${a.meta_description}` : ""}`
    )
    .join("\n");

  const answersText = Object.entries(answers as Record<string, string>)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n");

  const userPrompt = `A pet owner just answered 5 questions about their pet care situation. Here are their answers:

${answersText}

Here is the full list of published articles on the site:

${articleList}

Based on their answers:

1. Write a short personalized assessment (2–3 sentences, plain English, warm but honest tone). Acknowledge what type of pet owner they are and what they're dealing with, and name one specific thing they should focus on next. Do not use bullet points — just clear, caring prose.

2. Choose exactly 3 articles from the list above that are the most relevant to this specific person's pet, life stage, and concerns. For each article, write a 1-sentence reason why it was chosen for them specifically (not generic — reference their actual pet situation from the answers).

Return ONLY valid JSON in this exact shape, no markdown fences:
{
  "assessment": "string",
  "articles": [
    {
      "title": "string (exact h1_title from the list)",
      "content_type": "string",
      "core_id": "string",
      "bridge_id": "string",
      "slug": "string",
      "reason": "string"
    }
  ]
}`;

  try {
    const result = await callClaudeJSON<JourneyResult>(SYSTEM, userPrompt, 1200);

    if (!result.assessment || !Array.isArray(result.articles)) {
      throw new Error("Invalid response shape from Claude");
    }

    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
