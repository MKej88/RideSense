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
    <span className="inline-flex items-center justify-center" aria-label={`Vær: ${label}`} title={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/weather-symbol?code=${encodeURIComponent(normalized)}`}
        alt=""
        width={compact ? 28 : 36}
        height={compact ? 28 : 36}
        className={`${compact ? "h-7 w-7" : "h-9 w-9"} object-contain`}
      />
    </span>
  );
}
