"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  BestWindow,
  GeocodeResult,
  RouteWindAnalysisResponse,
  RouteWindHour
} from "@/lib/types";

interface ApiError {
  error: string;
}

const BestWindowCard = dynamic(
  () => import("@/components/BestWindowCard").then((module) => module.BestWindowCard)
);
const LocationMap = dynamic(
  () => import("@/components/LocationMap").then((module) => module.LocationMap),
  {
    loading: () => (
      <section className="rounded-xl bg-slate-900 p-4 text-slate-400 shadow-sm">Laster kart …</section>
    ),
    ssr: false
  }
);
const WeatherTable = dynamic(
  () => import("@/components/WeatherTable").then((module) => module.WeatherTable)
);

const SEARCH_DEBOUNCE_MS = 200;

function getNextHourTimestamp(nowMs: number): number {
  const oneHourMs = 60 * 60 * 1000;
  return Math.floor(nowMs / oneHourMs) * oneHourMs + oneHourMs;
}

function buildBestWindowFromHours(hours: RouteWindHour[], analysisRunMs: number): BestWindow | null {
  const nextHourTs = getNextHourTimestamp(analysisRunMs);
  const futureHours = hours.filter((hour) => new Date(hour.time).getTime() >= nextHourTs);

  if (futureHours.length === 0) {
    return null;
  }

  const windowSize = Math.min(3, futureHours.length);
  let bestStartIndex = 0;
  let rollingSum = 0;

  for (let index = 0; index < windowSize; index += 1) {
    rollingSum += futureHours[index].score;
  }

  let bestAverage = rollingSum / windowSize;

  for (let index = windowSize; index < futureHours.length; index += 1) {
    rollingSum += futureHours[index].score;
    rollingSum -= futureHours[index - windowSize].score;
    const average = rollingSum / windowSize;

    if (average > bestAverage) {
      bestAverage = average;
      bestStartIndex = index - windowSize + 1;
    }
  }

  const bestSegment = futureHours.slice(bestStartIndex, bestStartIndex + windowSize);

  return {
    startTime: bestSegment[0].time,
    endTime: bestSegment[bestSegment.length - 1].time,
    averageScore: Math.round(bestAverage),
    explanation: "Dette vinduet scorer best for din valgte rute (inkludert medvind)."
  };
}

function filterHoursNext24(hours: RouteWindHour[], analysisRunMs: number): RouteWindHour[] {
  const nextHourTs = getNextHourTimestamp(analysisRunMs);

  return hours.filter((hour) => new Date(hour.time).getTime() >= nextHourTs).slice(0, 24);
}

function filterHoursNext7Days(hours: RouteWindHour[], analysisRunMs: number): RouteWindHour[] {
  const nextHourTs = getNextHourTimestamp(analysisRunMs);
  const ms7Days = 7 * 24 * 60 * 60 * 1000;

  return hours.filter((hour) => {
    const hourTs = new Date(hour.time).getTime();
    return hourTs >= nextHourTs && hourTs <= nextHourTs + ms7Days;
  });
}

