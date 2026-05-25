import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * PATCH /api/admin/articles
 * Body: { id, reviewer_name?, author_url? }
 * Updates author fields on a published article and revalidates its public URL.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, reviewer_name, author_url } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();

    // Fetch existing article for revalidation path
    const { data: existing, error: fetchError } = await supabase
      .from("articles")
      .select("core_id, bridge_id, slug")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "article not found" }, { status: 404 });
    }

    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };
    if (reviewer_name !== undefined) updates.reviewer_name = reviewer_name || null;
    if (author_url !== undefined) updates.author_url = author_url || null;

    const { error: updateError } = await supabase
      .from("articles")
      .update(updates)
      .eq("id", id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    revalidatePath(`/${existing.core_id}/${existing.bridge_id}/${existing.slug}`);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
