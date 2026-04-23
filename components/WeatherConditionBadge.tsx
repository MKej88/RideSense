import { WeatherConditionVisual } from "@/lib/weather-condition";

interface WeatherConditionBadgeProps {
  visual: WeatherConditionVisual;
  compact?: boolean;
}

export function WeatherConditionBadge({ visual, compact = false }: WeatherConditionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-slate-100 ${
        compact ? "text-xs" : "text-sm"
      }`}
      aria-label={`Værkategori: ${visual.label}`}
      title={`Værkategori: ${visual.label}`}
    >
      <span aria-hidden="true">{visual.icon}</span>
      <span>{visual.label}</span>
    </span>
  );
}
