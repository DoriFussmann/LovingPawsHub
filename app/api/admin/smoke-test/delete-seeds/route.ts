import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const supabase = createServiceClient();

    const { error: articlesError } = await supabase
      .from("articles")
      .delete()
      .eq("is_seed", true);

    if (articlesError) {
      return NextResponse.json(
        { error: `articles delete failed: ${articlesError.message}` },
        { status: 500 }
      );
    }

    const { error: clustersError } = await supabase
      .from("clusters")
      .delete()
      .eq("is_seed", true);

    if (clustersError) {
      return NextResponse.json(
        { error: `clusters delete failed: ${clustersError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "delete failed" },
      { status: 500 }
    );
  }
}
