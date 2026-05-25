-- SEO Site Template — Supabase Schema
-- Paste the entire contents of this file into the Supabase SQL editor and run it once.
-- This is the single source of truth for the database schema.

-- ── Industries (single row per installation) ──────────────────────────────────
CREATE TABLE industry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Resources ─────────────────────────────────────────────────────────────────
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID REFERENCES industry(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual', -- 'manual' | 'dataforseo'
  domain_authority INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Core Keywords (Tier 1) ────────────────────────────────────────────────────
CREATE TABLE core_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID REFERENCES industry(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  core_id TEXT NOT NULL UNIQUE, -- URL-safe kebab-case e.g. working-capital
  search_volume INTEGER,
  cpc DECIMAL(10,2),
  keyword_difficulty INTEGER,
  trend_data JSONB,
  meta_title TEXT,
  meta_description TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Bridge Keywords (Tier 2) ──────────────────────────────────────────────────
-- bridge_id uses kebab-case. The reserved value 'overview' is used as the
-- bridge_id for all core pillar articles.
CREATE TABLE bridge_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  core_keyword_id UUID REFERENCES core_keywords(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  bridge_id TEXT NOT NULL, -- kebab-case; 'overview' reserved for core pillar articles
  search_volume INTEGER,
  cpc DECIMAL(10,2),
  keyword_difficulty INTEGER,
  trend_data JSONB,
  competition DECIMAL(10,4),
  competition_level TEXT,
  search_intent TEXT,
  cps DECIMAL(10,2),
  meta_title TEXT,
  meta_description TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(core_keyword_id, bridge_id)
);

-- ── Clusters (Tier 3 groups) ──────────────────────────────────────────────────
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_keyword_id UUID REFERENCES bridge_keywords(id) ON DELETE CASCADE,
  cluster_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active' | 'archived'
  link_health TEXT DEFAULT 'unchecked', -- 'unchecked' | 'healthy' | 'issues' | 'rewiring'
  last_link_check TIMESTAMPTZ,
  is_seed BOOLEAN NOT NULL DEFAULT false, -- true for QA smoke-test seed records
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Article Skeletons (briefs without full body content) ──────────────────────
CREATE TABLE article_skeletons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('HUB','FAQ','COMPARISON','RISK','GUIDE','CORE')),
  is_core_article BOOLEAN DEFAULT false,
  primary_keyword TEXT NOT NULL,
  slug TEXT NOT NULL,
  h1_suggestion TEXT,
  meta_title TEXT,
  meta_description TEXT,
  key_messages JSONB,
  suggested_word_count_min INTEGER,
  suggested_word_count_max INTEGER,
  internal_link_targets JSONB,
  external_link_suggestions JSONB,
  schema_type TEXT DEFAULT 'Article',
  status TEXT DEFAULT 'skeleton', -- 'skeleton' | 'drafted' | 'reviewed' | 'published'
  link_status TEXT DEFAULT 'unwired',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_skeleton_cluster_type UNIQUE (cluster_id, content_type)
);

-- ── Articles (full content) ───────────────────────────────────────────────────
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skeleton_id UUID REFERENCES article_skeletons(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  is_core_article BOOLEAN DEFAULT false,
  primary_keyword TEXT NOT NULL,
  slug TEXT NOT NULL,

  -- Routing
  core_id TEXT NOT NULL,
  bridge_id TEXT NOT NULL,

  -- Content
  h1_title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  table_of_contents JSONB,

  -- Featured image (populated at generation time if image_provider is set)
  featured_image_url TEXT,
  featured_image_alt TEXT,

  -- SEO fields
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  robots_directive TEXT DEFAULT 'index, follow',
  schema_markup JSONB,
  key_highlights TEXT[] DEFAULT '{}',

  -- Internal links (injected on publish)
  internal_links_injected JSONB,
  related_articles JSONB,

  -- External links
  external_links JSONB,

  -- Author / reviewer (E-E-A-T)
  reviewer_name TEXT,
  author_url TEXT,

  -- Redirect (301 consolidation)
  redirect_to TEXT,

  -- Writing style variant used at generation time
  -- Values: 'DATA_FORWARD' | 'EXPERT_PRACTITIONER' | 'ANALYTICAL' (see lib/promptTemplates.ts)
  writing_style TEXT,

  -- Status
  status TEXT DEFAULT 'drafted', -- 'drafted' | 'reviewed' | 'published'
  link_status TEXT DEFAULT 'unwired',
  is_seed BOOLEAN NOT NULL DEFAULT false, -- true for QA smoke-test seed records
  published_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Link health log ───────────────────────────────────────────────────────────
CREATE TABLE link_check_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT now(),
  total_articles INTEGER,
  wired INTEGER,
  partial INTEGER,
  broken INTEGER,
  report JSONB
);

