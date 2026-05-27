import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/public/Header";
import Footer from "@/components/public/Footer";
import { siteUrl } from "@/lib/site-url";
import { getSiteConfig, cfg } from "@/lib/site-config";
import {
  generateOrganizationSchema,
  generateWebSiteSchema,
} from "@/lib/seo";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const siteDescription = cfg(config, "site_description");
  const googleVerification = config?.google_verification?.trim() || null;
  const ogImageUrl = config?.og_image_url ||
    (siteUrl ? `${siteUrl}/og?site=${encodeURIComponent(siteName)}` : null);
  const twitterHandle = config?.twitter_handle || null;

  return {
    title: siteName
      ? { default: siteName, template: `%s | ${siteName}` }
      : { default: "", template: "%s" },
    description: siteDescription || undefined,
    metadataBase: new URL(siteUrl),
    openGraph: {
      siteName: siteName || undefined,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
      ...(twitterHandle ? { creator: twitterHandle, site: twitterHandle } : {}),
    },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }],
      apple: "/apple-touch-icon.png",
    },
    ...(googleVerification && {
      verification: { google: googleVerification },
    }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getSiteConfig();
  const siteName = cfg(config, "site_name");
  const ogImageUrl = config?.og_image_url || null;

  const orgSchema = generateOrganizationSchema(siteName, ogImageUrl, {
    linkedin_url: config?.linkedin_url,
    facebook_url: config?.facebook_url,
    twitter_handle: config?.twitter_handle,
  });
  const webSiteSchema = generateWebSiteSchema(siteName);

  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
        <Header siteName={siteName} />
        <main>{children}</main>
        <Footer />
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
