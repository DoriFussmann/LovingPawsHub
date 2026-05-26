"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/tools/home-tracker/onboarding";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled in Supabase, the user is logged in immediately
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      router.push(next);
      router.refresh();
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
            home tracker
          </p>
          <h1 className="text-2xl font-extralight tracking-tight text-foreground mb-4">
            Check your inbox
          </h1>
          <p className="text-sm font-light text-muted-foreground">
            We sent a confirmation link to <strong className="font-medium">{email}</strong>.
            Click it to activate your account and get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-3">
          home tracker
        </p>
        <h1 className="text-2xl font-extralight tracking-tight text-foreground mb-2">
          Create account
        </h1>
        <p className="text-sm font-light text-muted-foreground mb-8">
          Set up your property tracking dashboard.
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-xs font-light text-foreground/70 mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-xs font-light text-muted-foreground text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
