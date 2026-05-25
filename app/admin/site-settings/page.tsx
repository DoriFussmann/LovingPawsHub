import { createServiceClient } from "@/lib/supabase/server";
import type { SiteConfig } from "@/lib/site-config";
import SiteSettingsClient from "./SiteSettingsClient";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  let config: SiteConfig | null = null;
  let tableMissing = false;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("site_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    // 42P01 = undefined_table, 42703 = undefined_column (migration not run)
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "42P01" || code === "42703") tableMissing = true;
      else throw error;
    }

    config = (data as SiteConfig) ?? null;
  } catch {
    // Any other fetch error — proceed with null config.
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          controls
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">
          site settings
        </h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          site-wide identity, SEO metadata, and content — changes apply everywhere instantly.
        </p>
      </div>

      {tableMissing && (
        <div className="mb-6 rounded-md border border-amber-200/60 bg-amber-50/30 px-4 py-3">
          <p className="text-xs font-light text-amber-700 mb-2">
            The database schema is missing or out of date. Run the setup SQL in your Supabase
            SQL editor, then reload this page.
          </p>
          <p className="text-[11px] font-mono text-amber-600/80 bg-amber-100/40 rounded px-2 py-1 break-all">
            db/schema.sql
          </p>
        </div>
      )}

      <SiteSettingsClient config={config} tableMissing={tableMissing} />
    </div>
  );
}
