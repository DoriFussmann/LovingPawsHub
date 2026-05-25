import SmokeTestClient from "./SmokeTestClient";

export const dynamic = "force-dynamic";

export default function SmokeTestPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-1">
          qa
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground">
          smoke test
        </h1>
        <p className="text-xs font-light text-muted-foreground mt-1">
          validates the full seo content loop against seed articles
        </p>
      </div>
      <SmokeTestClient />
    </div>
  );
}
