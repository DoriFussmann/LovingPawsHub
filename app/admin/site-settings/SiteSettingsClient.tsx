"use client";

import { useState, useRef } from "react";
import { Sparkles, Check, X, Pencil, Plus, Trash2 } from "lucide-react";
import type { SiteConfig, TeamMember, EditorialStandard } from "@/lib/site-config";
import type { SiteConfigSuggestions } from "@/app/api/admin/site-config/suggest/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  config: SiteConfig | null;
  tableMissing?: boolean;
}

type FormState = Omit<
  SiteConfig,
  "id" | "updated_at" | "team_members" | "show_logo_banner" | "about_editorial_standards"
>;

/** Fields that can receive AI suggestions (string fields only). */
type SuggestionField = keyof Omit<SiteConfigSuggestions, "about_editorial_standards">;

type SuggestionStatus = "pending" | "editing" | "confirmed" | "discarded";

interface SuggestionItem {
  value: string;
  status: SuggestionStatus;
  editValue: string;
}

type SuggestionsMap = Partial<Record<SuggestionField, SuggestionItem>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(): FormState {
  return {
    site_name: "",
    site_description: "",
    industry_name: "",
    homepage_title: "",
    homepage_headline: "",
    homepage_subheadline: "",
    hero_body_text: "",
    hero_cta_primary: "",
    hero_cta_secondary: "",
    homepage_about_headline: "",
    homepage_about_text: "",
    about_text: "",
    logo_banner_text: "",
    twitter_handle: "",
    facebook_url: "",
    linkedin_url: "",
    contact_email: "",
    og_image_url: "",
    google_verification: "",
    image_provider: "none",
    footer_copyright: "",
    glossary_meta_title: "",
    glossary_meta_description: "",
    glossary_og_title: "",
    glossary_og_description: "",
  };
}

function configToForm(config: SiteConfig | null): FormState {
  if (!config) return emptyForm();
  return {
    site_name: config.site_name ?? "",
    site_description: config.site_description ?? "",
    industry_name: config.industry_name ?? "",
    homepage_title: config.homepage_title ?? "",
    homepage_headline: config.homepage_headline ?? "",
    homepage_subheadline: config.homepage_subheadline ?? "",
    hero_body_text: config.hero_body_text ?? "",
    hero_cta_primary: config.hero_cta_primary ?? "",
    hero_cta_secondary: config.hero_cta_secondary ?? "",
    homepage_about_headline: config.homepage_about_headline ?? "",
    homepage_about_text: config.homepage_about_text ?? "",
    about_text: config.about_text ?? "",
    logo_banner_text: config.logo_banner_text ?? "",
    twitter_handle: config.twitter_handle ?? "",
    facebook_url: config.facebook_url ?? "",
    linkedin_url: config.linkedin_url ?? "",
    contact_email: config.contact_email ?? "",
    og_image_url: config.og_image_url ?? "",
    google_verification: config.google_verification ?? "",
    image_provider: config.image_provider ?? "none",
    footer_copyright: config.footer_copyright ?? "",
    glossary_meta_title: config.glossary_meta_title ?? "",
    glossary_meta_description: config.glossary_meta_description ?? "",
    glossary_og_title: config.glossary_og_title ?? "",
    glossary_og_description: config.glossary_og_description ?? "",
  };
}

function emptyTeamMember(): TeamMember {
  return { name: "", role: "", bio: "", image_url: "", credentials: "", linkedin_url: "", twitter_url: "" };
}

function emptyStandard(): EditorialStandard {
  return { title: "", body: "" };
}

// ─── Suggestion pill ──────────────────────────────────────────────────────────

