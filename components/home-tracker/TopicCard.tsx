import Link from "next/link";

type Topic = {
  id: string;
  name: string;
  icon: string | null;
  status: string;
  summary: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; ink: string }> = {
  not_started: { label: "Not started", bg: "bg-foreground/5", ink: "text-foreground/40" },
  in_progress:  { label: "In progress", bg: "bg-info-bg",     ink: "text-info-ink" },
  pending:      { label: "Pending",     bg: "bg-warn-bg",     ink: "text-warn-ink" },
  completed:    { label: "Completed",   bg: "bg-ok-bg",       ink: "text-ok-ink" },
  issue:        { label: "Issue",       bg: "bg-err-bg",      ink: "text-err-ink" },
};

export default function TopicCard({ topic }: { topic: Topic }) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.not_started;

  return (
    <Link
      href={`/tools/home-tracker/topic/${topic.id}`}
      className="group flex flex-col border border-border rounded-md p-4 bg-card hover:border-foreground/25 hover:shadow-sh1 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {topic.icon && <span className="text-lg leading-none">{topic.icon}</span>}
          <span className="text-sm font-light text-foreground leading-snug">{topic.name}</span>
        </div>
        <span
          className={`shrink-0 text-[9px] tracking-widest uppercase rounded px-1.5 py-0.5 font-light ${cfg.bg} ${cfg.ink}`}
        >
          {cfg.label}
        </span>
      </div>
      {topic.summary && (
        <p className="text-xs font-light text-muted-foreground leading-relaxed flex-1 line-clamp-2">
          {topic.summary}
        </p>
      )}
      <div className="mt-3 text-[10px] tracking-widest uppercase text-foreground/25 group-hover:text-foreground/50 transition-colors">
        open →
      </div>
    </Link>
  );
}
