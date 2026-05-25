import { NextRequest, NextResponse } from "next/server";
import { validateSnakeCase } from "@/lib/slugify";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = request.nextUrl.searchParams.get("id");
    const all = request.nextUrl.searchParams.get("all");

    if (all === "true") {
      const { error } = await supabase.from("clusters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await supabase.from("clusters").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { bridge_keyword_id, cluster_id, display_name } = await request.json();

    if (!bridge_keyword_id || !cluster_id || !display_name) {
      return NextResponse.json({ error: "bridge_keyword_id, cluster_id, and display_name required" }, { status: 400 });
    }

    if (!validateSnakeCase(cluster_id)) {
      return NextResponse.json({ error: "cluster_id must be lowercase snake_case" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("clusters")
      .insert({ bridge_keyword_id, cluster_id, display_name })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cluster: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
