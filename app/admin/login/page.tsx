"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError("incorrect password");
      }
    } catch {
      setError("something went wrong. try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-2">
            ace admin
          </p>
          <h1 className="text-2xl font-extralight tracking-tight text-foreground">
            sign in
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              autoFocus
              className="w-full text-xs font-light rounded-md border border-border px-3 py-2 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50"
            />
          </div>

          {error && (
            <p className="text-xs font-light text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-1.5 text-xs font-light rounded-md border border-border bg-foreground text-background disabled:opacity-50"
          >
            {loading ? "signing in..." : "sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
