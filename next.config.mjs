/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk", "react-markdown", "remark-gfm"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      // Unsplash (image_provider: 'unsplash')
      { protocol: "https", hostname: "images.unsplash.com" },
      // DALL-E 3 returns oaidalleapiprodscus.blob.core.windows.net URLs
      { protocol: "https", hostname: "*.blob.core.windows.net" },
      // OpenAI CDN
      { protocol: "https", hostname: "*.openai.com" },
    ],
  },
};

export default nextConfig;
