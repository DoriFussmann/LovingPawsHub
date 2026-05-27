interface LogoBannerProps {
  /** Whether to render the banner at all. Controlled via admin site-settings. */
  show: boolean;
  /** The trust / tagline line displayed in the banner. */
  text: string;
}

export default function LogoBanner({ show, text }: LogoBannerProps) {
  if (!show || !text.trim()) return null;

  return (
    <section className="border-t border-border py-10" style={{ background: "var(--muted)" }}>
      <p className="text-center text-display text-foreground/30 px-4">
        {text}
      </p>
    </section>
  );
}
