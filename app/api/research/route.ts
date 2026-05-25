import { NextRequest, NextResponse } from "next/server";
import {
  getKeywordIdeas,
  getSerpCompetitors,
  getExactKeywordMetrics,
  MOCK_KEYWORDS,
  MOCK_COMPETITORS,
} from "@/lib/dataforseo";
import { validateSlug, toKebabCase } from "@/lib/slugify";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Save action
    if (body.action === "save") {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
          { error: "supabase not configured — add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the server" },
          { status: 503 }
        );
      }

      const { industry_id, keywords, industry_name } = body;
      const supabase = createServiceClient();

      let industryId = industry_id;

      // Ensure industry row exists
      if (!industryId) {
        const name = industry_name || process.env.NEXT_PUBLIC_INDUSTRY_NAME || "default";
        const { data: existing, error: existErr } = await supabase.from("industry").select("id").limit(1).single();
        if (existErr) console.error("[/api/research] industry lookup:", existErr.message);
        if (existing) {
          industryId = existing.id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from("industry")
            .insert({ name })
            .select("id")
            .single();
          if (createErr) console.error("[/api/research] industry insert:", createErr.message);
          industryId = created?.id;
        }
      }

      const inserts = (keywords as Array<{
        keyword: string;
        suggested_id: string;
        search_volume: number;
        cpc: number;
        keyword_difficulty: number;
        trend: number[];
      }>).map((k) => {
        if (!validateSlug(k.suggested_id)) {
          throw new Error(`invalid core_id: ${k.suggested_id} — must be kebab-case (hyphens only)`);
        }
        return {
          industry_id: industryId,
          keyword: k.keyword,
          core_id: k.suggested_id,
          search_volume: k.search_volume,
          cpc: k.cpc,
          keyword_difficulty: k.keyword_difficulty,
          trend_data: k.trend,
        };
      });

      const { error } = await supabase
        .from("core_keywords")
        .upsert(inserts, { onConflict: "core_id" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, saved: inserts.length });
    }

    // Import competitor as resource
    if (body.action === "import_competitor") {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
      }
      const { industry_id, domain } = body;
      const supabase = createServiceClient();
      await supabase.from("resources").insert({
        industry_id,
        url: `https://${domain}`,
        title: domain,
        source: "dataforseo",
      });
      return NextResponse.json({ success: true });
    }

    // Exact keyword metrics lookup
    if (body.action === "lookup_exact") {
      const { keyword } = body;
      if (!keyword) return NextResponse.json({ error: "keyword required" }, { status: 400 });

      const lookupResult = await getExactKeywordMetrics(keyword);

      if ("error" in lookupResult) {
        const mock = { ...MOCK_KEYWORDS[0], keyword, suggested_id: toKebabCase(keyword) };
        return NextResponse.json({ keyword: mock, is_mock: true });
      }

      return NextResponse.json({ keyword: lookupResult.result, is_mock: false });
    }

    // Research action
    const { seed_keyword } = body;
    if (!seed_keyword) {
      return NextResponse.json({ error: "seed_keyword required" }, { status: 400 });
    }

    let keywords;
    let competitors;
    let is_mock = false;

    try {
      [keywords, competitors] = await Promise.all([
        getKeywordIdeas(seed_keyword),
        getSerpCompetitors(seed_keyword),
      ]);

      if (!keywords || keywords.length === 0) {
        keywords = MOCK_KEYWORDS;
        competitors = MOCK_COMPETITORS;
        is_mock = true;
      }
    } catch {
      keywords = MOCK_KEYWORDS;
      competitors = MOCK_COMPETITORS;
      is_mock = true;
    }

    return NextResponse.json({ keywords, competitors, is_mock });
  } catch (e) {
    console.error("[/api/research]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coreId = searchParams.get("core_id");
    if (!coreId) return NextResponse.json({ error: "core_id required" }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from("core_keywords").delete().eq("core_id", coreId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[/api/research DELETE]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
