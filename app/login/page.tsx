"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/tools/home-tracker/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(next);
    });
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
          home tracker
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground mb-2">
          Sign in
        </h1>
        <p className="text-sm font-light text-muted-foreground mb-8">
          Access your property tracking dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-light text-foreground/70 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-light text-foreground/70 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs font-light text-err-ink bg-err-bg rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-light bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs font-light text-muted-foreground text-center">
          No account?{" "}
          <Link
            href={`/signup${next !== "/tools/home-tracker/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
