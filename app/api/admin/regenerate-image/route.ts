import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchImageForArticle } from "@/lib/image-provider";

export async function POST(request: Request) {
  try {
    const { article_id, title } = await request.json();
    if (!article_id || !title) {
      return NextResponse.json({ error: "article_id and title are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Read current image_provider from site_config
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("image_provider")
      .limit(1)
      .maybeSingle();

    const provider = (siteConfig?.image_provider as string) ?? "none";
    if (provider === "none") {
      return NextResponse.json(
        { error: "Image provider is set to 'none'. Configure it in Admin → Site Settings → Article images." },
        { status: 400 }
      );
    }

    const result = await fetchImageForArticle(provider, title);
    if (!result.url) {
      return NextResponse.json(
        { error: "No image returned. Check your API key environment variable." },
        { status: 500 }
      );
    }

    // Persist to the article row
    await supabase
      .from("articles")
      .update({ featured_image_url: result.url, featured_image_alt: result.alt })
      .eq("article_id", article_id);

    return NextResponse.json({ url: result.url, alt: result.alt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server error" },
      { status: 500 }
    );
  }
}
