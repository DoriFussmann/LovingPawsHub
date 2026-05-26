import Link from "next/link";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-24 text-center">
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-4">404</p>
      <h1 className="text-3xl font-extralight tracking-tight text-foreground mb-4">
        page not found.
      </h1>
      <p className="text-sm font-light text-muted-foreground mb-10">
        This page doesn&apos;t exist or has been moved. Head back to Closing Day Ready.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/"
          className="text-xs font-light border border-border rounded-md px-4 py-2 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          home
        </Link>
        <Link
          href="/articles"
          className="text-xs font-light border border-accent rounded-md px-4 py-2 bg-accent text-accent-foreground hover:bg-sage-800 hover:border-sage-800 transition-colors"
        >
          browse articles
        </Link>
      </div>
    </div>
  );
}
