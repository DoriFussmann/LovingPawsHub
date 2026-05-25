/**
 * Single source of truth for the canonical site URL.
 *
 * NEXT_PUBLIC_SITE_URL is required. The app will throw at startup if it is
 * not set. Configure it in your Vercel project environment variables for
 * production, and in .env.local for local development.
 *
 * Example: NEXT_PUBLIC_SITE_URL=https://www.yourdomain.com
 */
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error(
    'NEXT_PUBLIC_SITE_URL is required but not set. ' +
    'Add it to your environment variables (Vercel → Settings → Environment Variables, ' +
    'or .env.local for local development).'
  );
}

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
