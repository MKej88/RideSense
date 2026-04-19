import { ScoredWeatherHour } from "@/lib/types";
import { ScoreBadge } from "@/components/ScoreBadge";

function formatHour(time: string): string {
  return new Date(time).toLocaleString("nb-NO", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo"
  });
}

function formatDirection(direction?: number): string {
  if (direction === undefined) {
    return "-";
  }

  const normalized = ((direction % 360) + 360) % 360;
  const compassDirections = [
    "nord",
    "nordøst",
    "øst",
    "sørøst",
    "sør",
    "sørvest",
    "vest",
    "nordvest"
  ];
  const index = Math.round(normalized / 45) % 8;

  return compassDirections[index];
}

function formatWindDescription(windSpeed: number, direction?: number): string {
  const directionText = direction === undefined ? "ukjent retning" : formatDirection(direction);

  if (windSpeed < 1.6) {
    return `Flau vind fra ${directionText}`;
  }

  if (windSpeed < 3.4) {
    return `Svak vind fra ${directionText}`;
  }

  if (windSpeed < 5.5) {
    return `Lett bris fra ${directionText}`;
  }

  if (windSpeed < 8) {
    return `Laber bris fra ${directionText}`;
  }

  if (windSpeed < 10.8) {
    return `Frisk bris fra ${directionText}`;
  }

  if (windSpeed < 13.9) {
    return `Liten kuling fra ${directionText}`;
  }

  return `Sterk vind fra ${directionText}`;
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
            <th className="px-4 py-3">Vindretning</th>
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
              <td className="px-4 py-3">
                {hour.windGust !== undefined ? `${hour.windGust.toFixed(1)} m/s` : "-"}
              </td>
              <td className="px-4 py-3">{formatWindDescription(hour.windSpeed, hour.windFromDirection)}</td>
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
