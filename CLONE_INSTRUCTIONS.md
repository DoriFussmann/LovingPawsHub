# How to Clone This Template for a New Industry

This guide walks you through spinning up a completely separate copy of this site — with its own database, its own domain, and its own Vercel deployment — from scratch. You will not touch the original project at all.

**One site = one GitHub repo + one Supabase project + one Vercel project.** Never share a database between two sites.

---

## Accounts you need before starting

**Required:**
- [GitHub](https://github.com) — where the code lives
- [Vercel](https://vercel.com) — where the site is hosted
- [Supabase](https://supabase.com) — the database
- [Anthropic](https://console.anthropic.com) — the AI that writes your articles
- [DataForSEO](https://dataforseo.com) — keyword research

**Optional (for article images):**
- [Unsplash Developers](https://unsplash.com/developers) — free stock photo API (free tier, 50 requests/hour). Choose this if you want real photography.
- [OpenAI](https://platform.openai.com) — DALL-E 3 image generation. Choose this if you want AI-generated illustrations.

You only need one image provider, or none at all.

---

## Step 1 — Copy the code to a new GitHub repository

1. On GitHub, create a brand new **private** repository. Leave it completely empty — no README, no files.
2. On your computer, open a terminal in this project folder and run:
   ```
   git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_NEW_REPO.git
   git push -u origin main
   ```
3. Confirm on GitHub that you can see all the files in the new repo.

> Alternatively, download this project as a ZIP, extract it to a new folder, and push it to a fresh repo manually.

---

## Step 2 — Create a new Supabase database

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**. Name it, choose a region close to your audience, and set a strong database password.
3. Wait about two minutes for it to finish setting up.
4. Click **SQL Editor** in the left sidebar.
5. Open `db/schema.sql` from this project, copy the **entire contents**, paste it into the SQL Editor, and click **Run**.
   - You should see a success message with no errors.
   - This creates all tables, sets defaults, seeds an empty `site_config` row, and disables Row Level Security. It is one paste — no need to run anything else.
6. Go to **Project Settings → API**. You need three values:
   - **Project URL** — shown as "API URL" in the Data API section (e.g. `https://xxxxxxxxxxx.supabase.co`)
   - **anon / public** key — under "Project API Keys"
   - **service_role** key — marked "secret", click to reveal it

Keep this browser tab open for Step 4.

---

## Step 3 — Create a new Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Select **Import Git Repository** and choose the new GitHub repo from Step 1.
4. Vercel will detect it as a Next.js project. **Do not click Deploy yet** — set environment variables first.

---

## Step 4 — Set your environment variables in Vercel

In the Vercel project setup, find the **Environment Variables** section and add each of the following.

### Required

| Variable | What to put in it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The **Project URL** from Supabase Step 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **anon / public** key from Supabase Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service_role** key from Supabase Step 2 |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `DATAFORSEO_LOGIN` | Your DataForSEO account email |
| `DATAFORSEO_PASSWORD` | Your DataForSEO account password |
| `ADMIN_PASSWORD` | A password you choose — protects your `/admin` area |
| `NEXT_PUBLIC_SITE_URL` | Your full domain with `https://` and no trailing slash (e.g. `https://www.legaledge.com`). **Required** — the build will throw if this is missing. For local dev use `http://localhost:3000`. |

### Optional — article images

Set one of these if you want articles to automatically include a featured image.

| Variable | When to set it |
|---|---|
| `UNSPLASH_ACCESS_KEY` | When using Unsplash (stock photography). Get it from [unsplash.com/developers](https://unsplash.com/developers). |
| `OPENAI_API_KEY` | When using DALL-E 3 (AI-generated images). Get it from [platform.openai.com](https://platform.openai.com). |

After setting the API key, activate it in the admin: **Site Settings → Article images → Image provider**.

### Optional — analytics

| Variable | When to set it |
|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Your Google Analytics 4 measurement ID (e.g. `G-XXXXXXXXXX`). Vercel Analytics is included automatically when deployed to Vercel — no env var needed. |

### Legacy / bootstrap overrides (no longer required)

`NEXT_PUBLIC_SITE_NAME` and `NEXT_PUBLIC_INDUSTRY_NAME` are legacy fallbacks. The canonical source for both values is now the `site_config` table, editable at `/admin/site-settings`. You can set them as temporary bootstraps but should move everything into the admin UI after first deploy.

> **Security:** Never commit these values to a public repository. The `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` give full access to your database and AI account.

> **www vs non-www — important:** `NEXT_PUBLIC_SITE_URL` is the single source of truth for every canonical URL, sitemap entry, and JSON-LD schema on the site. It must exactly match the primary domain you configure in Vercel. If your site loads on `https://www.yourdomain.com`, set this to `https://www.yourdomain.com` (with `www`). A mismatch means every canonical tag points to the wrong origin — a common cause of "canonical points to non-www while domain loads on www" issues. Choose one form (www or non-www) and use it everywhere.

---

## Step 5 — Add your custom domain

1. In Vercel, go to your project → **Settings → Domains**.
2. Add **both** `www.yourdomain.com` and `yourdomain.com` (the apex).
3. Set one as the **primary** (canonical) domain. Vercel shows a radio button for this. Recommended: use `www` as your primary.
4. Vercel will automatically create a 301 redirect from the non-primary form to the primary. This keeps all signals on one canonical origin.
5. Make sure `NEXT_PUBLIC_SITE_URL` (Step 4) matches the primary domain exactly.
6. DNS changes take a few minutes to a few hours. Vercel shows a green checkmark per domain once confirmed.

If you don't have a domain yet, Vercel gives you a free `*.vercel.app` subdomain to start.

### GoDaddy DNS setup

Add these records in **GoDaddy → DNS → Manage Zones**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `www` | `cname.vercel-dns.com` | 600 |
| A | `@` (apex) | `76.76.21.21` | 600 |

- The CNAME points `www` to Vercel's edge network.
- The A record (`@`) points the bare apex to Vercel's anycast IP.
- **Do not** use GoDaddy's "Forward Domain" feature — let Vercel handle the www ↔ apex redirect. GoDaddy forwarding is slow, breaks HTTPS, and bypasses the 301 Vercel sets up.
- After saving DNS records, go back to Vercel and click **Verify** next to each domain. It may take up to an hour to propagate.

---

## Step 6 — Deploy for the first time

Go back to your Vercel project and click **Deploy** (or it may start automatically after you set environment variables). The build takes about a minute. Watch for a green "Deployment complete" message.

**If the build fails**, the error is almost always one of these:
- `NEXT_PUBLIC_SITE_URL is required but not set` — add the variable and redeploy
- A Supabase connection error — check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are spelled exactly right with no quotes or spaces
- The schema was not run — go back and run `db/schema.sql` in the Supabase SQL Editor

---

## Step 7 — Configure your site in the admin

Visit your site's URL and go to `/admin`. Enter the `ADMIN_PASSWORD` you set in Step 4.

Go to **Site Settings** first. Use the **AI populate** panel at the top to generate all copy at once: describe your site in a sentence or two, click "see suggestions", then confirm, edit, or discard each field.

Fill in every section manually if you prefer:

**Identity**
- **Site name** — your brand name (e.g. `LegalEdge`)
- **Industry** — plain-language industry label (e.g. `legal services`). This is used in article generation prompts and page copy.
- **Site description** — one sentence for search results
- **Twitter / X handle** — without the `@`
- **OG image** — click "generate" for an auto-generated image from your site name, or paste a URL to a custom image

**Homepage — hero**
- **Page title** — the `<title>` tag
- **H1 headline** — the large heading
- **Sub-headline** — the line below the H1
- **Body paragraph** — the marketing text below the sub-headline. Leave blank to auto-generate from your industry name.
- **Primary CTA** — the main button label (e.g. "read the guide")
- **Secondary CTA** — the secondary button label (e.g. "browse articles")

**Homepage — who we are**
- Headline and body text for the "about us" section shown on the homepage.

**About page**
- **About text** — the mission paragraph at the top of `/about`. Use `{SITE_NAME}` and `{INDUSTRY_NAME}` as placeholders.

**Editorial standards**
- Add, remove, or edit the principles shown in the grid on `/about`. The AI suggest will generate three tailored to your industry. You can add more or remove them.

**Team members**
- Add your team: name, role, bio, photo URL. Photos can be hosted anywhere (Supabase Storage, Cloudinary, a CDN, etc.).
- Also fill in **Credentials** (e.g. `CPA, 12 years in financial planning`) — this is shown as an E-E-A-T badge on the About page and on each author's profile page, and is included in the Person JSON-LD schema under `description`.
- Add **LinkedIn URL** and **Twitter / X URL** for each member. These appear as social links on the about and author pages, and are added to the Person schema's `sameAs` array — a direct E-E-A-T signal for Google.
- After saving, visit `/authors/[slug]/` to verify each author profile shows the photo, credentials, bio, and social links correctly. An author profile with no data is worse than having no profile pages at all.

> **E-E-A-T tip:** Team member profiles are one of the highest-leverage E-E-A-T signals for content sites. A reviewer name on an article only works if the linked author page looks credible. Photo + credentials + bio + social links is the minimum viable profile.

**Logo banner** — optional trust line below the hero.

**Social & contact** — Facebook URL, LinkedIn URL, contact email.

**Article images** — choose your image provider: None, Unsplash, or DALL-E 3. Make sure the corresponding API key env var is set first.

**Footer** — copyright name.

**Search console** — paste the value from the `google-site-verification` meta tag here.

**Glossary SEO** — page-level title and description for `/glossary/` are configured in **Admin → Glossary → Glossary SEO**, not here.

Click **save settings** when done.

---

## Step 8 — Build your content

The workflow goes in this order:

1. **Research** (`/admin/research`) — Type your industry and let the tool find core keywords via DataForSEO. Select the ones that make sense for your site and save them.

2. **Bridges** (`/admin/bridges`) — For each core keyword, discover the bridge keywords (the next level down). Select the relevant ones.

3. **Clusters** (`/admin/clusters`) — Group bridge keywords into clusters. Each cluster becomes a set of related articles.

4. **Skeletons / Briefs** (`/admin/skeletons`) — Generate article briefs using AI. These are outlines with metadata, word counts, and link suggestions — no full content yet.

5. **Articles** (`/admin/articles`) — Select skeletons and generate full articles. If you have an image provider configured, each article will automatically receive a featured image. Review and edit articles, then publish.

   **Writing styles:** Each article is automatically assigned one of three prose styles at generation time — *Data-Forward*, *Expert Practitioner*, or *Analytical* — based on the article ID. This varies the texture across your content so articles don't read as uniformly AI-generated. The style used is stored in the `writing_style` column for reference.

   **Publish date:** The article editor shows a date picker next to the publish button. It defaults to today but can be backdated up to 60 days. Use this to stagger publication dates across your content rather than publishing everything on the same day. Dates in the past 30 days work well — they reflect realistic editorial scheduling without appearing suspicious.

   **Per-article SEO overrides:** The article editor exposes OG title, OG description, canonical URL override, and robots directive fields. Leave them blank to use the defaults (meta title/description, self-referencing canonical, index/follow). Only set these when you need to deviate from the default — for example, to `noindex, follow` a thin page, or to point the canonical at a different URL for syndicated content.

6. **Glossary** (`/admin/glossary`) — Build a glossary of key industry terms. Each term gets its own `/glossary/{slug}/` page with `DefinedTerm` structured data, and the index at `/glossary/` gets `DefinedTermSet` schema — both are strong entity-SEO signals.

   - Use **AI suggest** to generate a batch of relevant terms for your industry, then review and publish.
   - Use **AI complete** on individual terms to auto-fill the description, examples, and per-term meta title/description and OG fields.
   - The **Glossary SEO** panel at the top of the admin lets you set the page-level meta title, meta description, OG title, and OG description for the `/glossary/` index page. These default to industry-aware fallbacks if left blank.
   - Terms are sorted by `sort_order` (ascending) then alphabetically. Set `sort_order` to pin important terms to the top.
   - The glossary is linked in the main nav automatically. Publish at least a handful of terms before launching so the page has substance.

7. **Links** (`/admin/links`) — After publishing a full cluster, run a link check. The tool verifies internal links and can rewire them if anything is broken.

---

## Common mistakes and fixes

**`NEXT_PUBLIC_SITE_URL is required but not set`**
Add the environment variable in Vercel → Environment Variables, then redeploy.

**Build fails with a Supabase error**
Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are spelled exactly right, with no spaces or quotes around the values.

**Admin shows no data after logging in**
The schema was not run. Go to Supabase → SQL Editor, paste the entire contents of `db/schema.sql`, and run it.

**Articles are not showing on the public site**
Make sure the article status is `published`, not `drafted` or `reviewed`. Only published articles appear publicly.

**Article images are not being generated**
Check that: (a) you have set the correct API key env var (`UNSPLASH_ACCESS_KEY` or `OPENAI_API_KEY`), (b) you have selected the corresponding provider in Site Settings → Article images, and (c) you redeploy after changing env vars.

**The "regenerate image" button in the article editor says "Image provider is set to 'none'"**
Go to Admin → Site Settings → Article images and choose a provider.

**Industry name or site name shows a fallback value**
Go to Admin → Site Settings → Identity, fill in the Site name and Industry fields, and save.

**You changed a setting but the public site still shows the old value**
Click save in the admin, then wait up to an hour for the ISR cache to expire. Or trigger a redeploy in Vercel to clear all caches immediately.

---

## Starting fresh on an existing installation

To wipe all content without deleting the Supabase project, go to `/admin`, scroll to the **Danger Zone** at the bottom of the dashboard, and use **Clear Everything**. This wipes all content, keywords, and site settings, leaving an empty database ready for a new industry.

---

## If you want to clone again in the future

Follow this same guide from Step 1. The key principle: one site = one GitHub repo + one Supabase project + one Vercel project.