-- ── Glossary Terms ───────────────────────────────────────────────────────────
CREATE TABLE glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,  -- kebab-case URL key
  description TEXT,
  examples JSONB DEFAULT '[]',   -- string[]
  resources JSONB DEFAULT '[]',  -- {title: string, url: string}[]

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  og_title TEXT,
  og_description TEXT,

  -- Control
  status TEXT DEFAULT 'published', -- 'published' | 'draft'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Settings — key/value store for prompts, weights, etc. ────────────────────
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Site Config — single-row table for all site-wide settings ─────────────────
-- Edit via /admin/site-settings. All public pages read from this table.
-- Do NOT hardcode site identity values in components or env vars beyond what
-- is needed to bootstrap before this row is populated.
CREATE TABLE site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity
  site_name                TEXT        NOT NULL DEFAULT '',
  site_description         TEXT        NOT NULL DEFAULT '',
  industry_name            TEXT        NOT NULL DEFAULT '', -- replaces NEXT_PUBLIC_INDUSTRY_NAME

  -- Homepage hero
  homepage_title           TEXT        NOT NULL DEFAULT '',
  homepage_headline        TEXT        NOT NULL DEFAULT '',
  homepage_subheadline     TEXT        NOT NULL DEFAULT '',
  hero_body_text           TEXT        NOT NULL DEFAULT '', -- marketing paragraph below subheadline
  hero_cta_primary         TEXT        NOT NULL DEFAULT '', -- primary CTA button label
  hero_cta_secondary       TEXT        NOT NULL DEFAULT '', -- secondary CTA button label

  -- Homepage "who we are" section
  homepage_about_headline  TEXT        NOT NULL DEFAULT '',
  homepage_about_text      TEXT        NOT NULL DEFAULT '',

  -- About page
  about_text               TEXT        NOT NULL DEFAULT '',
  -- Array of {title, body} objects rendered as the editorial standards grid
  about_editorial_standards JSONB,

  -- Team members shown on the /about page and /authors/[slug]/ profile pages.
  -- Array of {name, role, bio, image_url, credentials, linkedin_url, twitter_url} objects.
  -- credentials: short qualifications string shown as an E-E-A-T badge, e.g. "CPA, 12 years in financial planning"
  -- linkedin_url / twitter_url: used for Person schema sameAs and displayed as social links
  team_members             JSONB,

  -- Logo banner (trust line below the hero)
  show_logo_banner         BOOLEAN     NOT NULL DEFAULT false,
  logo_banner_text         TEXT        NOT NULL DEFAULT '',

  -- Social & contact
  twitter_handle           TEXT,
  facebook_url             TEXT,
  linkedin_url             TEXT,
  contact_email            TEXT,

  -- SEO
  og_image_url             TEXT,
  google_verification      TEXT,

  -- Article image generation provider: 'none' | 'unsplash' | 'dalle'
  image_provider           TEXT        NOT NULL DEFAULT 'none',

  -- Footer
  footer_copyright         TEXT        NOT NULL DEFAULT '',

  -- Glossary page SEO
  glossary_meta_title      TEXT        NOT NULL DEFAULT '',
  glossary_meta_description TEXT       NOT NULL DEFAULT '',
  glossary_og_title        TEXT        NOT NULL DEFAULT '',
  glossary_og_description  TEXT        NOT NULL DEFAULT '',

  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce single-row constraint.
CREATE UNIQUE INDEX site_config_singleton ON site_config ((true));

-- Insert default empty row so the admin UI can always upsert.
INSERT INTO site_config (
  site_name, site_description, industry_name,
  homepage_title, homepage_headline, homepage_subheadline,
  hero_body_text, hero_cta_primary, hero_cta_secondary,
  homepage_about_headline, homepage_about_text,
  about_text, about_editorial_standards,
  show_logo_banner, logo_banner_text,
  footer_copyright, image_provider
) VALUES (
  '', '', '',
  '', '', 'expert resources, clearly explained.',
  '', 'read the guide', 'browse articles',
  '', '',
  '', '[{"title":"Independence","body":"No sponsored content. No affiliate arrangements that influence editorial decisions. Our recommendations are based solely on research and analysis."},{"title":"Accuracy","body":"Claims are backed by primary sources. We cite data, link to original research, and distinguish clearly between fact and opinion."},{"title":"Currency","body":"Content is reviewed and updated regularly. Publication and last-updated dates are shown on every article so you know how fresh the information is."}]',
  false, '',
  '', 'unsplash'
);

-- ── Disable RLS on all tables ─────────────────────────────────────────────────
-- Auth is handled at the Next.js middleware level (ADMIN_PASSWORD cookie).
-- The service role key is used for all admin writes; anon key for public reads.
ALTER TABLE industry DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE core_keywords DISABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_keywords DISABLE ROW LEVEL SECURITY;
ALTER TABLE clusters DISABLE ROW LEVEL SECURITY;
ALTER TABLE article_skeletons DISABLE ROW LEVEL SECURITY;
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE link_check_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE glossary_terms DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_config DISABLE ROW LEVEL SECURITY;
