import { MetadataRoute } from "next";
import { getSiteConfig, cfg } from "@/lib/site-config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getSiteConfig();
  const name = cfg(config, "site_name", "My Site");
  const shortName = name.split(" ").slice(0, 2).join(" ");

  return {
    name,
    short_name: shortName,
    description: cfg(config, "site_description", ""),
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#2e4929",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
