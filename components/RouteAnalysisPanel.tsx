import { useEffect, useState } from "react";
import { ScoreBadge } from "@/components/ScoreBadge";
import { WeatherConditionBadge } from "@/components/WeatherConditionBadge";
import { WeatherLegend } from "@/components/WeatherLegend";
import { RouteAnalysisResponse } from "@/lib/types";
import { formatOsloDateTime, formatOsloTime, isOlderThanMinutes } from "@/lib/time-format";
import { WeatherConditionKey, getWeatherConditionVisual } from "@/lib/weather-condition";

interface RouteAnalysisPanelProps {
  data: RouteAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  onRefresh: () => void;
}

const ROUTE_BADGE_SEVERITY: Record<WeatherConditionKey, number> = {
  sol: 0,
  vind: 1,
  regn: 2,
  fare: 3
};

export function RouteAnalysisPanel({
  data,
  loading,
  error,
  selectedRouteId,
  onSelectRoute,
  onRefresh
}: RouteAnalysisPanelProps) {
  const [staleCheckTick, setStaleCheckTick] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStaleCheckTick(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const selectedRoute =
    data?.routes.find((route) => route.route.id === selectedRouteId) ?? data?.routes[0] ?? null;
  const analysisIsStale = data ? isOlderThanMinutes(data.analyzedAt, 60, staleCheckTick) : false;

  return (
    <section className="rs-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Ruteanalyse</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Startplass er {data?.locationLabel || "valgt sted"}. Vi bygger 2-3 tur/retur-ruter
            innenfor {data?.minDistanceKm ?? "valgt"}-{data?.maxDistanceKm ?? "valgt"} km,
            sampler fem punkter langs hver og beregner en samlet rutescore.
          </p>
          {data && (
            <p
              className={`mt-2 text-xs ${analysisIsStale ? "text-amber-300" : "text-slate-400"}`}
            >
              Sist oppdatert ruteanalyse: {formatOsloDateTime(data.analyzedAt)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">Tid vises i norsk tid (Europe/Oslo).</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-500 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-60"
          disabled={loading}
        >
          Oppdater analyse
        </button>
      </div>

      {loading && (
        <div className="rs-surface-subtle mt-4 p-4 text-sm text-slate-300">
          Analyserer ruter og henter værdata for prøvepunktene …
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-rose-950/40 p-4 text-sm text-rose-300">{error}</div>
      )}

      {data && !loading && !error && (
        <div className="mt-6 space-y-6">
          <WeatherLegend />
          {data.bestRouteExplanation && (
            <div className="rounded-xl border border-emerald-400/45 bg-emerald-900/25 p-4">
              <p className="text-sm font-medium text-emerald-200">Beste rute akkurat nå</p>
              <p className="mt-1 text-base text-emerald-100">{data.bestRouteExplanation}</p>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {data.routes.map((routeAnalysis) => {
              const selected = routeAnalysis.route.id === selectedRouteId;
              const categoryVisual = routeAnalysis.sampledPoints.reduce(
                (currentWorst, sampledPoint) => {
                  const nextVisual = getWeatherConditionVisual(sampledPoint.weather);
                  return ROUTE_BADGE_SEVERITY[nextVisual.key] > ROUTE_BADGE_SEVERITY[currentWorst.key]
                    ? nextVisual
                    : currentWorst;
                },
                getWeatherConditionVisual({
                  symbolCode: undefined,
                  windSpeed: routeAnalysis.summary.averageWindSpeed,
                  windGust: undefined
                })
              );

              return (
                <button
                  key={routeAnalysis.route.id}
                  type="button"
                  onClick={() => onSelectRoute(routeAnalysis.route.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-cyan-300/35 bg-slate-900 text-white shadow-[0_8px_26px_-16px_rgba(34,211,238,0.7)]"
                      : "border-slate-700 bg-slate-800/45 text-slate-100 hover:border-slate-500 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">{routeAnalysis.route.shortName}</p>
                    <div className="flex items-center gap-2">
                      <WeatherConditionBadge visual={categoryVisual} compact />
                      <ScoreBadge
                        label={routeAnalysis.summary.scoreLabel}
                        score={routeAnalysis.summary.score}
                      />
                    </div>
                  </div>
                  <p className={`mt-3 text-sm ${selected ? "text-slate-200" : "text-slate-400"}`}>
                    {routeAnalysis.route.description}
                  </p>
                  <p className={`mt-3 text-sm ${selected ? "text-slate-300" : "text-slate-500"}`}>
                    {routeAnalysis.route.distanceKm} km tur/retur
                  </p>
                </button>
              );
            })}
          </div>

          {selectedRoute && (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="rs-surface-strong p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">{selectedRoute.route.shortName}</h3>
                    <p className="mt-2 text-sm text-slate-400">{selectedRoute.summary.explanation}</p>
                  </div>
                  <ScoreBadge
                    label={selectedRoute.summary.scoreLabel}
                    score={selectedRoute.summary.score}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rs-surface-subtle rs-card-layout p-3">
                    <p className="rs-card-title">Startplass</p>
                    <p className="rs-card-metric">
                      {selectedRoute.route.startLabel}
                    </p>
                  </div>
                  <div className="rs-surface-subtle rs-card-layout p-3">
                    <p className="rs-card-title">Sluttplass</p>
                    <p className="rs-card-metric">
                      {selectedRoute.route.endLabel}
                    </p>
                  </div>
                  <div className="rs-surface-subtle rs-card-layout p-3">
                    <p className="rs-card-title">Lengde</p>
                    <p className="rs-card-metric">
                      {selectedRoute.route.distanceKm} km
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rs-surface-subtle rs-card-layout p-3">
                    <p className="rs-card-title">En vei</p>
                    <p className="rs-card-metric">
                      {selectedRoute.route.oneWayDistanceKm} km
                    </p>
                  </div>
                  <div className="rs-surface-subtle rs-card-layout p-3">
                    <p className="rs-card-title">Snitt vind</p>
                    <p className="rs-card-metric">
                      {selectedRoute.summary.averageWindSpeed} m/s
                    </p>
                  </div>
                  <div className="rs-surface-subtle rs-card-layout p-3">
                    <p className="rs-card-title">Snitt nedbør</p>
                    <p className="rs-card-metric">
                      {selectedRoute.summary.averagePrecipitation} mm
                    </p>
                  </div>
                </div>
              </div>

              <div className="rs-surface p-4">
                <h3 className="text-base font-semibold text-slate-100">Samplede punkter</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Hvert punkt bruker nærmeste tilgjengelige værtime fra MET.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="pb-2 pr-4">Punkt</th>
                        <th className="pb-2 pr-4">Tid</th>
                        <th className="pb-2 pr-4">Kategori</th>
                        <th className="pb-2 pr-4">Vind</th>
                        <th className="pb-2 pr-4">Nedbør</th>
                        <th className="pb-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRoute.sampledPoints.map((point) => (
                        <tr key={`${selectedRoute.route.id}-${point.sample.index}`} className="border-t border-slate-800">
                          <td className="py-3 pr-4 font-medium text-slate-200">
                            {point.sample.label}
                          </td>
                          <td className="py-3 pr-4 text-slate-400">{formatOsloTime(point.weather.time)}</td>
                          <td className="py-3 pr-4 text-slate-400">
                            <WeatherConditionBadge
                              visual={getWeatherConditionVisual(point.weather)}
                              compact
                            />
                          </td>
                          <td className="py-3 pr-4 text-slate-400">
                            {point.weather.windSpeed.toFixed(1)} m/s
                          </td>
                          <td className="py-3 pr-4 text-slate-400">
                            {point.weather.precipitationAmount.toFixed(1)} mm
                          </td>
                          <td className="py-3">
                            <ScoreBadge
                              label={point.weather.scoreLabel}
                              score={point.weather.score}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
