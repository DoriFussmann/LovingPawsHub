interface StatusBadgeProps {
  status: string;
  size?: "xs" | "sm";
}

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  // Article / Skeleton statuses
  published: { label: "published", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  reviewed: { label: "reviewed", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  drafted: { label: "drafted", classes: "bg-blue-50 text-blue-600 border-blue-200" },
  skeleton: { label: "skeleton", classes: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  // Link statuses
  wired: { label: "wired", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "partial", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  broken: { label: "broken", classes: "bg-red-50 text-red-700 border-red-200" },
  unwired: { label: "unwired", classes: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  // Cluster health
  healthy: { label: "healthy", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  issues: { label: "issues", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  unchecked: { label: "—", classes: "bg-neutral-100 text-neutral-400 border-neutral-200" },
  rewiring: { label: "rewiring", classes: "bg-blue-50 text-blue-600 border-blue-200" },
  // KD
  low: { label: "low", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium: { label: "medium", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "high", classes: "bg-red-50 text-red-700 border-red-200" },
  // Active
  active: { label: "active", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  archived: { label: "archived", classes: "bg-neutral-100 text-neutral-500 border-neutral-200" },
};

export default function StatusBadge({ status, size = "xs" }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    classes: "bg-neutral-100 text-neutral-500 border-neutral-200",
  };

  return (
    <span
      className={`inline-flex items-center border rounded px-1.5 py-0.5 font-medium tracking-widest uppercase ${
        size === "xs" ? "text-[9px]" : "text-[10px]"
      } ${config.classes}`}
    >
      {config.label}
    </span>
  );
}

export function kdStatusFromValue(kd: number): string {
  if (kd < 20) return "low";
  if (kd <= 50) return "medium";
  return "high";
}
