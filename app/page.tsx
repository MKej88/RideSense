"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeocodeResult } from "@/lib/types";
import {
  formatAgeInMinutes,
  formatOsloDateTime,
  getOsloDayKey,
  isOlderThanMinutes
} from "@/lib/time-format";
import {
  buildBestWindowFromHours,
  getForecastDays,
  getVisibleWeatherHours
} from "@/lib/forecast-display";
import {
  getAreaContextLabel,
  isSameAreaQuery,
  useGeocodeSearch
} from "@/lib/hooks/useGeocodeSearch";
import { useWeatherForecast } from "@/lib/hooks/useWeatherForecast";

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

export default function HomePage() {
  const [staleCheckTick, setStaleCheckTick] = useState(() => Date.now());
  const staleThresholdMinutes = 60;
  const [forecastRange, setForecastRange] = useState<"24h" | "7d">("24h");
  const [selectedForecastDay, setSelectedForecastDay] = useState<string | null>(null);
  const weatherSectionRef = useRef<HTMLElement | null>(null);

  const weatherForecast = useWeatherForecast(0);
  const {
    selected,
    setSelected,
    weather,
    setWeather,
    weatherLoading,
    error,
    setError,
    analysisRunMs,
    loadWeather
  } = weatherForecast;

  const handlePlaceSearchStart = useCallback(() => {
    setError(null);
  }, [setError]);

  const geocode = useGeocodeSearch({
    onPlaceSearchStart: handlePlaceSearchStart
  });

  const {
    query,
    setQuery,
    results,
    placeLoading,
    selectedArea,
    setSelectedArea,
    searchError,
    setSearchError,
    setResults
  } = geocode;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStaleCheckTick(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  function scrollToSection(ref: { current: HTMLElement | null }): void {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  const loadWeatherForPlace = useCallback(
    async (place: GeocodeResult, options?: { forceRefresh?: boolean }): Promise<void> => {
      setResults([]);
      await loadWeather(place, options);
      scrollToSection(weatherSectionRef);
    },
    [loadWeather, setResults]
  );

  function chooseArea(place: GeocodeResult): void {
    setQuery(getAreaContextLabel(place));
    setSelectedArea(place);
    setSelected(null);
    setWeather(null);
    setError(null);
    setSearchError(null);
    setResults([]);

    void loadWeatherForPlace(place);
  }

  function searchPlace(event: FormEvent): void {
    event.preventDefault();
  }

  const visibleWeatherHours = useMemo(
    () => getVisibleWeatherHours(weather, analysisRunMs, forecastRange),
    [analysisRunMs, forecastRange, weather]
  );

  const forecastDays = useMemo(
    () => getForecastDays(visibleWeatherHours, analysisRunMs),
    [analysisRunMs, visibleWeatherHours]
  );

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

    return weather.updatedAt || weather.observationSummary.observedAt || weather.hours[0]?.time || null;
  }, [weather]);

  const isWeatherDataStale = useMemo(() => {
    if (!updatedWeatherAt) {
      return false;
    }

    return isOlderThanMinutes(updatedWeatherAt, staleThresholdMinutes, staleCheckTick);
  }, [staleCheckTick, staleThresholdMinutes, updatedWeatherAt]);

  const weatherAgeText = useMemo(() => {
    if (!updatedWeatherAt) {
      return null;
    }

    return `Oppdatert for ${formatAgeInMinutes(updatedWeatherAt, staleCheckTick)} siden`;
  }, [staleCheckTick, updatedWeatherAt]);

  const mapAnchor = selected || selectedArea;

  const onMarkerMoved = useCallback(
    async (lat: number, lon: number): Promise<void> => {
      const movedPlace: GeocodeResult = {
        name: "Valgt punkt på kart",
        lat,
        lon
      };

      setSelectedArea(movedPlace);
      setQuery(getAreaContextLabel(movedPlace));
      await loadWeatherForPlace(movedPlace);
    },
    [loadWeatherForPlace, setQuery, setSelectedArea]
  );

  const osloQuickCity = QUICK_CITIES.find((city) => city.name === "Oslo");

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-4 py-8 md:gap-14">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#020b23] p-6 shadow-[0_30px_80px_-40px_rgba(34,211,238,0.55)] md:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">RideSense</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-100/95 md:text-xl">
          Legg inn sted for å få tydelig værscore og beste sykkeltidspunkt.
        </p>
      </section>

      <section className="rs-section-shell">
        <section className="rs-surface p-6">
          <h2 className="text-lg font-semibold text-slate-100">Velg område</h2>
          <p className="mt-1 text-sm text-slate-400">
            Scoren er et tall fra 0 til 100 som viser hvor bra sykkelforholdene er for timen.
          </p>

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
                  setSelected(null);
                  setWeather(null);
                }
              }}
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-600 disabled:opacity-60"
              disabled={weatherLoading || placeLoading || query.trim().length < 2}
            >
              Søk
            </button>
          </form>

          {osloQuickCity && (
            <button
              type="button"
              className="mt-3 inline-flex items-center rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
              onClick={() => {
                chooseArea(osloQuickCity);
              }}
              disabled={weatherLoading || placeLoading}
            >
              Prøv med Oslo
            </button>
          )}

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
                  }}
                  disabled={weatherLoading || placeLoading}
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
                    }}
                  >
                    {place.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!placeLoading &&
            query.trim().length >= 2 &&
            results.length === 0 &&
            !selectedArea &&
            !searchError && (
              <p className="mt-3 text-sm text-slate-400">
                Ingen steder funnet ennå. Fortsett å skrive eller prøv annet stedsnavn.
              </p>
            )}

          {searchError && (
            <p className="mt-4 rounded-md bg-rose-950/40 p-3 text-sm text-rose-300">{searchError}</p>
          )}
        </section>
      </section>

      {error && <section className="rounded-md bg-rose-950/40 p-3 text-sm text-rose-300">{error}</section>}

      {!weather && !weatherLoading && !error && (
        <section className="rounded-xl border border-dashed border-slate-600 bg-slate-800/60 p-8 text-center text-slate-400">
          Velg et sted for å se værtime-for-time, værscore og dagens beste tidsvindu.
        </section>
      )}

      {weatherLoading && (
        <section className="rounded-xl bg-slate-900 p-6 text-slate-400 shadow-sm">Laster data …</section>
      )}

      {weather && (
        <section ref={weatherSectionRef} className="rs-section-shell space-y-6">
          <div className="rs-surface p-4">
            <h2 className="text-lg font-semibold text-slate-100">Vær og tidspunkt</h2>
            <p className="mt-1 text-sm text-slate-300">Sted: {selected?.name || weather.locationLabel}</p>
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
              {weatherAgeText ? (
                <p className={`text-sm ${isWeatherDataStale ? "text-rose-300" : "text-emerald-300"}`}>
                  {weatherAgeText}
                </p>
              ) : null}
              {updatedWeatherAt ? (
                <p className="text-xs text-slate-400">
                  Sist oppdatert værdata: {formatOsloDateTime(updatedWeatherAt)}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const placeToRefresh = selected || selectedArea;
                  if (!placeToRefresh) {
                    return;
                  }
                  void loadWeatherForPlace(placeToRefresh, { forceRefresh: true });
                }}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                disabled={weatherLoading || (!selected && !selectedArea)}
              >
                Oppdater værdata
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Tid vises i norsk tid (Europe/Oslo).</p>
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

      {mapAnchor && (
        <section className="rs-section-shell space-y-3">
          <h2 className="px-2 text-lg font-semibold text-slate-100">Kart</h2>
          <LocationMap
            lat={mapAnchor.lat}
            lon={mapAnchor.lon}
            label={mapAnchor.name}
            onMarkerMoved={onMarkerMoved}
          />
        </section>
      )}
    </main>
  );
}
