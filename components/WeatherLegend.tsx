import { WeatherConditionBadge } from "@/components/WeatherConditionBadge";
import { getWeatherLegendItems } from "@/lib/weather-condition";

export function WeatherLegend() {
  const legendItems = getWeatherLegendItems();

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Legend</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {legendItems.map((item) => (
          <WeatherConditionBadge key={item.key} visual={item} compact />
        ))}
      </div>
    </div>
  );
}