function SuggestionPill({
  field,
  item,
  onConfirm,
  onDiscard,
  onEditStart,
  onEditChange,
  onEditSave,
}: {
  field: SuggestionField;
  item: SuggestionItem;
  onConfirm: (f: SuggestionField) => void;
  onDiscard: (f: SuggestionField) => void;
  onEditStart: (f: SuggestionField) => void;
  onEditChange: (f: SuggestionField, v: string) => void;
  onEditSave: (f: SuggestionField) => void;
}) {
  if (item.status === "confirmed" || item.status === "discarded") return null;

  const isEditing = item.status === "editing";
  const isMultiline =
    field === "about_text" ||
    field === "site_description" ||
    field === "homepage_about_text" ||
    field === "hero_body_text";

  return (
    <div className="mt-1.5 rounded-md border border-amber-200/60 bg-amber-50/40 px-3 py-2">
      <div className="flex items-start gap-2">
        <Sparkles size={11} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-amber-600/70 mb-1">
            suggestion
          </p>
          {isEditing ? (
            isMultiline ? (
              <textarea
                value={item.editValue}
                onChange={(e) => onEditChange(field, e.target.value)}
                rows={3}
                className="w-full text-xs font-light bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-y"
              />
            ) : (
              <input
                type="text"
                value={item.editValue}
                onChange={(e) => onEditChange(field, e.target.value)}
                className="w-full text-xs font-light bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            )
          ) : (
            <p className="text-xs font-light text-foreground/80 leading-relaxed break-words">
              {item.value}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 mt-0.5">
          {isEditing ? (
            <button
              onClick={() => onEditSave(field)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-light rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Check size={10} />
              use
            </button>
          ) : (
            <>
              <button
                onClick={() => onConfirm(field)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-light rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Check size={10} />
                use
              </button>
              <button
                onClick={() => onEditStart(field)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-light rounded border border-border text-foreground/60 hover:border-foreground/30 hover:text-foreground transition-colors"
              >
                <Pencil size={10} />
                edit
              </button>
            </>
          )}
          <button
            onClick={() => onDiscard(field)}
            className="flex items-center px-1.5 py-1 text-[10px] font-light rounded border border-border text-muted-foreground hover:border-red-200 hover:text-red-500 transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  name,
  value,
  onChange,
  multiline = false,
  placeholder = "",
  suggestion,
  onConfirm,
  onDiscard,
  onEditStart,
  onEditChange,
  onEditSave,
}: {
  label: string;
  hint?: string;
  name: keyof FormState;
  value: string;
  onChange: (name: keyof FormState, val: string) => void;
  multiline?: boolean;
  placeholder?: string;
  suggestion?: SuggestionItem;
  onConfirm?: (f: SuggestionField) => void;
  onDiscard?: (f: SuggestionField) => void;
  onEditStart?: (f: SuggestionField) => void;
  onEditChange?: (f: SuggestionField, v: string) => void;
  onEditSave?: (f: SuggestionField) => void;
}) {
  const isSuggestionField = (n: keyof FormState): n is SuggestionField =>
    n !== "og_image_url" && n !== "google_verification" && n !== "image_provider";

  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        <div>
          <p className="text-xs font-light text-foreground">{label}</p>
          {hint && (
            <p className="text-[11px] font-light text-muted-foreground mt-0.5 leading-snug">
              {hint}
            </p>
          )}
        </div>
        <div>
          {multiline ? (
            <textarea
              name={name}
              value={value}
              onChange={(e) => onChange(name, e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-y"
            />
          ) : (
            <input
              type="text"
              name={name}
              value={value}
              onChange={(e) => onChange(name, e.target.value)}
              placeholder={placeholder}
              className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          )}
          {suggestion &&
            isSuggestionField(name) &&
            onConfirm &&
            onDiscard &&
            onEditStart &&
            onEditChange &&
            onEditSave && (
              <SuggestionPill
                field={name as SuggestionField}
                item={suggestion}
                onConfirm={onConfirm}
                onDiscard={onDiscard}
                onEditStart={onEditStart}
                onEditChange={onEditChange}
                onEditSave={onEditSave}
              />
            )}
        </div>
      </div>
    </div>
  );
}

// ─── OG image field ───────────────────────────────────────────────────────────

function OGImageField({
  value,
  onChange,
  siteName,
  tagline,
}: {
  value: string;
  onChange: (val: string) => void;
  siteName: string;
  tagline: string;
}) {
  function generate() {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const params = new URLSearchParams();
    if (siteName.trim()) params.set("site", siteName.trim());
    if (tagline.trim()) params.set("tagline", tagline.trim());
    onChange(`${base}/og?${params.toString()}`);
  }

  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        <div>
          <p className="text-xs font-light text-foreground">OG image</p>
          <p className="text-[11px] font-light text-muted-foreground mt-0.5 leading-snug">
            Default Open Graph image for social shares.
          </p>
        </div>
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://yourdomain.com/og.png"
              className="flex-1 text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button
              type="button"
              onClick={generate}
              className="shrink-0 px-3 py-2 text-xs font-light rounded-md border border-border text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-colors whitespace-nowrap"
            >
              generate
            </button>
          </div>
          {value && (
            <div className="rounded-md overflow-hidden border border-border/50 w-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="OG image preview" className="w-full h-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">
        {title}
      </p>
      <div className="border border-border rounded-md px-5">{children}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SiteSettingsClient({ config, tableMissing }: Props) {
  const [form, setForm] = useState<FormState>(configToForm(config));
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(config?.team_members ?? []);
  const [showLogoBanner, setShowLogoBanner] = useState<boolean>(config?.show_logo_banner ?? false);
  const [editorialStandards, setEditorialStandards] = useState<EditorialStandard[]>(
    config?.about_editorial_standards ?? []
  );

  const [siteDescription, setSiteDescription] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionsMap>({});
  const [standardsSuggestion, setStandardsSuggestion] = useState<EditorialStandard[] | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // ── Form helpers ─────────────────────────────────────────────────────────

  function handleChange(name: keyof FormState, val: string) {
    setForm((prev) => ({ ...prev, [name]: val }));
    if (saveStatus !== "idle") setSaveStatus("idle");
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          team_members: teamMembers.length > 0 ? teamMembers : null,
          show_logo_banner: showLogoBanner,
          about_editorial_standards:
            editorialStandards.length > 0 ? editorialStandards : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSaveStatus("saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "save failed");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  // ── Suggestion helpers ───────────────────────────────────────────────────

  async function handleSuggest() {
    if (!siteDescription.trim()) {
      descriptionRef.current?.focus();
      return;
    }
    setSuggestLoading(true);
    setSuggestError("");
    setSuggestions({});
    setStandardsSuggestion(null);
    try {
      const res = await fetch("/api/admin/site-config/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: siteDescription.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "suggest failed");

      const raw: SiteConfigSuggestions = json.suggestions;
      const map: SuggestionsMap = {};
      (
        Object.keys(raw).filter((k) => k !== "about_editorial_standards") as SuggestionField[]
      ).forEach((key) => {
        const val = raw[key] as string;
        if (val) map[key] = { value: val, status: "pending", editValue: val };
      });
      setSuggestions(map);
      if (Array.isArray(raw.about_editorial_standards) && raw.about_editorial_standards.length > 0) {
        setStandardsSuggestion(raw.about_editorial_standards);
      }
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "suggest failed");
    } finally {
      setSuggestLoading(false);
    }
  }

  function confirmSuggestion(field: SuggestionField) {
    const item = suggestions[field];
    if (!item) return;
    setForm((prev) => ({ ...prev, [field]: item.value }));
    setSuggestions((prev) => ({ ...prev, [field]: { ...item, status: "confirmed" } }));
  }

  function discardSuggestion(field: SuggestionField) {
    setSuggestions((prev) => ({
      ...prev,
      [field]: { ...prev[field]!, status: "discarded" },
    }));
  }

  function editStart(field: SuggestionField) {
    setSuggestions((prev) => ({ ...prev, [field]: { ...prev[field]!, status: "editing" } }));
  }

  function editChange(field: SuggestionField, val: string) {
    setSuggestions((prev) => ({ ...prev, [field]: { ...prev[field]!, editValue: val } }));
  }

  function editSave(field: SuggestionField) {
    const item = suggestions[field];
    if (!item) return;
    setForm((prev) => ({ ...prev, [field]: item.editValue }));
    setSuggestions((prev) => ({
      ...prev,
      [field]: { ...item, value: item.editValue, status: "confirmed" },
    }));
  }

  function confirmAll() {
    const updates: Partial<FormState> = {};
    const next: SuggestionsMap = { ...suggestions };
    (Object.keys(suggestions) as SuggestionField[]).forEach((field) => {
      const item = suggestions[field]!;
      if (item.status === "pending") {
        updates[field] = item.value;
        next[field] = { ...item, status: "confirmed" };
      } else if (item.status === "editing") {
        updates[field] = item.editValue;
        next[field] = { ...item, value: item.editValue, status: "confirmed" };
      }
    });
    setForm((prev) => ({ ...prev, ...updates }));
    setSuggestions(next);
    if (standardsSuggestion) {
      setEditorialStandards(standardsSuggestion);
      setStandardsSuggestion(null);
    }
  }

  function discardAll() {
    const next: SuggestionsMap = {};
    (Object.keys(suggestions) as SuggestionField[]).forEach((field) => {
      next[field] = { ...suggestions[field]!, status: "discarded" };
    });
    setSuggestions(next);
    setStandardsSuggestion(null);
  }

  // ── Team member helpers ──────────────────────────────────────────────────

  function addTeamMember() {
    setTeamMembers((prev) => [...prev, emptyTeamMember()]);
  }
  function updateTeamMember(index: number, field: keyof TeamMember, value: string) {
    setTeamMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    if (saveStatus !== "idle") setSaveStatus("idle");
  }
  function removeTeamMember(index: number) {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
    if (saveStatus !== "idle") setSaveStatus("idle");
  }

  // ── Editorial standards helpers ──────────────────────────────────────────

  function addStandard() {
    setEditorialStandards((prev) => [...prev, emptyStandard()]);
  }
  function updateStandard(index: number, field: keyof EditorialStandard, value: string) {
    setEditorialStandards((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
    if (saveStatus !== "idle") setSaveStatus("idle");
  }
  function removeStandard(index: number) {
    setEditorialStandards((prev) => prev.filter((_, i) => i !== index));
    if (saveStatus !== "idle") setSaveStatus("idle");
  }

  const pendingCount = Object.values(suggestions).filter(
    (s) => s && (s.status === "pending" || s.status === "editing")
  ).length + (standardsSuggestion ? 1 : 0);

  const getSuggestion = (field: SuggestionField): SuggestionItem | undefined =>
    suggestions[field];

  const suggestionProps = {
    onConfirm: confirmSuggestion,
    onDiscard: discardSuggestion,
    onEditStart: editStart,
    onEditChange: editChange,
    onEditSave: editSave,
  };

  return (
    <div>

      {/* ── AI populate panel ──────────────────────────────────────────────── */}
      <div className="mb-8 border border-border rounded-md px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={12} className="text-foreground/50" />
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40">
            AI populate
          </p>
        </div>
        <p className="text-xs font-light text-muted-foreground mb-3">
          Describe your site in plain English and AI will suggest values for all fields below,
          including hero copy, editorial standards, and CTAs.
        </p>
        <textarea
          ref={descriptionRef}
          value={siteDescription}
          onChange={(e) => setSiteDescription(e.target.value)}
          placeholder="e.g. A resource site for professionals in the legal services industry. Covers practical guides, comparisons, and FAQs on contracts, compliance, and business law."
          rows={4}
          className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-y mb-3"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSuggest}
            disabled={suggestLoading || !siteDescription.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-light rounded-md border border-foreground/30 text-foreground hover:border-foreground/70 disabled:opacity-40 transition-colors"
          >
            <Sparkles size={11} />
            {suggestLoading ? "generating…" : "see suggestions"}
          </button>
          {suggestError && <p className="text-xs font-light text-red-500">{suggestError}</p>}
        </div>
      </div>

      {/* ── Suggestions banner ─────────────────────────────────────────────── */}
      {pendingCount > 0 && (
        <div className="mb-6 flex items-center justify-between px-4 py-2.5 rounded-md border border-amber-200/60 bg-amber-50/30">
          <p className="text-xs font-light text-amber-700">
            <span className="font-normal">{pendingCount}</span> suggestion
            {pendingCount !== 1 ? "s" : ""} ready to review
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={confirmAll}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-light rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Check size={11} />
              confirm all
            </button>
            <button
              onClick={discardAll}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-light rounded border border-border text-muted-foreground hover:border-red-200 hover:text-red-500 transition-colors"
            >
              <X size={11} />
              discard all
            </button>
          </div>
        </div>
      )}

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <Section title="Identity">
        <Field
          label="Site name"
          hint="Appears in the title tag, footer, and hero."
          name="site_name"
          value={form.site_name}
          onChange={handleChange}
          placeholder="My Site"
          suggestion={getSuggestion("site_name")}
          {...suggestionProps}
        />
        <Field
          label="Industry"
          hint="Plain-language industry label used in prompts and page copy."
          name="industry_name"
          value={form.industry_name}
          onChange={handleChange}
          placeholder="e.g. personal finance, legal services"
          suggestion={getSuggestion("industry_name")}
          {...suggestionProps}
        />
        <Field
          label="Site description"
          hint="Default meta description for pages without their own."
          name="site_description"
          value={form.site_description}
          onChange={handleChange}
          placeholder="Expert resources for your industry."
          suggestion={getSuggestion("site_description")}
          {...suggestionProps}
        />
        <Field
          label="Twitter / X handle"
          hint="Without the @ symbol."
          name="twitter_handle"
          value={form.twitter_handle ?? ""}
          onChange={handleChange}
          placeholder="yourbrand"
          suggestion={getSuggestion("twitter_handle")}
          {...suggestionProps}
        />
        <OGImageField
          value={form.og_image_url ?? ""}
          onChange={(val) => handleChange("og_image_url", val)}
          siteName={form.site_name}
          tagline={form.homepage_subheadline}
        />
      </Section>

      {/* ── Homepage hero ─────────────────────────────────────────────────── */}
      <Section title="Homepage — hero">
        <Field
          label="Page title"
          hint="<title> tag for the homepage. Defaults to site name."
          name="homepage_title"
          value={form.homepage_title}
          onChange={handleChange}
          placeholder="My Site — Expert Resources"
          suggestion={getSuggestion("homepage_title")}
          {...suggestionProps}
        />
        <Field
          label="H1 headline"
          hint="Large heading in the hero section."
          name="homepage_headline"
          value={form.homepage_headline}
          onChange={handleChange}
          placeholder="my site."
          suggestion={getSuggestion("homepage_headline")}
          {...suggestionProps}
        />
        <Field
          label="Sub-headline"
          hint="Smaller line below the H1."
          name="homepage_subheadline"
          value={form.homepage_subheadline}
          onChange={handleChange}
          placeholder="expert resources, clearly explained."
          suggestion={getSuggestion("homepage_subheadline")}
          {...suggestionProps}
        />
        <Field
          label="Body paragraph"
          hint="Short marketing paragraph below the sub-headline. Leave blank to use the auto-generated default based on industry name."
          name="hero_body_text"
          value={form.hero_body_text}
          onChange={handleChange}
          multiline
          placeholder="In-depth guides, comparisons, and analysis covering everything you need to navigate your industry."
          suggestion={getSuggestion("hero_body_text")}
          {...suggestionProps}
        />
        <Field
          label="Primary CTA"
          hint={`Label for the primary button (e.g. "read the guide").`}
          name="hero_cta_primary"
          value={form.hero_cta_primary}
          onChange={handleChange}
          placeholder="read the guide"
          suggestion={getSuggestion("hero_cta_primary")}
          {...suggestionProps}
        />
        <Field
          label="Secondary CTA"
          hint={`Label for the secondary button (e.g. "browse articles").`}
          name="hero_cta_secondary"
          value={form.hero_cta_secondary}
          onChange={handleChange}
          placeholder="browse articles"
          suggestion={getSuggestion("hero_cta_secondary")}
          {...suggestionProps}
        />
      </Section>

      {/* ── Homepage about section ────────────────────────────────────────── */}
      <Section title="Homepage — who we are">
        <Field
          label="Headline"
          hint={`H2 in the "who we are" section on the homepage.`}
          name="homepage_about_headline"
          value={form.homepage_about_headline}
          onChange={handleChange}
          placeholder="built for people who need real answers."
          suggestion={getSuggestion("homepage_about_headline")}
          {...suggestionProps}
        />
        <Field
          label="Body text"
          hint="One or two paragraphs describing the site and its editorial approach."
          name="homepage_about_text"
          value={form.homepage_about_text}
          onChange={handleChange}
          multiline
          placeholder="We're a small team of researchers and writers..."
          suggestion={getSuggestion("homepage_about_text")}
          {...suggestionProps}
        />
      </Section>

      {/* ── About page ───────────────────────────────────────────────────── */}
      <Section title="About page">
        <Field
          label="About text"
          hint="Mission paragraph shown at the top of the /about page. Use {SITE_NAME} and {INDUSTRY_NAME} as placeholders."
          name="about_text"
          value={form.about_text}
          onChange={handleChange}
          multiline
          placeholder="{SITE_NAME} is an independent resource covering {INDUSTRY_NAME}."
          suggestion={getSuggestion("about_text")}
          {...suggestionProps}
        />
      </Section>

      {/* ── Editorial standards ───────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">
          Editorial standards
        </p>
        <div className="border border-border rounded-md px-5 py-4">
          <p className="text-[11px] font-light text-muted-foreground mb-4">
            Shown as a grid on the /about page. Each block has a short title and a 1–2 sentence description.
            Leave empty to hide the section.
          </p>

          {standardsSuggestion && (
            <div className="mb-4 rounded-md border border-amber-200/60 bg-amber-50/40 px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={11} className="text-amber-500 shrink-0" />
                <p className="text-[10px] font-medium uppercase tracking-widest text-amber-600/70">
                  AI suggestion — {standardsSuggestion.length} standards
                </p>
              </div>
              <div className="space-y-1 mb-2">
                {standardsSuggestion.map((s, i) => (
                  <p key={i} className="text-xs font-light text-foreground/70">
                    <span className="font-normal">{s.title}:</span> {s.body}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditorialStandards(standardsSuggestion); setStandardsSuggestion(null); }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-light rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Check size={10} /> use
                </button>
                <button
                  onClick={() => setStandardsSuggestion(null)}
                  className="flex items-center px-1.5 py-1 text-[10px] font-light rounded border border-border text-muted-foreground hover:border-red-200 hover:text-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          )}

          {editorialStandards.length === 0 && (
            <p className="text-xs font-light text-foreground/30 mb-4">
              No editorial standards added yet.
            </p>
          )}
          <div className="space-y-4">
            {editorialStandards.map((standard, i) => (
              <div key={i} className="border border-border/50 rounded-md p-4 relative">
                <button
                  type="button"
                  onClick={() => removeStandard(i)}
                  className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
                <div className="space-y-2 pr-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={standard.title}
                      onChange={(e) => updateStandard(i, "title", e.target.value)}
                      placeholder="Independence"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">
                      Description
                    </label>
                    <textarea
                      value={standard.body}
                      onChange={(e) => updateStandard(i, "body", e.target.value)}
                      placeholder="1–2 sentences describing this editorial principle."
                      rows={2}
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-y"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addStandard}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-border text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus size={11} />
            add standard
          </button>
        </div>
      </div>

      {/* ── Team members ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40 mb-1">
          Team members
        </p>
        <div className="border border-border rounded-md px-5 py-4">
          <p className="text-[11px] font-light text-muted-foreground mb-4">
            Shown as cards in the team section of the /about page. Leave empty to hide the section.
          </p>
          {teamMembers.length === 0 && (
            <p className="text-xs font-light text-foreground/30 mb-4">No team members added yet.</p>
          )}
          <div className="space-y-5">
            {teamMembers.map((member, i) => (
              <div key={i} className="border border-border/50 rounded-md p-4 relative">
                <button
                  type="button"
                  onClick={() => removeTeamMember(i)}
                  className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Remove team member"
                >
                  <Trash2 size={13} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">Name</label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateTeamMember(i, "name", e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">Role</label>
                    <input
                      type="text"
                      value={member.role}
                      onChange={(e) => updateTeamMember(i, "role", e.target.value)}
                      placeholder="Lead Researcher"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">Bio</label>
                    <textarea
                      value={member.bio}
                      onChange={(e) => updateTeamMember(i, "bio", e.target.value)}
                      placeholder="Short bio — one or two sentences."
                      rows={2}
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-y"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">Photo URL</label>
                    <input
                      type="text"
                      value={member.image_url}
                      onChange={(e) => updateTeamMember(i, "image_url", e.target.value)}
                      placeholder="https://yourdomain.com/team/jane.jpg"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">
                      Credentials <span className="normal-case font-light text-muted-foreground">— shown as a badge for E-E-A-T</span>
                    </label>
                    <input
                      type="text"
                      value={member.credentials ?? ""}
                      onChange={(e) => updateTeamMember(i, "credentials", e.target.value)}
                      placeholder="CPA, 12 years in financial planning"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">LinkedIn URL</label>
                    <input
                      type="text"
                      value={member.linkedin_url ?? ""}
                      onChange={(e) => updateTeamMember(i, "linkedin_url", e.target.value)}
                      placeholder="https://linkedin.com/in/jane-smith"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-foreground/40 block mb-1">Twitter / X URL</label>
                    <input
                      type="text"
                      value={member.twitter_url ?? ""}
                      onChange={(e) => updateTeamMember(i, "twitter_url", e.target.value)}
                      placeholder="https://twitter.com/janesmith"
                      className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addTeamMember}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border border-border text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus size={11} />
            add team member
          </button>
        </div>
      </div>

      {/* ── Logo banner ───────────────────────────────────────────────────── */}
      <Section title="Logo banner">
        <div className="py-4 border-b border-border/40">
          <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
            <div>
              <p className="text-xs font-light text-foreground">Show banner</p>
              <p className="text-[11px] font-light text-muted-foreground mt-0.5 leading-snug">
                Display a trust / tagline line below the hero section.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={showLogoBanner}
                onChange={(e) => {
                  setShowLogoBanner(e.target.checked);
                  if (saveStatus !== "idle") setSaveStatus("idle");
                }}
                className="w-4 h-4 rounded border-border accent-foreground"
              />
              <span className="text-xs font-light text-foreground/70">enabled</span>
            </label>
          </div>
        </div>
        <Field
          label="Banner text"
          hint={`Only visible when "Show banner" is on.`}
          name="logo_banner_text"
          value={form.logo_banner_text}
          onChange={handleChange}
          placeholder="trusted by professionals across various industries worldwide"
          suggestion={getSuggestion("logo_banner_text")}
          {...suggestionProps}
        />
      </Section>

      {/* ── Social & contact ──────────────────────────────────────────────── */}
      <Section title="Social & contact">
        <Field
          label="Facebook URL"
          hint="Full URL to your Facebook page."
          name="facebook_url"
          value={form.facebook_url ?? ""}
          onChange={handleChange}
          placeholder="https://facebook.com/yourbrand"
        />
        <Field
          label="LinkedIn URL"
          hint="Full URL to your LinkedIn page or company profile."
          name="linkedin_url"
          value={form.linkedin_url ?? ""}
          onChange={handleChange}
          placeholder="https://linkedin.com/company/yourbrand"
        />
        <Field
          label="Contact email"
          hint="Shown on the about page if set."
          name="contact_email"
          value={form.contact_email ?? ""}
          onChange={handleChange}
          placeholder="hello@yourdomain.com"
        />
      </Section>

      {/* ── Article images ────────────────────────────────────────────────── */}
      <Section title="Article images">
        <div className="py-4 border-b border-border/40 last:border-0">
          <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
            <div>
              <p className="text-xs font-light text-foreground">Image provider</p>
              <p className="text-[11px] font-light text-muted-foreground mt-0.5 leading-snug">
                How to source a featured image when generating articles.
                <br />
                <span className="text-amber-600/80">Unsplash</span> requires UNSPLASH_ACCESS_KEY env var.
                <br />
                <span className="text-amber-600/80">DALL-E 3</span> requires OPENAI_API_KEY env var.
              </p>
            </div>
            <select
              value={form.image_provider}
              onChange={(e) => handleChange("image_provider", e.target.value)}
              className="w-full text-xs font-light bg-background border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
            >
              <option value="none">None — no image fetched</option>
              <option value="unsplash">Unsplash — free stock photo search</option>
              <option value="dalle">DALL-E 3 — AI image generation</option>
            </select>
          </div>
        </div>
      </Section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <Section title="Footer">
        <Field
          label="Copyright name"
          hint="Shown as © {year} {name}. Defaults to site name."
          name="footer_copyright"
          value={form.footer_copyright}
          onChange={handleChange}
          placeholder="My Site"
          suggestion={getSuggestion("footer_copyright")}
          {...suggestionProps}
        />
      </Section>

      {/* ── Search console ────────────────────────────────────────────────── */}
      <Section title="Search console">
        <Field
          label="Google verification"
          hint="Value from the google-site-verification <meta> tag."
          name="google_verification"
          value={form.google_verification ?? ""}
          onChange={handleChange}
          placeholder="aBcDeFgHiJkLmNoP..."
        />
      </Section>

      {/* ── Save bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || tableMissing}
          title={tableMissing ? "Run the migration first" : undefined}
          className="px-5 py-2 text-xs font-light rounded-md border border-foreground/30 text-foreground hover:border-foreground/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "saving…" : "save settings"}
        </button>
        {tableMissing && (
          <p className="text-xs font-light text-amber-600">run the migration to enable saving.</p>
        )}
        {saveStatus === "saved" && (
          <p className="text-xs font-light text-emerald-600">saved.</p>
        )}
        {saveStatus === "error" && (
          <p className="text-xs font-light text-red-500">{saveError}</p>
        )}
      </div>
    </div>
  );
}
