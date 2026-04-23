import { ScoreBadge } from "@/components/ScoreBadge";
import { RouteAnalysisResponse } from "@/lib/types";
import { formatOsloDateTime, formatOsloTime, isOlderThanMinutes } from "@/lib/time-format";

interface RouteAnalysisPanelProps {
  data: RouteAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  onRefresh: () => void;
}

export function RouteAnalysisPanel({
  data,
  loading,
  error,
  selectedRouteId,
  onSelectRoute,
  onRefresh
}: RouteAnalysisPanelProps) {
  const selectedRoute =
    data?.routes.find((route) => route.route.id === selectedRouteId) ?? data?.routes[0] ?? null;
  const analysisIsStale = data ? isOlderThanMinutes(data.analyzedAt) : false;

  return (
    <section className="rounded-xl bg-slate-900 p-6 shadow-sm">
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
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          disabled={loading}
        >
          Oppdater analyse
        </button>
      </div>

      {loading && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-400">
          Analyserer ruter og henter værdata for prøvepunktene …
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-rose-950/40 p-4 text-sm text-rose-300">{error}</div>
      )}

      {data && !loading && !error && (
        <div className="mt-5 space-y-5">
          {data.bestRouteExplanation && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4">
              <p className="text-sm font-medium text-emerald-200">Beste rute akkurat nå</p>
              <p className="mt-1 text-base text-emerald-100">{data.bestRouteExplanation}</p>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {data.routes.map((routeAnalysis) => {
              const selected = routeAnalysis.route.id === selectedRouteId;

              return (
                <button
                  key={routeAnalysis.route.id}
                  type="button"
                  onClick={() => onSelectRoute(routeAnalysis.route.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-700 bg-slate-800/60 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">{routeAnalysis.route.shortName}</p>
                    <ScoreBadge
                      label={routeAnalysis.summary.scoreLabel}
                      score={routeAnalysis.summary.score}
                    />
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
              <div className="rounded-xl border border-slate-700 p-4">
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
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Startplass</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedRoute.route.startLabel}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Sluttplass</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedRoute.route.endLabel}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Lengde</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedRoute.route.distanceKm} km
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">En vei</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedRoute.route.oneWayDistanceKm} km
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Snitt vind</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedRoute.summary.averageWindSpeed} m/s
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Snitt nedbør</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedRoute.summary.averagePrecipitation} mm
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 p-4">
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
