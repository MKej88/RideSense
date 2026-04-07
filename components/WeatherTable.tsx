import { ScoredWeatherHour } from "@/lib/types";
import { ScoreBadge } from "@/components/ScoreBadge";

function formatHour(time: string): string {
  return new Date(time).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDirection(direction?: number): string {
  if (direction === undefined) {
    return "-";
  }

  return `${Math.round(direction)}°`;
}

export function WeatherTable({ hours }: { hours: ScoredWeatherHour[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            <th className="px-4 py-3">Tid</th>
            <th className="px-4 py-3">Temp</th>
            <th className="px-4 py-3">Nedbør</th>
            <th className="px-4 py-3">Vind</th>
            <th className="px-4 py-3">Vindkast</th>
            <th className="px-4 py-3">Retning</th>
            <th className="px-4 py-3">Score</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour.time} className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-800">{formatHour(hour.time)}</td>
              <td className="px-4 py-3">{hour.airTemperature.toFixed(1)}°C</td>
              <td className="px-4 py-3">{hour.precipitationAmount.toFixed(1)} mm</td>
              <td className="px-4 py-3">{hour.windSpeed.toFixed(1)} m/s</td>
              <td className="px-4 py-3">{hour.windGust ? `${hour.windGust.toFixed(1)} m/s` : "-"}</td>
              <td className="px-4 py-3">{formatDirection(hour.windFromDirection)}</td>
              <td className="px-4 py-3">
                <ScoreBadge label={hour.scoreLabel} score={hour.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
