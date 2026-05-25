import { createServiceClient as createClient } from "@/lib/supabase/server";
import ResourcesClient from "./ResourcesClient";

export default async function ResourcesPage() {
  let resources: Array<{
    id: string;
    url: string | null;
    title: string | null;
    notes: string | null;
    domain_authority: number | null;
    source: string;
    created_at: string;
  }> = [];

  let industryId: string | null = null;

  try {
    const supabase = createClient();
    const [resourcesRes, industryRes] = await Promise.all([
      supabase
        .from("resources")
        .select("id, url, title, notes, domain_authority, source, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("industry").select("id").limit(1).single(),
    ]);
    resources = resourcesRes.data ?? [];
    industryId = industryRes.data?.id ?? null;
  } catch {
    // DB not configured
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          library
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">resources</h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          competitor domains, authoritative sites, reference notes
        </p>
      </div>
      <ResourcesClient
        resources={resources}
        industryId={industryId}
        industryName={process.env.NEXT_PUBLIC_INDUSTRY_NAME ?? ""}
      />
    </div>
  );
}
