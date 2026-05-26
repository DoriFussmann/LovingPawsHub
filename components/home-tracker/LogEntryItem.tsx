type LogEntry = {
  id: string;
  content: string;
  ai_summary: string | null;
  created_at: string;
};

export default function LogEntryItem({ entry }: { entry: LogEntry }) {
  return (
    <div className="border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-4 mb-1">
        <p className="text-sm font-light text-foreground leading-relaxed flex-1">
          {entry.ai_summary || entry.content}
        </p>
        <time className="shrink-0 text-[10px] text-foreground/30 mt-0.5">
          {new Date(entry.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      {entry.ai_summary && (
        <p className="text-xs font-light text-muted-foreground leading-relaxed">
          {entry.content}
        </p>
      )}
    </div>
  );
}
