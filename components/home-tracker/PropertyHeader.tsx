type Property = {
  address: string;
  purchase_price: number | null;
  closing_date: string | null;
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PropertyHeader({ property }: { property: Property }) {
  const days = property.closing_date ? daysUntil(property.closing_date) : null;

  return (
    <div className="mb-8">
      <h1 className="text-xl md:text-2xl font-extralight tracking-tight text-foreground mb-1 leading-snug">
        {property.address}
      </h1>
      <div className="flex flex-wrap items-center gap-4 mt-2">
        {property.purchase_price && (
          <span className="text-sm font-light text-muted-foreground">
            ${property.purchase_price.toLocaleString()}
          </span>
        )}
        {property.closing_date && (
          <span className="text-sm font-light text-muted-foreground">
            Closing{" "}
            {new Date(property.closing_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
        {days !== null && (
          <span
            className={`text-xs font-light rounded px-2 py-0.5 ${
              days < 0
                ? "bg-err-bg text-err-ink"
                : days <= 7
                ? "bg-warn-bg text-warn-ink"
                : "bg-ok-bg text-ok-ink"
            }`}
          >
            {days < 0
              ? `${Math.abs(days)} days ago`
              : days === 0
              ? "Today"
              : `${days} days away`}
          </span>
        )}
      </div>
    </div>
  );
}
