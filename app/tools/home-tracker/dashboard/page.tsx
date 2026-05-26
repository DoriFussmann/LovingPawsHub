import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PropertyHeader from "@/components/home-tracker/PropertyHeader";
import TopicGrid from "@/components/home-tracker/TopicGrid";
import ActivityLog from "@/components/home-tracker/ActivityLog";
import NextStepsChecklist from "@/components/home-tracker/NextStepsChecklist";
import ActionItemsChecklist from "@/components/home-tracker/ActionItemsChecklist";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/tools/home-tracker/dashboard");

  const { data: property } = await supabase
    .from("properties")
    .select("id, address, purchase_price, closing_date, next_steps, action_items")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!property) redirect("/tools/home-tracker/onboarding");

  const [{ data: topics }, { data: logs }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, name, icon, status, summary")
      .eq("property_id", property.id)
      .order("created_at"),
    supabase
      .from("log_entries")
      .select("id, content, ai_summary, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <PropertyHeader
        property={{
          address: property.address,
          purchase_price: property.purchase_price,
          closing_date: property.closing_date,
        }}
      />

      {/* Topics */}
      <section className="mb-10">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-4">
          Topics
        </p>
        <TopicGrid topics={topics ?? []} />
      </section>

      {/* Checklists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <section className="bg-card border border-border rounded-md p-5">
          <NextStepsChecklist
            propertyId={property.id}
            initialItems={
              Array.isArray(property.next_steps) ? property.next_steps : []
            }
          />
        </section>
        <section className="bg-card border border-border rounded-md p-5">
          <ActionItemsChecklist
            propertyId={property.id}
            initialItems={
              Array.isArray(property.action_items) ? property.action_items : []
            }
          />
        </section>
      </div>

      {/* Activity log */}
      <section className="bg-card border border-border rounded-md p-5">
        <ActivityLog
          propertyId={property.id}
          initialEntries={logs ?? []}
        />
      </section>
    </div>
  );
}
