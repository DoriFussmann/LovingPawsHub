import { Trash2 } from "lucide-react";
import StatusBadge, { kdStatusFromValue } from "./StatusBadge";

interface KeywordRowProps {
  keyword: string;
  searchVolume: number;
  cpc: number;
  keywordDifficulty: number;
  trend: number[];
  suggestedId?: string;
  checked: boolean;
  disabled?: boolean;
  savedLabel?: string;
  onToggle: () => void;
  // Extended
  competition?: number;
  competitionLevel?: string;
  searchIntent?: string;
  cps?: number;
  score?: number;
  onDelete?: () => void;
  hideAction?: boolean;
  coreLabel?: string;
}

const INTENT_LABELS: Record<string, string> = {
  informational: "info",
  commercial: "comm",
  transactional: "trans",
  navigational: "nav",
};

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-neutral-100 text-neutral-500 border-neutral-200",
  commercial: "bg-blue-50 text-blue-600 border-blue-200",
  transactional: "bg-emerald-50 text-emerald-700 border-emerald-200",
  navigational: "bg-amber-50 text-amber-700 border-amber-200",
};


function Sparkline({ values }: { values: number[] }) {
  const recent = values.slice(-6);
  if (recent.length === 0) return null;
  const max = Math.max(...recent, 1);
  const barWidth = 6;
  const gap = 2;
  const height = 20;
  const width = recent.length * (barWidth + gap) - gap;

  return (
    <svg width={width} height={height} className="inline-block">
      {recent.map((val, i) => {
        const barHeight = Math.max(2, Math.round((val / max) * height));
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1}
            className="fill-foreground/20"
          />
        );
      })}
    </svg>
  );
}

export default function KeywordRow({
  keyword,
  searchVolume,
  cpc,
  keywordDifficulty,
  trend,
  checked,
  disabled,
  onToggle,
  competition,
  searchIntent,
  cps,
  score,
  onDelete,
  hideAction,
  coreLabel,
}: KeywordRowProps) {
  const intentKey = searchIntent?.toLowerCase() ?? "informational";

  return (
    <tr
      onClick={() => !disabled && onToggle()}
      className={`border-b border-border/20 last:border-0 text-xs font-light transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-muted/50"
      } ${checked ? "bg-foreground/5" : ""}`}
    >
      {/* Optional core keyword column — only in all-bridges overview */}
      {coreLabel !== undefined && (
        <td className="px-3 py-2 text-[11px] font-light text-foreground/50 whitespace-nowrap">{coreLabel}</td>
      )}

      {/* Action: delete / checkbox / empty */}
      <td className="px-3 py-2 w-8">
        {hideAction ? null : onDelete ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        ) : (
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={() => {}}
            className="w-3 h-3 rounded border-border"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </td>

      {/* Keyword */}
      <td className="px-3 py-2 font-light text-foreground">
        <div>{keyword}</div>
      </td>

      {/* Score — first sortable column */}
      <td className="px-3 py-2 text-right tabular-nums font-medium">
        {score != null ? score.toFixed(0) : "—"}
      </td>

      {/* Volume */}
      <td className="px-3 py-2 text-right tabular-nums">
        {searchVolume.toLocaleString()}
      </td>

      {/* CPC */}
      <td className="px-3 py-2 text-right tabular-nums">
        ${cpc.toFixed(2)}
      </td>

      {/* KD */}
      <td className="px-3 py-2 text-right">
        <StatusBadge status={kdStatusFromValue(keywordDifficulty)} />
        <span className="ml-1.5">{keywordDifficulty}</span>
      </td>

      {/* Competition */}
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {competition != null ? competition.toFixed(2) : "—"}
      </td>

      {/* CPS */}
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {cps != null ? cps.toFixed(1) : "—"}
      </td>

      {/* Search Intent */}
      <td className="px-3 py-2">
        <span className={`inline-flex items-center border rounded px-1.5 py-0.5 text-[9px] font-medium tracking-widest uppercase ${INTENT_COLORS[intentKey] ?? INTENT_COLORS.informational}`}>
          {INTENT_LABELS[intentKey] ?? intentKey}
        </span>
      </td>

      {/* Trend */}
      <td className="px-3 py-2">
        <Sparkline values={trend} />
      </td>
    </tr>
  );
}
