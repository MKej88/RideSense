import { ScoredWeatherHour } from "@/lib/types";
import { ScoreBadge } from "@/components/ScoreBadge";

import { formatOsloDayAndTime } from "@/lib/time-format";

function formatHour(time: string): string {
  return formatOsloDayAndTime(time);
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

const HIGH_WIND_THRESHOLD = 10.8;
const HIGH_PRECIPITATION_THRESHOLD = 2;
const DANGEROUS_WIND_GUST_THRESHOLD = 17;

function getRiskHighlight(hour: ScoredWeatherHour) {
  const hasHighWind = hour.windSpeed >= HIGH_WIND_THRESHOLD;
  const hasHighPrecipitation = hour.precipitationAmount >= HIGH_PRECIPITATION_THRESHOLD;
  const hasDangerousWindGust =
    hour.windGust !== undefined && hour.windGust >= DANGEROUS_WIND_GUST_THRESHOLD;

  return {
    hasHighWind,
    hasHighPrecipitation,
    hasDangerousWindGust
  };
}

export function WeatherTable({ hours }: { hours: ScoredWeatherHour[] }) {
  const showTailwindColumn = hours.some((hour) => hour.tailwindMs !== undefined);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:hidden">
        {hours.map((hour) => {
          const symbolEmoji = getSymbolEmoji(hour.symbolCode);
          const windGustWarning = getWindGustWarning(hour.windGust);
          const { hasHighWind, hasHighPrecipitation, hasDangerousWindGust } = getRiskHighlight(hour);

          return (
            <article
              key={hour.time}
              className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-base leading-relaxed"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-100">{formatHour(hour.time)}</p>
                <ScoreBadge label={hour.scoreLabel} score={hour.score} />
              </div>

              <dl className="mt-3 space-y-2 text-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Vind</dt>
                  <dd
                    className={`rounded px-2 py-0.5 text-right font-medium ${
                      hasHighWind
                        ? "border border-orange-500/60 bg-orange-500/20 text-orange-100"
                        : ""
                    }`}
                  >
                    {hour.windSpeed.toFixed(1)} m/s
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Nedbør</dt>
                  <dd
                    className={`rounded px-2 py-0.5 text-right font-medium ${
                      hasHighPrecipitation
                        ? "border border-cyan-500/60 bg-cyan-500/20 text-cyan-100"
                        : ""
                    }`}
                  >
                    {hour.precipitationAmount.toFixed(1)} mm
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Vindkast</dt>
                  <dd
                    className={`rounded px-2 py-0.5 text-right font-medium ${
                      hasDangerousWindGust
                        ? "border border-rose-500/70 bg-rose-500/20 text-rose-100"
                        : ""
                    }`}
                  >
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

      <div className="hidden overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 shadow-sm lg:block">
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
              {showTailwindColumn ? <th className="px-4 py-3">Medvind</th> : null}
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => {
              const symbolEmoji = getSymbolEmoji(hour.symbolCode);
              const windGustWarning = getWindGustWarning(hour.windGust);
              const { hasHighWind, hasHighPrecipitation, hasDangerousWindGust } = getRiskHighlight(hour);
              const hasAnyRisk = hasHighWind || hasHighPrecipitation || hasDangerousWindGust;

              return (
                <tr
                  key={hour.time}
                  className={`border-t border-slate-800 ${hasAnyRisk ? "bg-slate-800/40" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-200">{formatHour(hour.time)}</td>
                  <td className="px-4 py-3">{hour.airTemperature.toFixed(1)}°C</td>
                  <td
                    className={`px-4 py-3 ${
                      hasHighPrecipitation
                        ? "font-semibold text-cyan-100 underline decoration-cyan-400/70 decoration-2 underline-offset-4"
                        : ""
                    }`}
                  >
                    {hour.precipitationAmount.toFixed(1)} mm
                  </td>
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
                  <td
                    className={`px-4 py-3 ${
                      hasHighWind
                        ? "font-semibold text-orange-100 underline decoration-orange-400/80 decoration-2 underline-offset-4"
                        : ""
                    }`}
                  >
                    {hour.windSpeed.toFixed(1)} m/s
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      hasDangerousWindGust
                        ? "font-semibold text-rose-100 underline decoration-rose-400/80 decoration-2 underline-offset-4"
                        : ""
                    }`}
                  >
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
