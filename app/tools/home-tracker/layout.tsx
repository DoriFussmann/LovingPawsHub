import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/home-tracker/Sidebar";
import ChatWidget from "@/components/home-tracker/ChatWidget";

export const metadata = {
  title: "Home Tracker",
  description: "Track every step of your home purchase in one place.",
};

export default async function HomeTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/tools/home-tracker/dashboard");
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, address")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: topics } = property
    ? await supabase
        .from("topics")
        .select("id, name, icon, status")
        .eq("property_id", property.id)
        .order("created_at")
    : { data: [] };

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-8">
      <div className="flex gap-6 lg:gap-8 min-h-[70vh]">
        <Sidebar
          property={property ?? null}
          topics={topics ?? []}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {property && <ChatWidget propertyId={property.id} />}
    </div>
  );
}
