import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomeTrackerRootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/tools/home-tracker/dashboard");
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (property) {
    redirect("/tools/home-tracker/dashboard");
  } else {
    redirect("/tools/home-tracker/onboarding");
  }
}
