import { cache } from "react";
import { createReadClient } from "@/lib/supabase/server";

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image_url: string;
  credentials?: string;   // e.g. "CPA, 12 years in financial planning"
  linkedin_url?: string;
  twitter_url?: string;
}

export interface EditorialStandard {
  title: string;
  body: string;
}

export interface SiteConfig {
  id: string;

  // Core identity
  site_name: string;
  site_description: string;
  industry_name: string;

  // Homepage hero
  homepage_title: string;
  homepage_headline: string;
  homepage_subheadline: string;
  hero_body_text: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;

  // Homepage "who we are"
  homepage_about_headline: string;
  homepage_about_text: string;

  // About page
  about_text: string;
  about_editorial_standards: EditorialStandard[] | null;

  // Team
  team_members: TeamMember[] | null;

  // Logo banner
  show_logo_banner: boolean;
  logo_banner_text: string;

  // Social & contact
  twitter_handle: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  contact_email: string | null;

  // SEO
  og_image_url: string | null;
  google_verification: string | null;

  // Image generation
  image_provider: "none" | "unsplash" | "dalle";

  // Footer
  footer_copyright: string;

  // Glossary page SEO
  glossary_meta_title: string;
  glossary_meta_description: string;
  glossary_og_title: string;
  glossary_og_description: string;
}

/** Env-based defaults used when the DB row has not been populated yet. */
const ENV_DEFAULTS = {
  site_name: process.env.NEXT_PUBLIC_SITE_NAME || "",
  site_description: "",
  industry_name: process.env.NEXT_PUBLIC_INDUSTRY_NAME || "",
  homepage_title: process.env.NEXT_PUBLIC_SITE_NAME || "",
  homepage_headline: process.env.NEXT_PUBLIC_SITE_NAME || "",
  homepage_subheadline: "expert resources, clearly explained.",
  hero_body_text: "",
  hero_cta_primary: "read the guide",
  hero_cta_secondary: "browse articles",
  homepage_about_headline: "",
  homepage_about_text: "",
  about_text: "{SITE_NAME} is an independent resource covering {INDUSTRY_NAME}.",
  logo_banner_text: "",
  footer_copyright: process.env.NEXT_PUBLIC_SITE_NAME || "",
  og_image_url: null as string | null,
  twitter_handle: null as string | null,
  facebook_url: null as string | null,
  linkedin_url: null as string | null,
  contact_email: null as string | null,
  google_verification: null as string | null,
  image_provider: "none" as const,
  glossary_meta_title: "",
  glossary_meta_description: "",
  glossary_og_title: "",
  glossary_og_description: "",
};

function buildClient() {
  return createReadClient();
}

/**
 * Fetches the single site_config row.
 * React cache() deduplicates this call within a single render tree so that
 * layout + multiple server components only hit Supabase once per request.
 * Returns null if the table doesn't exist yet or the fetch fails.
 */
export const getSiteConfig = cache(async (): Promise<SiteConfig | null> => {
  try {
    const { data } = await buildClient()
      .from("site_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    return (data as SiteConfig) ?? null;
  } catch (error) {
    console.error("[getSiteConfig] failed:", error);
    return null;
  }
});

/**
 * Reads a string field from the config row, falling back to the ENV default
 * and then to the provided fallback string. Trims whitespace; never returns "".
 */
export function cfg(
  config: SiteConfig | null,
  key: keyof typeof ENV_DEFAULTS,
  fallback = ""
): string {
  const dbVal = config?.[key];
  if (dbVal && typeof dbVal === "string" && dbVal.trim()) return dbVal.trim();
  const envVal = ENV_DEFAULTS[key];
  if (envVal && typeof envVal === "string" && (envVal as string).trim())
    return (envVal as string).trim();
  return fallback;
}

export function resolveTokens(
  text: string,
  siteName: string,
  industryName: string
): string {
  return text
    .replaceAll("{SITE_NAME}", siteName)
    .replaceAll("{INDUSTRY_NAME}", industryName);
}
