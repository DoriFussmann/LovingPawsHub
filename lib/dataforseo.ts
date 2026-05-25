import { toKebabCase } from "./slugify";

const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

function getAuthHeader(): string {
  const credentials = `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export interface KeywordResult {
  keyword: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number;
  trend: number[];
  suggested_id: string;
  // Extended fields
  competition: number;           // 0–1 organic competition index
  competition_level: string;     // "LOW" | "MEDIUM" | "HIGH"
  search_intent: string;         // "informational" | "commercial" | "transactional" | "navigational"
  cps: number;                   // clicks per search
}

export interface CompetitorResult {
  domain: string;
  estimated_traffic: number;
  avg_position: number;
}

function parseKeywordResults(data: Record<string, unknown>): KeywordResult[] {
  try {
    const tasks = data.tasks as Array<{ result: Array<{ items: Array<Record<string, unknown>> }> }>;
    const items = tasks?.[0]?.result?.[0]?.items ?? [];
    return items.map((item) => {
      const metrics = item.keyword_info as Record<string, unknown> | undefined;
      const props = item.keyword_properties as Record<string, unknown> | undefined;
      const intent = item.search_intent_info as Record<string, unknown> | undefined;

      const monthlySearches = (
        (metrics?.monthly_searches as Array<{ search_volume: number }>) ?? []
      )
        .slice(0, 12)
        .map((m) => m.search_volume ?? 0);

      const competition = (metrics?.competition as number) ?? 0;
      const competitionLevel = competition < 0.33
        ? "LOW"
        : competition < 0.67
        ? "MEDIUM"
        : "HIGH";

      return {
        keyword: (item.keyword as string) ?? "",
        search_volume: (metrics?.search_volume as number) ?? 0,
        cpc: (metrics?.cpc as number) ?? 0,
        keyword_difficulty: (props?.keyword_difficulty as number) ?? 0,
        trend: monthlySearches,
        suggested_id: toKebabCase((item.keyword as string) ?? ""),
        competition,
        competition_level: (metrics?.competition_level as string) ?? competitionLevel,
        search_intent: (intent?.main_intent as string) ?? "informational",
        cps: (metrics?.cps as number) ?? 1,
      };
    });
  } catch {
    return [];
  }
}

function parseCompetitorResults(data: Record<string, unknown>): CompetitorResult[] {
  try {
    const tasks = data.tasks as Array<{ result: Array<{ items: Array<Record<string, unknown>> }> }>;
    const items = tasks?.[0]?.result?.[0]?.items ?? [];
    return items.map((item) => ({
      domain: (item.domain as string) ?? "",
      estimated_traffic: (item.estimated_traffic as number) ?? 0,
      avg_position: (item.avg_position as number) ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getKeywordIdeas(seed: string): Promise<KeywordResult[]> {
  const response = await fetch(
    `${DATAFORSEO_BASE}/dataforseo_labs/google/keyword_ideas/live`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords: [seed],
          location_code: 2840,
          language_code: "en",
          limit: 200,
          include_clickstream_data: true,
        },
      ]),
    }
  );
  const data = await response.json();
  return parseKeywordResults(data);
}

export async function getSerpCompetitors(keyword: string): Promise<CompetitorResult[]> {
  const response = await fetch(
    `${DATAFORSEO_BASE}/dataforseo_labs/google/serp_competitors/live`,
    {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords: [keyword],
          location_code: 2840,
          language_code: "en",
        },
      ]),
    }
  );
  const data = await response.json();
  return parseCompetitorResults(data);
}

export async function getBridgeKeywords(coreKeyword: string): Promise<KeywordResult[]> {
  return getKeywordIdeas(coreKeyword);
}

/**
 * Fetch metrics for a single exact keyword using two DataForSEO endpoints:
 *  1. keywords_data/google_ads/search_volume/live  → volume, cpc, competition, monthly trend
 *  2. dataforseo_labs/google/bulk_keyword_difficulty/live → keyword difficulty
 */
export async function getExactKeywordMetrics(
  keyword: string
): Promise<{ result: KeywordResult } | { error: string }> {
  try {
    const auth = getAuthHeader();
    const headers = { Authorization: auth, "Content-Type": "application/json" };
    const payload = JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]);

    const [svRes, kdRes] = await Promise.all([
      fetch(`${DATAFORSEO_BASE}/keywords_data/google_ads/search_volume/live`, { method: "POST", headers, body: payload }),
      fetch(`${DATAFORSEO_BASE}/dataforseo_labs/google/bulk_keyword_difficulty/live`, { method: "POST", headers, body: payload }),
    ]);

    if (!svRes.ok) {
      return { error: `DataForSEO search volume API returned HTTP ${svRes.status}` };
    }

    const svData = await svRes.json();
    const kdData = await kdRes.json();

    // DataForSEO can return HTTP 200 but include an error status in the task
    const svStatus = (svData.tasks as Array<{ status_code?: number; status_message?: string }>)?.[0];
    if (svStatus?.status_code && svStatus.status_code !== 20000) {
      return { error: `DataForSEO error ${svStatus.status_code}: ${svStatus.status_message ?? "unknown"}` };
    }

    // search_volume endpoint returns results directly as result[0], no items wrapper
    const svTasks = svData.tasks as Array<{ result: Array<Record<string, unknown>> }> | undefined;
    const svItem = svTasks?.[0]?.result?.[0];

    if (!svItem) {
      return { error: `No data found for "${keyword}" — keyword may have no search volume or be unrecognised by DataForSEO.` };
    }

    // bulk_keyword_difficulty endpoint wraps results in items[]
    const kdTasks = kdData.tasks as Array<{ result: Array<{ items: Array<Record<string, unknown>> }> }> | undefined;
    const kdItem = kdTasks?.[0]?.result?.[0]?.items?.[0];
    const kd = (kdItem?.keyword_difficulty as number) ?? 0;

    const monthlySearches = (
      (svItem.monthly_searches as Array<{ search_volume: number }>) ?? []
    ).slice(0, 12).map((m) => m.search_volume ?? 0);

    // search_volume API returns competition as a string ("LOW"/"MEDIUM"/"HIGH")
    // and competition_index as an integer 0–100
    const competitionLevel = (svItem.competition as string) ?? "MEDIUM";
    const competitionIndex = (svItem.competition_index as number) ?? 50;
    const competition = competitionIndex / 100;

    return {
      result: {
        keyword: (svItem.keyword as string) ?? keyword,
        search_volume: (svItem.search_volume as number) ?? 0,
        cpc: (svItem.cpc as number) ?? 0,
        keyword_difficulty: kd,
        trend: monthlySearches,
        suggested_id: toKebabCase(keyword),
        competition,
        competition_level: competitionLevel,
        search_intent: "commercial",
        cps: (svItem.cps as number) ?? 1,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "unexpected error calling DataForSEO" };
  }
}

export interface NewsResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  published_at: string | null;
}

/**
 * Search Google News via DataForSEO for articles published in the last 30 days.
 * Returns up to 5 results, best-match first.
 */
export async function searchGoogleNews(query: string): Promise<NewsResult[]> {
  try {
    const response = await fetch(
      `${DATAFORSEO_BASE}/serp/google/news/live/advanced`,
      {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keyword: query,
            location_code: 2840,
            language_code: "en",
            depth: 10,
          },
        ]),
      }
    );
    const data = await response.json();
    const tasks = data.tasks as Array<{
      result: Array<{
        items: Array<Record<string, unknown>>;
      }>;
    }>;
    const items = tasks?.[0]?.result?.[0]?.items ?? [];

    // Filter to news items only and published within ~30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const results: NewsResult[] = [];

    for (const item of items) {
      if (item.type !== "news") continue;
      const url = (item.url as string) ?? "";
      const title = (item.title as string) ?? "";
      const snippet = (item.description as string) ?? "";
      const source = (item.source as string) ?? "";
      const publishedRaw = item.timestamp as string | null;
      if (!url || !title) continue;

      // Accept if no date (can't verify) or within 30-day window
      const publishedMs = publishedRaw ? new Date(publishedRaw).getTime() : null;
      if (publishedMs !== null && publishedMs < cutoff) continue;

      results.push({ title, url, snippet, source, published_at: publishedRaw ?? null });
      if (results.length >= 5) break;
    }

    return results;
  } catch {
    return [];
  }
}

export const MOCK_KEYWORDS: KeywordResult[] = [
  {
    keyword: "beginner guide to [topic]",
    search_volume: 14800, cpc: 8.5, keyword_difficulty: 42,
    trend: [12000, 13000, 14000, 15000, 14800, 13500, 14000, 15000, 16000, 14800, 13000, 14800],
    suggested_id: "beginner-guide-topic",
    competition: 0.41, competition_level: "MEDIUM", search_intent: "informational", cps: 1.3,
  },
  {
    keyword: "how to choose [topic]",
    search_volume: 22000, cpc: 12.3, keyword_difficulty: 55,
    trend: [20000, 21000, 22000, 23000, 22000, 21500, 22000, 23000, 24000, 22000, 21000, 22000],
    suggested_id: "how-to-choose-topic",
    competition: 0.62, competition_level: "MEDIUM", search_intent: "commercial", cps: 1.5,
  },
  {
    keyword: "best [topic] options",
    search_volume: 49000, cpc: 15.2, keyword_difficulty: 68,
    trend: [45000, 47000, 49000, 51000, 49000, 48000, 49000, 51000, 53000, 49000, 47000, 49000],
    suggested_id: "best-topic-options",
    competition: 0.78, competition_level: "HIGH", search_intent: "transactional", cps: 1.8,
  },
  {
    keyword: "[topic] explained",
    search_volume: 8900, cpc: 6.1, keyword_difficulty: 35,
    trend: [8000, 8500, 8900, 9200, 8900, 8600, 8900, 9200, 9500, 8900, 8500, 8900],
    suggested_id: "topic-explained",
    competition: 0.28, competition_level: "LOW", search_intent: "informational", cps: 1.1,
  },
  {
    keyword: "[topic] vs [alternative]",
    search_volume: 18200, cpc: 9.8, keyword_difficulty: 48,
    trend: [16000, 17000, 18200, 19000, 18200, 17500, 18200, 19000, 20000, 18200, 17000, 18200],
    suggested_id: "topic-vs-alternative",
    competition: 0.52, competition_level: "MEDIUM", search_intent: "commercial", cps: 1.4,
  },
];

export const MOCK_COMPETITORS: CompetitorResult[] = [
  { domain: "example-competitor-1.com", estimated_traffic: 250000, avg_position: 3.2 },
  { domain: "example-competitor-2.com", estimated_traffic: 180000, avg_position: 4.1 },
  { domain: "example-competitor-3.com", estimated_traffic: 120000, avg_position: 5.8 },
];