export default function HomePage() {
  const [startQuery, setStartQuery] = useState("");
  const [startResults, setStartResults] = useState<GeocodeResult[]>([]);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [start, setStart] = useState<GeocodeResult | null>(null);

  const [endQuery, setEndQuery] = useState("");
  const [endResults, setEndResults] = useState<GeocodeResult[]>([]);
  const [endLoading, setEndLoading] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [end, setEnd] = useState<GeocodeResult | null>(null);

  const [routeAnalysis, setRouteAnalysis] = useState<RouteWindAnalysisResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [analysisRunMs, setAnalysisRunMs] = useState<number | null>(null);

  const startCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const endCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const deferredStartQuery = useDeferredValue(startQuery);
  const deferredEndQuery = useDeferredValue(endQuery);

  useEffect(() => {
    const query = deferredStartQuery.trim();

    if (query.length < 3 || query === start?.name) {
      setStartResults([]);
      setStartLoading(false);
      setStartError(null);
      return;
    }

    let active = true;
    const cacheKey = query.toLocaleLowerCase("nb-NO");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const cached = startCacheRef.current.get(cacheKey);

      if (cached) {
        setStartResults(cached);
        setStartLoading(false);
        return;
      }

      setStartLoading(true);
      setStartError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke startadresse.");
        }

        if (!active) {
          return;
        }

        const nextResults = payload.results || [];
        startCacheRef.current.set(cacheKey, nextResults);
        setStartResults(nextResults);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setStartError(
          caughtError instanceof Error ? caughtError.message : "Ukjent feil ved start-søk."
        );
        setStartResults([]);
      } finally {
        if (active) {
          setStartLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredStartQuery, start?.name]);

  useEffect(() => {
    const query = deferredEndQuery.trim();

    if (query.length < 3 || query === end?.name) {
      setEndResults([]);
      setEndLoading(false);
      setEndError(null);
      return;
    }

    let active = true;
    const cacheKey = query.toLocaleLowerCase("nb-NO");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const cached = endCacheRef.current.get(cacheKey);

      if (cached) {
        setEndResults(cached);
        setEndLoading(false);
        return;
      }

      setEndLoading(true);
      setEndError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke stopadresse.");
        }

        if (!active) {
          return;
        }

        const nextResults = payload.results || [];
        endCacheRef.current.set(cacheKey, nextResults);
        setEndResults(nextResults);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setEndError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stopp-søk.");
        setEndResults([]);
      } finally {
        if (active) {
          setEndLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredEndQuery, end?.name]);

  async function analyzeRoute(): Promise<void> {
    if (!start || !end) {
      setRouteError("Velg både start og stopp før analyse.");
      return;
    }

    setRouteLoading(true);
    setRouteError(null);
    setRouteAnalysis(null);

    try {
      const response = await fetch(
        `/api/route-analysis?startLat=${start.lat}&startLon=${start.lon}&startLabel=${encodeURIComponent(
          start.name
        )}&endLat=${end.lat}&endLon=${end.lon}&endLabel=${encodeURIComponent(end.name)}`
      );
      const payload = (await response.json()) as RouteWindAnalysisResponse & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å analysere ruten.");
      }

      setAnalysisRunMs(Date.now());
      setRouteAnalysis(payload);
    } catch (caughtError) {
      setRouteError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved analyse.");
      setRouteAnalysis(null);
    } finally {
      setRouteLoading(false);
    }
  }

  const hours24 = useMemo(() => {
    if (!routeAnalysis || analysisRunMs === null) {
      return [];
    }

    return filterHoursNext24(routeAnalysis.hours, analysisRunMs);
  }, [analysisRunMs, routeAnalysis]);

  const hours7d = useMemo(() => {
    if (!routeAnalysis || analysisRunMs === null) {
      return [];
    }

    return filterHoursNext7Days(routeAnalysis.hours, analysisRunMs);
  }, [analysisRunMs, routeAnalysis]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-100">Ruteanalyse</h1>
        <p className="mt-2 text-sm text-slate-400">
          Søk adresse i begge feltene. Vi analyserer akkurat din rute og løfter tidspunkt med medvind.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-200">Startadresse</label>
            <input
              value={startQuery}
              onChange={(event) => {
                setStartQuery(event.target.value);
                setStart(null);
                setRouteAnalysis(null);
                setRouteError(null);
              }}
              placeholder="Søk startadresse"
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
            {start && <p className="mt-2 text-xs text-emerald-300">Valgt: {start.name}</p>}
            {startLoading && <p className="mt-2 text-xs text-slate-400">Søker …</p>}
            {startError && <p className="mt-2 text-xs text-rose-300">{startError}</p>}
            {startResults.length > 0 && (
              <ul className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/70 p-2">
                {startResults.map((place) => (
                  <li key={`${place.name}-${place.lat}-${place.lon}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setStart(place);
                        setStartQuery(place.name);
                        setStartResults([]);
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
                    >
                      {place.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">Stopadresse</label>
            <input
              value={endQuery}
              onChange={(event) => {
                setEndQuery(event.target.value);
                setEnd(null);
                setRouteAnalysis(null);
                setRouteError(null);
              }}
              placeholder="Søk stopadresse"
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
            {end && <p className="mt-2 text-xs text-emerald-300">Valgt: {end.name}</p>}
            {endLoading && <p className="mt-2 text-xs text-slate-400">Søker …</p>}
            {endError && <p className="mt-2 text-xs text-rose-300">{endError}</p>}
            {endResults.length > 0 && (
              <ul className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/70 p-2">
                {endResults.map((place) => (
                  <li key={`${place.name}-${place.lat}-${place.lon}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setEnd(place);
                        setEndQuery(place.name);
                        setEndResults([]);
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
                    >
                      {place.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void analyzeRoute()}
          disabled={!start || !end || routeLoading}
          className="mt-5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {routeLoading ? "Analyserer ruten …" : "Finn beste tidspunkt"}
        </button>

        {routeError && <p className="mt-3 rounded-md bg-rose-950/40 p-3 text-sm text-rose-300">{routeError}</p>}
      </section>

      {routeAnalysis && analysisRunMs !== null && (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm text-slate-200">
              <strong>{routeAnalysis.start.name}</strong> → <strong>{routeAnalysis.end.name}</strong>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Avstand ca. {routeAnalysis.distanceKm} km. Kurs {routeAnalysis.headingDeg}°.
            </p>
          </div>

          <BestWindowCard
            bestWindow={buildBestWindowFromHours(hours24, analysisRunMs)}
            title="Beste tidspunkt neste 24 timer"
            emptyMessage="Fant ingen gyldige timer for neste 24 timer."
            includeDay
          />

          <BestWindowCard
            bestWindow={buildBestWindowFromHours(hours7d, analysisRunMs)}
            title="Beste tidspunkt neste 7 dager"
            emptyMessage="Fant ingen gyldige timer for neste 7 dager."
            includeDay
          />

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">Timer for valgt rute</h2>
            <p className="mt-1 text-sm text-slate-400">
              Score under inkluderer medvind/motvind langs ruten.
            </p>
            <div className="mt-4">
              <WeatherTable hours={hours24} />
            </div>
          </div>
        </section>
      )}

      {routeAnalysis && (
        <LocationMap
          lat={routeAnalysis.start.lat}
          lon={routeAnalysis.start.lon}
          label={routeAnalysis.start.name}
          onMarkerMoved={() => {}}
          routeName="Valgt rute"
          routePoints={routeAnalysis.routePoints}
        />
      )}
    </main>
  );
}
