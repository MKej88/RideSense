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
  const showTailwindColumn = hours.some((hour) => hour.tailwindMs !== undefined);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:hidden">
        {hours.map((hour) => {
          const symbolEmoji = getSymbolEmoji(hour.symbolCode);
          const windGustWarning = getWindGustWarning(hour.windGust);

          return (
            <article
              key={hour.time}
              className="rs-card text-base leading-relaxed"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-100">{formatHour(hour.time)}</p>
                <ScoreBadge label={hour.scoreLabel} score={hour.score} />
              </div>

              <dl className="mt-3 space-y-2 text-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Vind</dt>
                  <dd className="text-right font-medium">{hour.windSpeed.toFixed(1)} m/s</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Nedbør</dt>
                  <dd className="text-right font-medium">
                    {hour.precipitationAmount.toFixed(1)} mm
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Vindkast</dt>
                  <dd className="text-right font-medium">
                    {hour.windGust !== undefined ? `${hour.windGust.toFixed(1)} m/s` : "-"}
                  </dd>
                </div>
              </dl>

              {windGustWarning ? (
                <p className="mt-3 rounded-md border border-amber-700 bg-amber-950/50 px-3 py-2 text-sm font-medium text-amber-200">
                  {windGustWarning}
                </p>
              ) : null}

              <details className="mt-3 group">
                <summary className="cursor-pointer list-none rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white">
                  <span className="group-open:hidden">Vis mer</span>
                  <span className="hidden group-open:inline">Vis mindre</span>
                </summary>
                <dl className="mt-3 space-y-2 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-4">
                    <dt>Temperatur</dt>
                    <dd className="text-right">{hour.airTemperature.toFixed(1)}°C</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt>Skydekke</dt>
                    <dd className="text-right">{hour.cloudCoverPercent.toFixed(0)} %</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt>Vindretning</dt>
                    <dd className="text-right">{formatWindDescription(hour.windSpeed, hour.windFromDirection)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt>Symbol</dt>
                    <dd className="text-right" title={formatSymbol(hour.symbolCode)}>
                      {symbolEmoji} {formatSymbol(hour.symbolCode)}
                    </dd>
                  </div>
                  {showTailwindColumn ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt>Medvind</dt>
                      <dd className="text-right">
                        {hour.tailwindMs !== undefined
                          ? `${hour.tailwindMs.toFixed(1)} m/s`
                          : "-"}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </details>
            </article>
          );
        })}
      </div>

      <div className="rs-panel hidden overflow-x-auto rounded-xl shadow-sm lg:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/90 text-left text-slate-200">
            <tr>
              <th className="px-4 py-3">Tid</th>
              <th className="px-4 py-3">Temp</th>
              <th className="px-4 py-3">Nedbør</th>
              <th className="px-4 py-3">Skydekke</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Vind</th>
              <th className="px-4 py-3">Vindkast</th>
              <th className="px-4 py-3">Vindretning</th>
              {showTailwindColumn ? <th className="px-4 py-3">Medvind</th> : null}
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
                  {showTailwindColumn ? (
                    <td className="px-4 py-3">
                      {hour.tailwindMs !== undefined ? `${hour.tailwindMs.toFixed(1)} m/s` : "-"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <ScoreBadge label={hour.scoreLabel} score={hour.score} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
