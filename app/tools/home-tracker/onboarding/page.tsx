"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_TOPICS = [
  { name: "Inspection", icon: "🔍" },
  { name: "Title", icon: "📄" },
  { name: "Insurance", icon: "🛡️" },
  { name: "HOA", icon: "🏘️" },
  { name: "Mortgage", icon: "🏦" },
  { name: "Appraisal", icon: "📊" },
  { name: "Escrow", icon: "🔐" },
  { name: "Final Walkthrough", icon: "🚪" },
  { name: "Closing", icon: "🎉" },
];

type Step = "property" | "review";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("property");
  const [address, setAddress] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!address.trim()) {
      setError("Property address is required.");
      return;
    }

    setSaving(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Insert property
    const { data: property, error: propError } = await supabase
      .from("properties")
      .insert({
        user_id: user.id,
        address: address.trim(),
        purchase_price: purchasePrice ? parseFloat(purchasePrice.replace(/,/g, "")) : null,
        closing_date: closingDate || null,
        next_steps: [],
        action_items: [],
      })
      .select("id")
      .single();

    if (propError || !property) {
      setError(propError?.message ?? "Failed to create property.");
      setSaving(false);
      return;
    }

    // Insert default topics
    const { error: topicError } = await supabase.from("topics").insert(
      DEFAULT_TOPICS.map((t) => ({
        property_id: property.id,
        name: t.name,
        icon: t.icon,
        status: "not_started",
      }))
    );

    if (topicError) {
      setError(topicError.message);
      setSaving(false);
      return;
    }

    router.push("/tools/home-tracker/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-lg py-4">
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
        home tracker
      </p>
      <h1 className="text-2xl font-extralight tracking-tight text-foreground mb-2">
        Set up your property
      </h1>
      <p className="text-sm font-light text-muted-foreground mb-8">
        Tell us about the home you&apos;re buying. You can update all of this later.
      </p>

      {step === "property" && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-light text-foreground/70 mb-1.5">
              Property address <span className="text-err-ink">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Maple St, Austin, TX 78701"
              className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
            />
          </div>

          <div>
            <label className="block text-xs font-light text-foreground/70 mb-1.5">
              Purchase price
            </label>
            <input
              type="text"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="450,000"
              className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
            />
          </div>

          <div>
            <label className="block text-xs font-light text-foreground/70 mb-1.5">
              Closing date
            </label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs font-light text-err-ink bg-err-bg rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("review")}
              disabled={!address.trim()}
              className="flex-1 py-2.5 text-sm font-light bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-0.5">Address</p>
              <p className="text-sm font-light text-foreground">{address}</p>
            </div>
            {purchasePrice && (
              <div>
                <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-0.5">Purchase price</p>
                <p className="text-sm font-light text-foreground">${purchasePrice}</p>
              </div>
            )}
            {closingDate && (
              <div>
                <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-0.5">Closing date</p>
                <p className="text-sm font-light text-foreground">
                  {new Date(closingDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-light text-foreground/60 mb-3">
              We&apos;ll create these 9 tracking topics for your property:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEFAULT_TOPICS.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center gap-1.5 bg-card border border-border rounded px-2 py-1.5"
                >
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-xs font-light text-foreground/70">{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-light text-err-ink bg-err-bg rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("property")}
              className="px-4 py-2.5 text-sm font-light text-foreground/60 border border-border rounded hover:border-foreground/30 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-light bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Creating…" : "Create my tracker"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
