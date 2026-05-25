import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Public URL redirects ────────────────────────────────────────────────────
  // These handle two legacy URL shapes that were produced before the SEO fixes:
  //   1. Underscores in core_id / bridge_id segments → hyphens  (301)
  //   2. Pillar articles where core_id === bridge_id → /[core]/overview/  (301)
  //   3. redirect_to DB field set on a published article → 301 to target
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
    const segments = pathname.split("/").filter(Boolean);

    // Case 1: Any path segment contains underscores → redirect to hyphenated version.
    // Slugs already use hyphens; underscores can only appear in old core/bridge IDs.
    if (/_/.test(pathname)) {
      const newPath = "/" + segments.map((s) => s.replace(/_/g, "-")).join("/");
      const url = request.nextUrl.clone();
      url.pathname = newPath.endsWith("/") ? newPath : newPath + "/";
      return NextResponse.redirect(url, { status: 301 });
    }

    // Case 2: 3-segment URL where the first two segments are identical.
    // Old pillar article URLs: /personal-loans/personal-loans/slug/
    // → /personal-loans/overview/slug/
    if (segments.length >= 2 && segments[0] === segments[1]) {
      const newPath = "/" + [segments[0], "overview", ...segments.slice(2)].join("/") + "/";
      const url = request.nextUrl.clone();
      url.pathname = newPath;
      return NextResponse.redirect(url, { status: 301 });
    }

    // Case 3: Article-level redirect_to — only check 3-segment article URLs.
    // Avoids DB lookups on category hub pages and other routes.
    if (segments.length === 3) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
          .from("articles")
          .select("redirect_to")
          .eq("core_id", segments[0])
          .eq("bridge_id", segments[1])
          .eq("slug", segments[2])
          .eq("status", "published")
          .maybeSingle();

        if (data?.redirect_to) {
          const url = request.nextUrl.clone();
          url.pathname = data.redirect_to.endsWith("/")
            ? data.redirect_to
            : data.redirect_to + "/";
          return NextResponse.redirect(url, { status: 301 });
        }
      } catch {
        // DB unavailable — fall through and serve the page normally
      }
    }
  }

  // ── Admin auth ──────────────────────────────────────────────────────────────
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("admin_auth");

  if (authCookie?.value === process.env.ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname === "/admin/login/") {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  // Run on all routes except static assets and image optimisation routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
