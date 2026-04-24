interface WeatherSymbolBadgeProps {
  symbolCode?: string;
  compact?: boolean;
}

function normalizeSymbolCode(symbolCode?: string): string {
  const value = symbolCode?.trim().toLowerCase();
  return value && value.length > 0 ? value : "unknown";
}

function formatSymbolLabel(symbolCode?: string): string {
  const normalized = normalizeSymbolCode(symbolCode);
  const withoutPeriod = normalized.replace(/_(day|night|polartwilight)$/, "");

  return withoutPeriod
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function WeatherSymbolBadge({ symbolCode, compact = false }: WeatherSymbolBadgeProps) {
  const normalized = normalizeSymbolCode(symbolCode);
  const label = formatSymbolLabel(symbolCode);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-slate-100 ${
        compact ? "text-xs" : "text-sm"
      }`}
      aria-label={`Vær: ${label}`}
      title={`Vær: ${label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/weather-symbol?code=${encodeURIComponent(normalized)}`}
        alt=""
        width={compact ? 16 : 20}
        height={compact ? 16 : 20}
        className="h-4 w-4 object-contain"
      />
      <span>{label}</span>
    </span>
  );
}
