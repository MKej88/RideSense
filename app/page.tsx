"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BestWindow, GeocodeResult, RouteTimeAnalysisResponse, WeatherResponse } from "@/lib/types";

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
const ScoreModelInfo = dynamic(
  () => import("@/components/ScoreModelInfo").then((module) => module.ScoreModelInfo)
);
const WeatherTable = dynamic(
  () => import("@/components/WeatherTable").then((module) => module.WeatherTable)
);

const PLACE_SEARCH_DEBOUNCE_MS = 180;
const ADDRESS_SEARCH_DEBOUNCE_MS = 180;
const QUICK_CITIES: GeocodeResult[] = [
  { name: "Oslo", lat: 59.9139, lon: 10.7522 },
  { name: "Bærum", lat: 59.8939, lon: 10.523 },
  { name: "Drammen", lat: 59.7439, lon: 10.2045 },
  { name: "Kristiansand", lat: 58.1467, lon: 7.9956 },
  { name: "Arendal", lat: 58.4615, lon: 8.7725 },
  { name: "Grimstad", lat: 58.3405, lon: 8.5934 },
  { name: "Bergen", lat: 60.39299, lon: 5.32415 },
  { name: "Stavanger", lat: 58.97, lon: 5.7331 },
  { name: "Sandnes", lat: 58.8518, lon: 5.7362 },
  { name: "Trondheim", lat: 63.4305, lon: 10.3951 },
  { name: "Stjørdal", lat: 63.468, lon: 10.927 },
  { name: "Steinkjer", lat: 64.015, lon: 11.4954 },
  { name: "Tromsø", lat: 69.6492, lon: 18.9553 },
  { name: "Bodø", lat: 67.2804, lon: 14.4049 },
  { name: "Harstad", lat: 68.7985, lon: 16.5418 }
];

const osloDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const osloHourFormatter = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  hour12: false,
  timeZone: "Europe/Oslo"
});

function getAreaContextLabel(place: GeocodeResult): string {
  const primaryName = place.name.split(",")[0]?.trim();

  return primaryName || place.county || "Norge";
}

function isSameAreaQuery(query: string, place: GeocodeResult | null): boolean {
  if (!place) {
    return false;
  }

  return query.trim() === getAreaContextLabel(place);
}

function getOsloDayKey(time: string): string {
  return osloDayFormatter.format(new Date(time));
}

function getOsloHour(time: string): number {
  return Number(osloHourFormatter.format(new Date(time)));
}

function isCyclingHour(time: string): boolean {
  return getOsloHour(time) >= 6;
}

function formatUpdatedAt(time: string): string {
  return new Date(time).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Oslo"
  });
}

function getNextHourTimestamp(nowMs: number): number {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return Math.floor(nowMs / ONE_HOUR_MS) * ONE_HOUR_MS + ONE_HOUR_MS;
}

