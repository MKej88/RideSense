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

function formatSymbol(symbolCode?: string): string {
  if (!symbolCode) {
    return "-";
  }

  return symbolCode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getSymbolEmoji(symbolCode?: string): string {
  const symbol = (symbolCode || "").toLowerCase();

  if (symbol.includes("thunder")) {
    return "⛈️";
  }

  if (symbol.includes("snow")) {
    return "❄️";
  }

  if (symbol.includes("rain") || symbol.includes("showers")) {
    return "🌧️";
  }

  if (symbol.includes("fog")) {
    return "🌫️";
  }

  if (symbol.includes("partlycloudy") || symbol.includes("fair")) {
    return "⛅";
  }

  if (symbol.includes("cloudy")) {
    return "☁️";
  }

  if (symbol.includes("clearsky")) {
    return symbol.includes("night") ? "🌙" : "☀️";
  }

  return "🌤️";
}

function getWindGustWarning(windGust?: number): string | null {
  if (windGust === undefined) {
    return null;
  }

  if (windGust >= 20) {
    return "Svært kraftige kast: unngå landeveissykling.";
  }

  if (windGust >= 17) {
    return "Kraftige kast: landeveissykling frarådes.";
  }

  if (windGust >= 14) {
    return "Nær 15 m/s: vurder skjermet rute eller å droppe turen.";
  }

  return null;
}

export function WeatherTable({ hours }: { hours: ScoredWeatherHour[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-800 text-left text-slate-300">
          <tr>
            <th className="px-4 py-3">Tid</th>
            <th className="px-4 py-3">Temp</th>
            <th className="px-4 py-3">Nedbør</th>
            <th className="px-4 py-3">Skydekke</th>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Vind</th>
            <th className="px-4 py-3">Vindkast</th>
            <th className="px-4 py-3">Vindretning</th>
            <th className="px-4 py-3">Score</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => {
            const symbolEmoji = getSymbolEmoji(hour.symbolCode);
            const windGustWarning = getWindGustWarning(hour.windGust);

            return (
              <tr key={hour.time} className="border-t border-slate-800">
                <td className="px-4 py-3 font-medium text-slate-200">{formatHour(hour.time)}</td>
                <td className="px-4 py-3">{hour.airTemperature.toFixed(1)}°C</td>
                <td className="px-4 py-3">{hour.precipitationAmount.toFixed(1)} mm</td>
                <td className="px-4 py-3">{hour.cloudCoverPercent.toFixed(0)} %</td>
                <td className="px-4 py-3">
                  <div
                    className="flex items-center justify-center text-2xl"
                    title={formatSymbol(hour.symbolCode)}
                    aria-label={formatSymbol(hour.symbolCode)}
                  >
                    {symbolEmoji}
                  </div>
                </td>
                <td className="px-4 py-3">{hour.windSpeed.toFixed(1)} m/s</td>
                <td className="px-4 py-3">
                  {hour.windGust !== undefined ? (
                    <div>
                      <p>{hour.windGust.toFixed(1)} m/s</p>
                      {windGustWarning ? (
                        <p className="mt-1 text-xs text-amber-300">{windGustWarning}</p>
                      ) : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3">
                  {formatWindDescription(hour.windSpeed, hour.windFromDirection)}
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge label={hour.scoreLabel} score={hour.score} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
