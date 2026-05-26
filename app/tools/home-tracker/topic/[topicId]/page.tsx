import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopicDetail from "@/components/home-tracker/TopicDetail";
import DocumentUpload from "@/components/home-tracker/DocumentUpload";
import ActivityLog from "@/components/home-tracker/ActivityLog";
import ImageGallery from "@/components/home-tracker/ImageGallery";

export default async function TopicPage({
  params,
}: {
  params: { topicId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch topic (RLS verifies ownership through properties)
  const { data: topic } = await supabase
    .from("topics")
    .select("id, name, icon, status, summary, details, notes, property_id")
    .eq("id", params.topicId)
    .maybeSingle();

  if (!topic) notFound();

  // Verify user owns the parent property
  const { data: property } = await supabase
    .from("properties")
    .select("id, address, images")
    .eq("id", topic.property_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!property) notFound();

  const [{ data: documents }, { data: logs }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, file_url, created_at")
      .eq("topic_id", topic.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("log_entries")
      .select("id, content, ai_summary, created_at")
      .eq("property_id", property.id)
      .eq("topic_id", topic.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/tools/home-tracker/dashboard"
          className="text-[10px] tracking-widest uppercase text-foreground/40 hover:text-foreground/70 transition-colors"
        >
          ← overview
        </Link>
      </div>

      {/* Topic header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          {topic.icon && (
            <span className="text-2xl leading-none">{topic.icon}</span>
          )}
          <h1 className="text-xl md:text-2xl font-extralight tracking-tight text-foreground">
            {topic.name}
          </h1>
        </div>
        {topic.summary && (
          <p className="text-sm font-light text-muted-foreground mt-1">
            {topic.summary}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Topic detail (status + fields + notes) */}
          <section className="bg-card border border-border rounded-md p-5">
            <TopicDetail
              topic={{
                id: topic.id,
                name: topic.name,
                icon: topic.icon,
                status: topic.status,
                summary: topic.summary,
                details: topic.details as Record<string, string> | null,
                notes: topic.notes,
              }}
            />
          </section>

          {/* Activity log for this topic */}
          <section className="bg-card border border-border rounded-md p-5">
            <ActivityLog
              propertyId={property.id}
              topicId={topic.id}
              initialEntries={logs ?? []}
            />
          </section>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Document upload */}
          <section className="bg-card border border-border rounded-md p-5">
            <DocumentUpload
              propertyId={property.id}
              topicId={topic.id}
              topicName={topic.name}
              initialDocuments={documents ?? []}
              userId={user.id}
            />
          </section>

          {/* Property images */}
          {property.images && property.images.length > 0 && (
            <section className="bg-card border border-border rounded-md p-5">
              <ImageGallery images={property.images} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