function buildBestWindowFromHours(
  hours: WeatherResponse["hours"],
  analysisRunMs: number
): BestWindow | null {
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
    explanation: "Beste synlige tidsvindu basert på gjennomsnittlig værscore."
  };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"forecast" | "routes">("forecast");
  const [forecastRange, setForecastRange] = useState<"24h" | "7d">("24h");
  const [selectedForecastDay, setSelectedForecastDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<GeocodeResult | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [stopQuery, setStopQuery] = useState("");
  const [stopResults, setStopResults] = useState<GeocodeResult[]>([]);
  const [stopLoading, setStopLoading] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<GeocodeResult | null>(null);
  const [selectedRouteStart, setSelectedRouteStart] = useState<GeocodeResult | null>(null);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteTimeAnalysisResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [analysisRunMs, setAnalysisRunMs] = useState<number | null>(null);
  const placeCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const addressCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const stopCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const deferredQuery = useDeferredValue(query);
  const deferredAddressQuery = useDeferredValue(addressQuery);
  const deferredStopQuery = useDeferredValue(stopQuery);

  const areaContext = selectedArea ? getAreaContextLabel(selectedArea) : "";

  function searchPlace(event: FormEvent): void {
    event.preventDefault();
  }

  function chooseArea(place: GeocodeResult): void {
    setQuery(getAreaContextLabel(place));
    setSelectedArea(place);
    setAddressQuery("");
    setAddressResults([]);
    setAddressError(null);
    setSelected(null);
    setSelectedRouteStart(null);
    setWeather(null);
    setRouteAnalysis(null);
    setRouteError(null);
    setAnalysisRunMs(null);
    setResults([]);
  }

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();

    if (isSameAreaQuery(trimmedQuery, selectedArea)) {
      setPlaceLoading(false);
      return;
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setPlaceLoading(false);
      return;
    }

    let active = true;
    const cacheKey = trimmedQuery.toLocaleLowerCase("nb-NO");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const cachedResults = placeCacheRef.current.get(cacheKey);

      if (cachedResults) {
        setResults(cachedResults);
        setPlaceLoading(false);
        setError(null);
        return;
      }

      setPlaceLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke sted.");
        }

        if (!active) {
          return;
        }

        const nextResults = payload.results || [];
        placeCacheRef.current.set(cacheKey, nextResults);
        setResults(nextResults);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stedsøk.");
        setResults([]);
      } finally {
        if (active) {
          setPlaceLoading(false);
        }
      }
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      setPlaceLoading(false);
    };
  }, [deferredQuery, selectedArea]);

  useEffect(() => {
    const trimmedQuery = deferredAddressQuery.trim();
    const scopedArea = activeTab === "routes" ? null : selectedArea;

    if (trimmedQuery.length < 2) {
      setAddressResults([]);
      setAddressError(null);
      setAddressLoading(false);
      return;
    }

    let active = true;
    const contextPart = scopedArea ? scopedArea.name : "norge";
    const cacheKey = `${trimmedQuery.toLocaleLowerCase("nb-NO")}::${contextPart.toLocaleLowerCase("nb-NO")}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const cachedResults = addressCacheRef.current.get(cacheKey);

      if (cachedResults) {
        setAddressResults(cachedResults);
        setAddressLoading(false);
        setAddressError(null);
        return;
      }

      setAddressLoading(true);
      setAddressError(null);

      try {
        const url = scopedArea
          ? `/api/geocode?q=${encodeURIComponent(trimmedQuery)}&context=${encodeURIComponent(
              areaContext
            )}&nearLat=${scopedArea.lat}&nearLon=${scopedArea.lon}`
          : `/api/geocode?q=${encodeURIComponent(trimmedQuery)}`;
        const response = await fetch(url, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke adresse.");
        }

        if (!active) {
          return;
        }

        const nextResults = payload.results || [];
        addressCacheRef.current.set(cacheKey, nextResults);
        setAddressResults(nextResults);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setAddressError(
          caughtError instanceof Error ? caughtError.message : "Ukjent feil ved adressesøk."
        );
        setAddressResults([]);
      } finally {
        if (active) {
          setAddressLoading(false);
        }
      }
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, deferredAddressQuery, areaContext, selectedArea]);


  useEffect(() => {
    const trimmedQuery = deferredStopQuery.trim();

    if (trimmedQuery.length < 2) {
      setStopResults([]);
      setStopError(null);
      setStopLoading(false);
      return;
    }

    let active = true;
    const cacheKey = trimmedQuery.toLocaleLowerCase("nb-NO");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const cachedResults = stopCacheRef.current.get(cacheKey);

      if (cachedResults) {
        setStopResults(cachedResults);
        setStopLoading(false);
        setStopError(null);
        return;
      }

      setStopLoading(true);
      setStopError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke stoppadresse.");
        }

        if (!active) {
          return;
        }

        const nextResults = payload.results || [];
        stopCacheRef.current.set(cacheKey, nextResults);
        setStopResults(nextResults);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setStopError(
          caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stopp-søk."
        );
        setStopResults([]);
      } finally {
        if (active) {
          setStopLoading(false);
        }
      }
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredStopQuery]);

  const loadWeatherForPlace = useCallback(async (place: GeocodeResult): Promise<void> => {
    setWeatherLoading(true);
    setError(null);
    setRouteError(null);
    setSelected(place);
    setWeather(null);
    setRouteAnalysis(null);
    setAnalysisRunMs(null);

    try {
      const response = await fetch(
        `/api/weather?lat=${place.lat}&lon=${place.lon}&label=${encodeURIComponent(place.name)}`
      );
      const payload = (await response.json()) as WeatherResponse & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å hente værdata.");
      }

      setAnalysisRunMs(Date.now());
      setWeather(payload);
      setResults([]);
      setAddressResults([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved værhenting.");
      setWeather(null);
      setAnalysisRunMs(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const analyzeRoutes = useCallback(async (): Promise<void> => {
    if (!selectedRouteStart || !selectedStop) {
      setRouteError("Velg både startadresse og stoppadresse før analyse.");
      return;
    }

    setRouteLoading(true);
    setRouteError(null);
    setRouteAnalysis(null);

    try {
      const response = await fetch(
        `/api/route-analysis?startLat=${selectedRouteStart.lat}&startLon=${selectedRouteStart.lon}&stopLat=${selectedStop.lat}&stopLon=${selectedStop.lon}&startLabel=${encodeURIComponent(selectedRouteStart.name)}&stopLabel=${encodeURIComponent(selectedStop.name)}`
      );
      const payload = (await response.json()) as RouteTimeAnalysisResponse & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å analysere ruten.");
      }

      setRouteAnalysis(payload);
    } catch (caughtError) {
      setRouteError(
        caughtError instanceof Error ? caughtError.message : "Ukjent feil ved ruteanalyse."
      );
      setRouteAnalysis(null);
    } finally {
      setRouteLoading(false);
    }
  }, [selectedRouteStart, selectedStop]);


  const visibleWeatherHours = useMemo(() => {
    if (!weather || analysisRunMs === null) {
      return [];
    }

    const nextHourTs = getNextHourTimestamp(analysisRunMs);

    if (forecastRange === "7d") {
      const futureHours = weather.hours.filter((hour) => new Date(hour.time).getTime() >= nextHourTs);
      const dayKeys = Array.from(new Set(futureHours.map((hour) => getOsloDayKey(hour.time))));
      const allowedDays = new Set(dayKeys.slice(0, 7));

      return futureHours.filter(
        (hour) => allowedDays.has(getOsloDayKey(hour.time)) && isCyclingHour(hour.time)
      );
    }

    const nextDayHours = weather.hours
      .filter((hour) => new Date(hour.time).getTime() >= nextHourTs)
      .slice(0, 24);

    return nextDayHours.filter((hour) => isCyclingHour(hour.time));
  }, [analysisRunMs, forecastRange, weather]);

  const forecastDays = useMemo(() => {
    if (analysisRunMs === null) {
      return [];
    }

    const grouped = new Map<string, typeof visibleWeatherHours>();

    visibleWeatherHours.forEach((hour) => {
      const key = getOsloDayKey(hour.time);
      const existing = grouped.get(key) || [];
      existing.push(hour);
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries()).map(([dayKey, hours]) => ({
      dayKey,
      label: new Date(hours[0].time).toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Oslo"
      }),
      hours,
      bestWindow: buildBestWindowFromHours(hours, analysisRunMs)
    }));
  }, [analysisRunMs, visibleWeatherHours]);

  useEffect(() => {
    if (forecastRange !== "7d") {
      return;
    }

    if (forecastDays.length === 0) {
      setSelectedForecastDay(null);
      return;
    }

    if (!selectedForecastDay || !forecastDays.some((day) => day.dayKey === selectedForecastDay)) {
      setSelectedForecastDay(forecastDays[0].dayKey);
    }
  }, [forecastDays, forecastRange, selectedForecastDay]);

  const displayedForecastHours = useMemo(() => {
    if (forecastRange === "24h") {
      return visibleWeatherHours;
    }

    const selectedDay = forecastDays.find((day) => day.dayKey === selectedForecastDay);
    return selectedDay?.hours || [];
  }, [forecastDays, forecastRange, selectedForecastDay, visibleWeatherHours]);

  const selectedForecastDayData = useMemo(
    () => forecastDays.find((day) => day.dayKey === selectedForecastDay) || null,
    [forecastDays, selectedForecastDay]
  );

  const visibleBestWindow24h = useMemo(() => {
    if (forecastRange !== "24h" || analysisRunMs === null) {
      return null;
    }

    return buildBestWindowFromHours(visibleWeatherHours, analysisRunMs);
  }, [analysisRunMs, forecastRange, visibleWeatherHours]);

  const includeDayInBestWindow24h = useMemo(() => {
    if (!visibleBestWindow24h || analysisRunMs === null) {
      return false;
    }

    const todayKey = getOsloDayKey(new Date(analysisRunMs).toISOString());
    const startDayKey = getOsloDayKey(visibleBestWindow24h.startTime);
    return todayKey !== startDayKey;
  }, [analysisRunMs, visibleBestWindow24h]);

  const visibleBestWindow7d = useMemo(() => {
    if (forecastRange !== "7d" || analysisRunMs === null) {
      return null;
    }

    return buildBestWindowFromHours(visibleWeatherHours, analysisRunMs);
  }, [analysisRunMs, forecastRange, visibleWeatherHours]);

  const updatedWeatherAt = useMemo(() => {
    if (!weather) {
      return null;
    }

    return weather.observationSummary.observedAt || weather.hours[0]?.time || null;
  }, [weather]);
  const mapAnchor = useMemo(
    () => (activeTab === "routes" ? selectedRouteStart || selected : selected),
    [activeTab, selected, selectedRouteStart]
  );

  const onMarkerMoved = useCallback(
    async (lat: number, lon: number): Promise<void> => {
      const movedPlace: GeocodeResult = {
        name: "Valgt punkt på kart",
        lat,
        lon
      };

      if (activeTab === "routes") {
        setSelectedRouteStart(movedPlace);
        setRouteAnalysis(null);
        setRouteError(null);
        return;
      }

      await loadWeatherForPlace(movedPlace);
    },
    [activeTab, loadWeatherForPlace]
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#020b23] p-6 shadow-[0_30px_80px_-40px_rgba(34,211,238,0.55)] md:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.07)_1px,transparent_1px)] bg-[size:36px_36px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(45,212,191,0.28),rgba(2,11,35,0)_38%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_85%,rgba(14,165,233,0.22),rgba(2,11,35,0)_45%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020b23]/95 via-[#031533]/78 to-[#021021]/58" />
          <svg viewBox="0 0 1000 320" className="absolute inset-x-0 bottom-0 h-[72%] w-full opacity-90" aria-hidden="true">
            <defs>
              <linearGradient id="heroPathGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                <stop offset="48%" stopColor="#22d3ee" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.28" />
              </linearGradient>
            </defs>
            <path
              d="M-40 250 C140 225, 220 150, 360 176 S610 260, 1030 72"
              fill="none"
              stroke="url(#heroPathGlow)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M-80 275 C140 244, 300 298, 500 262 S810 190, 1060 162"
              fill="none"
              stroke="rgba(34,211,238,0.28)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-slate-900/55 px-3 py-1 text-xs font-medium text-cyan-100 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
              Smart sykkelprognose
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">RideSense</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-100/95 md:text-xl">
              Legg inn sted for å få tydelig værscore og beste sykkeltidspunkt.
            </p>

            <div className="mt-6 inline-flex rounded-2xl border border-cyan-300/25 bg-slate-900/55 p-1.5 backdrop-blur-md">
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === "forecast"
                    ? "bg-[#061739] text-cyan-100 ring-1 ring-cyan-300/45 shadow-[0_6px_18px_-10px_rgba(34,211,238,0.8)]"
                    : "text-slate-200 hover:bg-cyan-400/10"
                }`}
                onClick={() => setActiveTab("forecast")}
              >
                Vær og tidspunkt
              </button>
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === "routes"
                    ? "bg-gradient-to-r from-cyan-500/95 to-teal-400/90 text-slate-950 shadow-[0_8px_22px_-12px_rgba(45,212,191,0.8)]"
                    : "text-slate-200 hover:bg-cyan-400/10"
                }`}
                onClick={() => setActiveTab("routes")}
              >
                Ruteanalyse
              </button>
            </div>
          </div>

          <div className="relative hidden min-h-[240px] items-center justify-center lg:flex">
            <div className="absolute right-4 top-4 rounded-2xl border border-cyan-300/25 bg-slate-900/45 p-4 backdrop-blur-md">
              <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden="true">
                <path
                  d="M18 34a10 10 0 1 1 4-19 12 12 0 0 1 22 8h1a8 8 0 1 1 0 16H18z"
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="42" cy="13" r="3" fill="#5eead4" />
              </svg>
            </div>
            <div className="absolute right-16 top-[96px] rounded-2xl border border-cyan-300/25 bg-slate-900/45 p-4 backdrop-blur-md">
              <svg viewBox="0 0 68 44" className="h-10 w-14" aria-hidden="true">
                <circle cx="14" cy="30" r="10" fill="none" stroke="#67e8f9" strokeWidth="2.5" />
                <circle cx="50" cy="30" r="10" fill="none" stroke="#67e8f9" strokeWidth="2.5" />
                <path
                  d="M14 30l14-14h12l14 14M28 16l-7-6h-9"
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="absolute right-0 top-[126px] rounded-2xl border border-cyan-300/25 bg-slate-900/45 p-4 backdrop-blur-md">
              <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden="true">
                <circle cx="28" cy="28" r="20" fill="none" stroke="#67e8f9" strokeWidth="2.5" />
                <path d="M28 28V15M28 28l10 6" stroke="#99f6e4" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {activeTab === "forecast" && (
      <section className="rounded-2xl bg-slate-900 p-6 shadow-sm ring-1 ring-slate-700">
        <h2 className="text-lg font-semibold text-slate-100">Velg sted</h2>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={searchPlace}>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            placeholder="Søk sted i Norge"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);

              if (!isSameAreaQuery(nextQuery, selectedArea)) {
                setSelectedArea(null);
                setAddressQuery("");
                setAddressResults([]);
                setAddressError(null);
                setSelected(null);
                setWeather(null);
                setRouteAnalysis(null);
                            setRouteError(null);
              }
            }}
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-600 disabled:opacity-60"
            disabled={weatherLoading || addressLoading || placeLoading || query.trim().length < 2}
          >
            Søk
          </button>
        </form>
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Hurtigvalg</p>
          <div className="grid grid-cols-5 gap-2">
            {QUICK_CITIES.map((city) => (
              <button
                key={`${city.name}-${city.lat}-${city.lon}`}
                type="button"
                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                onClick={() => {
                  chooseArea(city);
                  void loadWeatherForPlace(city);
                }}
                disabled={weatherLoading || addressLoading || placeLoading}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>

        {placeLoading && <p className="mt-3 text-sm text-slate-400">Søker steder …</p>}

        {results.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            {results.map((place) => (
              <li key={`${place.name}-${place.lat}-${place.lon}`}>
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-600"
                  onClick={() => {
                    chooseArea(place);
                    void loadWeatherForPlace(place);
                  }}
                >
                  {place.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!placeLoading && query.trim().length >= 2 && results.length === 0 && !selectedArea && !error && (
          <p className="mt-3 text-sm text-slate-400">
            Ingen steder funnet ennå. Fortsett å skrive eller prøv annet stedsnavn.
          </p>
        )}

        {error && <p className="mt-4 rounded-md bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p>}

      </section>
      )}

      {!weather && !weatherLoading && !error && activeTab === "forecast" && (
        <section className="rounded-xl border border-dashed border-slate-600 bg-slate-800/60 p-8 text-center text-slate-400">
          Velg et sted for å se værtime-for-time, værscore og dagens beste tidsvindu.
        </section>
      )}

      {weatherLoading && activeTab === "forecast" && (
        <section className="rounded-xl bg-slate-900 p-6 text-slate-400 shadow-sm">Laster data …</section>
      )}

      {weather && activeTab === "forecast" && (
        <section className="space-y-4">
          <div className="rounded-xl bg-slate-900 p-4 shadow-sm ring-1 ring-slate-700">
            <h2 className="text-lg font-semibold">Sted: {selected?.name || weather.locationLabel}</h2>
            <div className="mt-3 inline-flex rounded-lg bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setForecastRange("24h")}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  forecastRange === "24h"
                    ? "bg-slate-900 font-medium text-slate-100 shadow-sm"
                    : "text-slate-300"
                }`}
              >
                Neste 24 timer
              </button>
              <button
                type="button"
                onClick={() => setForecastRange("7d")}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  forecastRange === "7d"
                    ? "bg-slate-900 font-medium text-slate-100 shadow-sm"
                    : "text-slate-300"
                }`}
              >
                Neste 7 dager
              </button>
            </div>

            {forecastRange === "24h" && (
              <div className="mt-4">
                <BestWindowCard
                  bestWindow={visibleBestWindow24h}
                  title="Beste tidspunkt neste 24 timer"
                  emptyMessage="Ingen tilgjengelige timer i de neste 24 timene."
                  includeDay={includeDayInBestWindow24h}
                />
              </div>
            )}
            {forecastRange === "7d" && (
              <div className="mt-4">
                <BestWindowCard
                  bestWindow={visibleBestWindow7d}
                  title="Beste tidspunkt neste 7 dager"
                  emptyMessage="Fant ikke tilgjengelige timer i de neste 7 dagene."
                  includeDay
                />
              </div>
            )}

            <p className="mt-2 text-sm text-slate-400">
              {forecastRange === "24h"
                ? "Nattimer fra 00:00 til 06:00 er skjult for å fokusere på aktuelle sykkeltider."
                : "Viser utvidet prognose med beste tidsvindu opptil 7 dager frem i tid."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {updatedWeatherAt && (
                <p className="text-sm text-slate-300">
                  Oppdatert værdata: {formatUpdatedAt(updatedWeatherAt)}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  const placeToRefresh = selected || selectedArea;
                  if (!placeToRefresh) {
                    return;
                  }
                  void loadWeatherForPlace(placeToRefresh);
                }}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                disabled={weatherLoading || (!selected && !selectedArea)}
              >
                Oppdater værdata
              </button>
            </div>
          </div>

          {forecastRange === "7d" && forecastDays.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-sm">
              <div className="flex min-w-max gap-2">
                {forecastDays.map((day) => (
                  <button
                    key={day.dayKey}
                    type="button"
                    onClick={() => setSelectedForecastDay(day.dayKey)}
                    className={`rounded-lg px-3 py-2 text-left text-sm ${
                      day.dayKey === selectedForecastDay
                        ? "bg-slate-900 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    <span className="block">{day.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {forecastRange === "7d" && (
            <BestWindowCard
              bestWindow={selectedForecastDayData?.bestWindow || null}
              title={
                selectedForecastDay
                  ? `Beste tidspunkt ${selectedForecastDayData?.label || "for valgt dag"}`
                  : "Beste tidspunkt for valgt dag"
              }
              emptyMessage="Ingen gyldige timer for valgt dag."
            />
          )}
          <ScoreModelInfo />
          <WeatherTable hours={displayedForecastHours} />
        </section>
      )}

      {activeTab === "routes" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-100">Ruteanalyse</h2>
            <p className="mt-1 text-sm text-slate-400">
              Legg inn start og stopp. Vi bruker veirute (ikke luftlinje), bygger tur/retur,
              sampler fem punkter og beregner beste tidspunkt med ekstra vekt på medvind.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <h3 className="text-base font-semibold text-slate-100">Startadresse</h3>
                <input
                  className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                  placeholder="Søk startadresse i Norge"
                value={addressQuery}
                onChange={(event) => {
                  setAddressQuery(event.target.value);
                  setAddressError(null);
                  setSelectedRouteStart(null);
                  setRouteAnalysis(null);
                }}
                />
                {addressLoading && <p className="mt-3 text-sm text-slate-400">Søker adresser …</p>}
                {addressError && (
                  <p className="mt-3 rounded-md bg-rose-950/40 p-3 text-sm text-rose-300">{addressError}</p>
                )}
                {addressResults.length > 0 && (
                  <ul className="mt-3 space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
                    {addressResults.map((place) => (
                      <li key={`${place.name}-${place.lat}-${place.lon}`}>
                        <button
                          type="button"
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-800"
                          onClick={() => {
                            setSelectedRouteStart(place);
                            setAddressQuery(place.name);
                            setAddressResults([]);
                          }}
                        >
                          {place.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <h3 className="text-base font-semibold text-slate-100">Stoppadresse</h3>
                <input
                  className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                  placeholder="Søk stoppadresse i Norge"
                  value={stopQuery}
                  onChange={(event) => {
                    setStopQuery(event.target.value);
                    setStopError(null);
                    setSelectedStop(null);
                    setRouteAnalysis(null);
                  }}
                />
                {stopLoading && <p className="mt-3 text-sm text-slate-400">Søker adresser …</p>}
                {stopError && (
                  <p className="mt-3 rounded-md bg-rose-950/40 p-3 text-sm text-rose-300">{stopError}</p>
                )}
                {stopResults.length > 0 && (
                  <ul className="mt-3 space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
                    {stopResults.map((place) => (
                      <li key={`${place.name}-${place.lat}-${place.lon}`}>
                        <button
                          type="button"
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-800"
                          onClick={() => {
                            setSelectedStop(place);
                            setStopQuery(place.name);
                            setStopResults([]);
                          }}
                        >
                          {place.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-800/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Start</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{selectedRouteStart?.name || "Ikke valgt"}</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Stopp</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{selectedStop?.name || "Ikke valgt"}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void analyzeRoutes()}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-60"
              disabled={
                !selectedRouteStart || !selectedStop || routeLoading || addressLoading || stopLoading
              }
            >
              Analyser valgt rute
            </button>
          </div>

          {routeError && (
            <div className="rounded-xl bg-rose-950/40 p-4 text-sm text-rose-300">{routeError}</div>
          )}

          {routeAnalysis && (
            <section className="space-y-4 rounded-xl bg-slate-900 p-4 shadow-sm ring-1 ring-slate-700">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-800/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {routeAnalysis.route.isRoundTrip ? "Distanse tur/retur" : "Distanse en vei"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{routeAnalysis.route.distanceKm} km</p>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">En vei</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{routeAnalysis.route.oneWayDistanceKm} km</p>
                </div>
                <div className="rounded-lg bg-slate-800/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Prøvepunkter</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{routeAnalysis.sampledPoints.length}</p>
                </div>
              </div>
              {!routeAnalysis.route.isRoundTrip ? (
                <p className="rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-sm text-amber-200">
                  Fant ikke trygg/gyldig returrute nå. Viser derfor enveisanalyse for valgt retning.
                </p>
              ) : null}

              <BestWindowCard
                bestWindow={routeAnalysis.bestWindowNext24h}
                title="Beste tidspunkt neste 24 timer (valgt rute)"
                emptyMessage="Fant ingen gyldige timer de neste 24 timene."
                includeDay
              />
              <BestWindowCard
                bestWindow={routeAnalysis.bestWindowNext7d}
                title="Beste tidspunkt neste 7 dager (valgt rute)"
                emptyMessage="Fant ingen gyldige timer de neste 7 dagene."
                includeDay
              />

              <WeatherTable
                hours={routeAnalysis.hours.map((hour) => ({
                  ...hour,
                  tailwindMs: hour.tailwindMs,
                  scoreReasons: [`Medvindskomponent: ${hour.tailwindMs.toFixed(1)} m/s`],
                  dataBasis: "forecast_only",
                  confidence: {
                    score: 70,
                    level: "medium",
                    reason: "Basert på kombinert ruteprognose"
                  }
                }))}
              />
            </section>
          )}
        </section>
      )}

      {mapAnchor && (
        <LocationMap
          lat={mapAnchor.lat}
          lon={mapAnchor.lon}
          label={mapAnchor.name}
          onMarkerMoved={onMarkerMoved}
          routeName={routeAnalysis?.route.shortName || null}
          routePoints={routeAnalysis?.route.points || []}
        />
      )}
    </main>
  );
}
