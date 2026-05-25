import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    const { core_id, meta_title, meta_description, description } = await request.json();
    if (!core_id) {
      return NextResponse.json({ error: "core_id required" }, { status: 400 });
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
      .from("core_keywords")
      .update(updateData)
      .eq("core_id", core_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
