interface LogoBannerProps {
  /** Whether to render the banner at all. Controlled via admin site-settings. */
  show: boolean;
  /** The trust / tagline line displayed in the banner. */
  text: string;
}

export default function LogoBanner({ show, text }: LogoBannerProps) {
  if (!show || !text.trim()) return null;

  return (
    <section className="border-t border-border/30 py-10">
      <p className="text-center text-xl md:text-2xl font-extralight tracking-tight text-foreground/30 px-4 leading-tight">
        {text}
      </p>
    </section>
  );
}
