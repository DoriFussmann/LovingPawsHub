import { NextRequest, NextResponse } from "next/server";
import { injectInternalLinks } from "@/lib/linkwire";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    // Save (without publishing) action
    if (body.action === "save") {
      const {
        article_id,
        h1_title,
        meta_title,
        meta_description,
        body_markdown,
        reviewer_name,
        featured_image_url,
        featured_image_alt,
      } = body;
      const { error } = await supabase
        .from("articles")
        .update({
          h1_title,
          meta_title,
          meta_description,
          body_markdown,
          ...(reviewer_name !== undefined ? { reviewer_name: reviewer_name || null } : {}),
          ...(featured_image_url !== undefined ? { featured_image_url: featured_image_url || null } : {}),
          ...(featured_image_alt !== undefined ? { featured_image_alt: featured_image_alt || null } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("article_id", article_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Publish action
    const { article_id, published_at: publishedAtOverride } = body;
    if (!article_id) {
      return NextResponse.json({ error: "article_id required" }, { status: 400 });
    }

    // Validate optional published_at override — must be a valid ISO date no more
    // than 60 days in the past and no more than 1 day in the future.
    let resolvedPublishedAt = new Date().toISOString();
    if (publishedAtOverride) {
      const parsed = new Date(publishedAtOverride);
      if (!isNaN(parsed.getTime())) {
        const now = Date.now();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (parsed.getTime() >= now - sixtyDaysMs && parsed.getTime() <= now + oneDayMs) {
          resolvedPublishedAt = parsed.toISOString();
        }
      }
    }

    const { data: article } = await supabase
      .from("articles")
      .select("*")
      .eq("article_id", article_id)
      .single();

    if (!article) {
      return NextResponse.json({ error: "article not found" }, { status: 404 });
    }

    // Inject internal links — pass supabase so the injector can resolve each
    // target_slug to its real core_id/bridge_id (fixes cross-bridge URL bug).
    const wired = await injectInternalLinks(
      {
        ...article,
        internal_links_injected: article.internal_links_injected ?? [],
      },
      supabase
    );

    // Update article
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        body_markdown: wired.body_markdown,
        internal_links_injected: wired.internal_links_injected,
        link_status: wired.link_status,
        status: "published",
        published_at: resolvedPublishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("article_id", article_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update skeleton status
    if (article.skeleton_id) {
      await supabase
        .from("article_skeletons")
        .update({ status: "published", link_status: wired.link_status })
        .eq("id", article.skeleton_id);
    }

    // Trigger ISR revalidation — trailing slashes required to match the actual cached routes
    revalidatePath(`/${article.core_id}/${article.bridge_id}/${article.slug}/`);
    revalidatePath(`/${article.core_id}/${article.bridge_id}/`);
    revalidatePath(`/${article.core_id}/`);
    revalidatePath("/articles/");
    revalidatePath("/");

    return NextResponse.json({ success: true, link_status: wired.link_status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
