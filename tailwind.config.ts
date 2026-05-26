import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Semantic tokens (used throughout the codebase) ── */
        foreground: "var(--foreground)",
        background: "var(--background)",
        card: "var(--card)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        primary: "var(--primary)",
        "primary-ink": "var(--primary-ink)",

        /* ── Sage (forest green) palette ── */
        sage: {
          50: "var(--sage-50)",
          100: "var(--sage-100)",
          200: "var(--sage-200)",
          300: "var(--sage-300)",
          400: "var(--sage-400)",
          500: "var(--sage-500)",
          600: "var(--sage-600)",
          700: "var(--sage-700)",
          800: "var(--sage-800)",
          900: "var(--sage-900)",
        },

        /* ── Cream palette ── */
        cream: {
          50: "var(--cream-50)",
          100: "var(--cream-100)",
          200: "var(--cream-200)",
          300: "var(--cream-300)",
        },

        /* ── Ink (neutral dark) palette ── */
        ink: {
          100: "var(--ink-100)",
          200: "var(--ink-200)",
          300: "var(--ink-300)",
          400: "var(--ink-400)",
          500: "var(--ink-500)",
          700: "var(--ink-700)",
          900: "var(--ink-900)",
        },

        /* ── Slate (blue-gray) palette ── */
        "ds-slate": {
          100: "var(--slate-100)",
          300: "var(--slate-300)",
          500: "var(--slate-500)",
          700: "var(--slate-700)",
        },

        /* ── Clay (warm amber) palette ── */
        clay: {
          300: "var(--clay-300)",
          500: "var(--clay-500)",
          700: "var(--clay-700)",
        },

        /* ── Status colors ── */
        "ok-bg": "var(--ok-bg)",
        "ok-ink": "var(--ok-ink)",
        "warn-bg": "var(--warn-bg)",
        "warn-ink": "var(--warn-ink)",
        "err-bg": "var(--err-bg)",
        "err-ink": "var(--err-ink)",
        "info-bg": "var(--info-bg)",
        "info-ink": "var(--info-ink)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
