"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { GeocodeResult, RouteAnalysisResponse, WeatherResponse } from "@/lib/types";

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
      <section className="rounded-xl bg-white p-4 text-slate-600 shadow-sm">Laster kart …</section>
    ),
    ssr: false
  }
);
const RouteAnalysisPanel = dynamic(
  () => import("@/components/RouteAnalysisPanel").then((module) => module.RouteAnalysisPanel)
);
const WeatherTable = dynamic(
  () => import("@/components/WeatherTable").then((module) => module.WeatherTable)
);

const PLACE_SEARCH_DEBOUNCE_MS = 180;
const ADDRESS_SEARCH_DEBOUNCE_MS = 180;

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
  return new Date(time).toLocaleDateString("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
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
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysisResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [minDistanceKm, setMinDistanceKm] = useState("15");
  const [maxDistanceKm, setMaxDistanceKm] = useState("35");
  const placeCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const addressCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const deferredQuery = useDeferredValue(query);
  const deferredAddressQuery = useDeferredValue(addressQuery);

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
    setWeather(null);
    setRouteAnalysis(null);
    setSelectedRouteId(null);
    setRouteError(null);
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
    if (!selectedArea) {
      return;
    }

    const trimmedQuery = deferredAddressQuery.trim();

    if (trimmedQuery.length < 2) {
      setAddressResults([]);
      setAddressError(null);
      setAddressLoading(false);
      return;
    }

    let active = true;
    const cacheKey = `${trimmedQuery.toLocaleLowerCase("nb-NO")}::${selectedArea.lat.toFixed(4)}::${selectedArea.lon.toFixed(4)}`;
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
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmedQuery)}&context=${encodeURIComponent(
            areaContext
          )}&nearLat=${selectedArea.lat}&nearLon=${selectedArea.lon}`,
          {
            signal: controller.signal
          }
        );
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
  }, [deferredAddressQuery, areaContext, selectedArea]);

  const loadWeatherForPlace = useCallback(async (place: GeocodeResult): Promise<void> => {
    setWeatherLoading(true);
    setError(null);
    setRouteError(null);
    setSelected(place);
    setWeather(null);
    setRouteAnalysis(null);
    setSelectedRouteId(null);

    try {
      const response = await fetch(
        `/api/weather?lat=${place.lat}&lon=${place.lon}&label=${encodeURIComponent(place.name)}`
      );
      const payload = (await response.json()) as WeatherResponse & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å hente værdata.");
      }

      setWeather(payload);
      setResults([]);
      setAddressResults([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved værhenting.");
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const analyzeRoutes = useCallback(async (): Promise<void> => {
    if (!selected) {
      setRouteError("Velg en startplass før du analyserer ruter.");
      return;
    }

    const minKm = Number(minDistanceKm);
    const maxKm = Number(maxDistanceKm);

    if (!Number.isFinite(minKm) || !Number.isFinite(maxKm) || minKm <= 0 || maxKm <= 0) {
      setRouteError("Min og maks km må være gyldige positive tall.");
      return;
    }

    if (minKm > maxKm) {
      setRouteError("Min km kan ikke være større enn maks km.");
      return;
    }

    setRouteLoading(true);
    setRouteError(null);
    setRouteAnalysis(null);
    setSelectedRouteId(null);

    try {
      const response = await fetch(
        `/api/route-analysis?lat=${selected.lat}&lon=${selected.lon}&label=${encodeURIComponent(
          selected.name
        )}&minKm=${minKm}&maxKm=${maxKm}`
      );
      const payload = (await response.json()) as RouteAnalysisResponse & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å analysere rutene.");
      }

      setRouteAnalysis(payload);
      setSelectedRouteId(payload.bestRouteId ?? payload.routes[0]?.route.id ?? null);
    } catch (caughtError) {
      setRouteError(
        caughtError instanceof Error ? caughtError.message : "Ukjent feil ved ruteanalyse."
      );
      setRouteAnalysis(null);
      setSelectedRouteId(null);
    } finally {
      setRouteLoading(false);
    }
  }, [maxDistanceKm, minDistanceKm, selected]);

  const selectedRoute =
    routeAnalysis?.routes.find((route) => route.route.id === selectedRouteId)?.route ?? null;

  const visibleWeatherHours = useMemo(() => {
    if (!weather) {
      return [];
    }

    if (forecastRange === "7d") {
      return weather.hours;
    }

    const now = Date.now();
    const nextDayHours = weather.hours
      .filter((hour) => new Date(hour.time).getTime() >= now)
      .slice(0, 24);

    return nextDayHours.filter((hour) => {
      const localHour = Number(
        new Date(hour.time).toLocaleTimeString("nb-NO", {
          hour: "2-digit",
          hour12: false,
          timeZone: "Europe/Oslo"
        })
      );

      return localHour >= 6;
    });
  }, [forecastRange, weather]);

  const forecastDays = useMemo(() => {
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
      hours
    }));
  }, [visibleWeatherHours]);

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

  const onMarkerMoved = useCallback(
    async (lat: number, lon: number): Promise<void> => {
      const movedPlace: GeocodeResult = {
        name: "Valgt punkt på kart",
        lat,
        lon
      };

      await loadWeatherForPlace(movedPlace);
    },
    [loadWeatherForPlace]
  );

  function useMyLocation(): void {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Nettleseren støtter ikke posisjonstjenester.");
      return;
    }

      setWeatherLoading(true);
      navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentPlace: GeocodeResult = {
          name: "Min posisjon",
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        setSelectedArea(currentPlace);
        await loadWeatherForPlace(currentPlace);
      },
      () => {
        setError("Fikk ikke tilgang til posisjon. Sjekk nettleserinnstillinger.");
        setWeatherLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">RideSense</h1>
        <p className="mt-2 text-sm text-sky-50">
          Legg inn sted og startadresse for å få tydelig værscore og beste sykkeltidspunkt.
        </p>

        <div className="mt-5 inline-flex rounded-xl bg-white/20 p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "forecast"
                ? "bg-white text-slate-900"
                : "text-white hover:bg-white/20"
            }`}
            onClick={() => setActiveTab("forecast")}
          >
            Vær og tidspunkt
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "routes"
                ? "bg-white text-slate-900"
                : "text-white hover:bg-white/20"
            }`}
            onClick={() => setActiveTab("routes")}
          >
            Ruteanalyse
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">1) Velg sted</h2>
        <p className="mt-1 text-sm text-slate-600">
          Søk etter område først, deretter startadresse. Så får du resultat direkte.
        </p>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={searchPlace}>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
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
                setSelectedRouteId(null);
                setRouteError(null);
              }
            }}
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-60"
            disabled={weatherLoading || addressLoading || placeLoading || query.trim().length < 2}
          >
            Søk
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-800 hover:bg-slate-100 disabled:opacity-60"
            disabled={weatherLoading || addressLoading || placeLoading}
          >
            Bruk min posisjon
          </button>
        </form>

        {placeLoading && <p className="mt-3 text-sm text-slate-600">Søker steder …</p>}

        {results.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {results.map((place) => (
              <li key={`${place.name}-${place.lat}-${place.lon}`}>
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-200"
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
          <p className="mt-3 text-sm text-slate-600">
            Ingen steder funnet ennå. Fortsett å skrive eller prøv annet stedsnavn.
          </p>
        )}

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      </section>

      {!weather && !weatherLoading && !error && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
          Velg et sted for å se værtime-for-time, sykkelscore og dagens beste tidsvindu.
        </section>
      )}

      {weatherLoading && (
        <section className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">Laster data …</section>
      )}

      {weather && activeTab === "forecast" && (
        <section className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">Sted: {selected?.name || weather.locationLabel}</h2>
            <div className="mt-3 inline-flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setForecastRange("24h")}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  forecastRange === "24h"
                    ? "bg-white font-medium text-slate-900 shadow-sm"
                    : "text-slate-700"
                }`}
              >
                Neste 24 timer
              </button>
              <button
                type="button"
                onClick={() => setForecastRange("7d")}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  forecastRange === "7d"
                    ? "bg-white font-medium text-slate-900 shadow-sm"
                    : "text-slate-700"
                }`}
              >
                Neste 7 dager
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {forecastRange === "24h"
                ? "Nattimer fra 00:00 til 06:00 er skjult for å fokusere på aktuelle sykkeltider."
                : "Viser utvidet prognose med beste tidsvindu opptil 7 dager frem i tid."}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Datagrunnlag: {weather.dataBasis === "forecast_plus_observation"
                ? "prognose + observasjon"
                : "kun prognose"}
            </p>
            <p className="text-xs text-slate-500">
              {weather.observationSummary.used
                ? `Observasjon fra ${weather.observationSummary.sourceName} (${weather.observationSummary.stationName || "ukjent stasjon"}).`
                : weather.observationSummary.stationName &&
                    weather.observationSummary.observedAt
                  ? `Fant observasjon fra ${weather.observationSummary.stationName}, men den er for gammel for timescoren. Appen bruker derfor kun prognose akkurat nå.`
                  : "Ingen tilgjengelige stasjonsobservasjoner akkurat nå. Appen bruker kun prognose."}
            </p>
          </div>

          <BestWindowCard
            bestWindow={forecastRange === "24h" ? weather.bestWindowToday : weather.bestWindowNext7Days}
            title={
              forecastRange === "24h"
                ? "Beste tidspunkt i dag"
                : "Beste tidspunkt neste 7 dager"
            }
            emptyMessage={
              forecastRange === "24h"
                ? "Ingen timer igjen i dag å evaluere."
                : "Fant ikke tilgjengelige timer i de neste 7 dagene."
            }
            includeDay={forecastRange === "7d"}
          />

          {forecastRange === "7d" && forecastDays.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="flex min-w-max gap-2">
                {forecastDays.map((day) => (
                  <button
                    key={day.dayKey}
                    type="button"
                    onClick={() => setSelectedForecastDay(day.dayKey)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      day.dayKey === selectedForecastDay
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <WeatherTable hours={displayedForecastHours} />
        </section>
      )}

      {activeTab === "routes" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Ruteanalyse</h2>
            <p className="mt-1 text-sm text-slate-600">
              Egen modul for rutevalg. Velg min/maks km og sammenlign flere ruter.
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Startadresse (kun ruteanalyse)</h3>
              <p className="mt-1 text-sm text-slate-600">
                Velg sted på hovedfanen først. Søk deretter adresse her for å analysere ruter.
              </p>

              <input
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                placeholder={
                  selectedArea
                    ? `Søk adresse i ${selectedArea.name}`
                    : "Velg sted på hovedfanen først"
                }
                value={addressQuery}
                onChange={(event) => {
                  setAddressQuery(event.target.value);
                  setAddressError(null);
                  setSelected(null);
                  setRouteAnalysis(null);
                  setSelectedRouteId(null);
                }}
                disabled={!selectedArea}
              />

              {addressLoading && (
                <p className="mt-3 text-sm text-slate-600">Søker adresser …</p>
              )}

              {addressError && (
                <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{addressError}</p>
              )}

              {addressResults.length > 0 && (
                <ul className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  {addressResults.map((place) => (
                    <li key={`${place.name}-${place.lat}-${place.lon}`}>
                      <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                        onClick={() => void loadWeatherForPlace(place)}
                      >
                        {place.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!addressLoading &&
                !addressError &&
                selectedArea &&
                addressQuery.trim().length >= 2 &&
                addressResults.length === 0 && (
                  <p className="mt-3 text-sm text-slate-600">
                    Ingen adresser funnet ennå. Fortsett å skrive eller prøv annen stavemåte.
                  </p>
                )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Startplass</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {selected?.name || "Velg adresse først"}
                </p>
              </div>
              <label className="rounded-lg bg-slate-50 p-3">
                <span className="text-xs uppercase tracking-wide text-slate-500">Min km</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={minDistanceKm}
                  onChange={(event) => setMinDistanceKm(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </label>
              <label className="rounded-lg bg-slate-50 p-3">
                <span className="text-xs uppercase tracking-wide text-slate-500">Maks km</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxDistanceKm}
                  onChange={(event) => setMaxDistanceKm(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void analyzeRoutes()}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
              disabled={!selected || routeLoading || weatherLoading || addressLoading}
            >
              Analyser ruter
            </button>
          </div>

          {selected && (
            <RouteAnalysisPanel
              data={routeAnalysis}
              loading={routeLoading}
              error={routeError}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              onRefresh={() => void analyzeRoutes()}
            />
          )}
        </section>
      )}

      {selected && (
        <LocationMap
          lat={selected.lat}
          lon={selected.lon}
          label={selected.name}
          onMarkerMoved={onMarkerMoved}
          routeName={selectedRoute?.shortName || null}
          routePoints={selectedRoute?.points || []}
        />
      )}
    </main>
  );
}
