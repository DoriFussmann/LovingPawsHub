import { NextRequest, NextResponse } from "next/server";
import { getBridgeKeywords, MOCK_KEYWORDS } from "@/lib/dataforseo";
import { validateSlug } from "@/lib/slugify";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Save action
    if (body.action === "save") {
      const { core_keyword_id, bridges } = body;
      const supabase = createServiceClient();

      const inserts = (bridges as Array<{
        keyword: string;
        suggested_id: string;
        search_volume: number;
        cpc: number;
        keyword_difficulty: number;
        trend: number[];
        competition?: number;
        competition_level?: string;
        search_intent?: string;
        cps?: number;
      }>).map((b) => {
        if (!validateSlug(b.suggested_id)) {
          throw new Error(`invalid bridge_id: ${b.suggested_id} — must be kebab-case (hyphens only)`);
        }
        return {
          core_keyword_id,
          keyword: b.keyword,
          bridge_id: b.suggested_id,
          search_volume: b.search_volume,
          cpc: b.cpc,
          keyword_difficulty: b.keyword_difficulty,
          trend_data: b.trend,
          competition: b.competition ?? null,
          competition_level: b.competition_level ?? null,
          search_intent: b.search_intent ?? null,
          cps: b.cps ?? null,
        };
      });

      const { error } = await supabase
        .from("bridge_keywords")
        .upsert(inserts, { onConflict: "core_keyword_id, bridge_id" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Generate bridge suggestions
    const { core_keyword } = body;
    if (!core_keyword) {
      return NextResponse.json({ error: "core_keyword required" }, { status: 400 });
    }

    let bridges;
    try {
      bridges = await getBridgeKeywords(core_keyword);
      if (!bridges || bridges.length === 0) {
        bridges = MOCK_KEYWORDS;
      }
    } catch {
      bridges = MOCK_KEYWORDS;
    }

    return NextResponse.json({ bridges });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { bridge_id, meta_title, meta_description, description } = await request.json();
    if (!bridge_id) {
      return NextResponse.json({ error: "bridge_id required" }, { status: 400 });
    }
    const updateData = Object.fromEntries(
      Object.entries({ meta_title, meta_description, description }).filter(
        ([, v]) => v !== undefined
      )
    );
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("bridge_keywords")
      .update(updateData)
      .eq("bridge_id", bridge_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
