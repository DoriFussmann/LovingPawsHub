import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

/** Extract a readable message from either a JS Error or a Supabase PostgrestError. */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message);
  return "unknown server error";
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("site_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ data: data ?? null });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Whitelist all known site_config columns.
    const stringFields = [
      // Identity
      "site_name",
      "site_description",
      "industry_name",
      // Homepage hero
      "homepage_title",
      "homepage_headline",
      "homepage_subheadline",
      "hero_body_text",
      "hero_cta_primary",
      "hero_cta_secondary",
      // Homepage about
      "homepage_about_headline",
      "homepage_about_text",
      // About page
      "about_text",
      // Logo banner
      "logo_banner_text",
      // Social & contact
      "twitter_handle",
      "facebook_url",
      "linkedin_url",
      "contact_email",
      // SEO
      "og_image_url",
      "google_verification",
      // Image generation
      "image_provider",
      // Footer
      "footer_copyright",
    ] as const;

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of stringFields) {
      if (key in body) {
        payload[key] = body[key] === "" ? "" : (body[key] ?? null);
      }
    }
    // Boolean field
    if ("show_logo_banner" in body) {
      payload["show_logo_banner"] = Boolean(body["show_logo_banner"]);
    }
    // JSONB fields
    if ("team_members" in body) {
      payload["team_members"] = body["team_members"] ?? null;
    }
    if ("about_editorial_standards" in body) {
      payload["about_editorial_standards"] = body["about_editorial_standards"] ?? null;
    }

    const supabase = createServiceClient();

    const { data: existing, error: fetchError } = await supabase
      .from("site_config")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const { error: writeError } = existing?.id
      ? await supabase.from("site_config").update(payload).eq("id", existing.id)
      : await supabase.from("site_config").insert(payload);

    if (writeError) throw writeError;
    revalidateTag("site-config");
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
