"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
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

export default function HomePage() {
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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">RideSense</h1>
        <p className="mt-2 text-sm text-slate-600">
          Finn beste tidspunkt for landeveissykling basert på vær, vind og nedbør.
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
                  onClick={() => chooseArea(place)}
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

        {selectedArea && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-base font-semibold text-slate-900">Startadresse</h2>
            <p className="mt-1 text-sm text-slate-600">
              Valgt sted: {selectedArea.name}. Søk nå opp en adresse innenfor dette stedet.
            </p>

            <div className="mt-4">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                placeholder={`Søk adresse i ${selectedArea.name}`}
                value={addressQuery}
                onChange={(event) => {
                  setAddressQuery(event.target.value);
                  setAddressError(null);
                  setSelected(null);
                  setWeather(null);
                  setRouteAnalysis(null);
                  setSelectedRouteId(null);
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                Adresselisten oppdateres automatisk mens du skriver.
              </p>
            </div>

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
                      onClick={() => loadWeatherForPlace(place)}
                    >
                      {place.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!addressLoading &&
              !addressError &&
              addressQuery.trim().length >= 2 &&
              addressResults.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Ingen adresser funnet ennå. Fortsett å skrive eller prøv annen stavemåte.
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-base font-semibold text-slate-900">Ruteanalyse</h2>
          <p className="mt-1 text-sm text-slate-600">
            Velg startplass, angi min og maks km, og kjør analyse. Distanse regnes som tur/retur.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Startplass</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {selected?.name || "Velg adresse først"}
              </p>
            </div>
            <label className="rounded-lg bg-white p-3">
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
            <label className="rounded-lg bg-white p-3">
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
      </section>

      {!weather && !weatherLoading && !error && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
          Velg et sted for å se værtime-for-time, sykkelscore og dagens beste tidsvindu.
        </section>
      )}

      {weatherLoading && (
        <section className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">Laster data …</section>
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

      {weather && (
        <section className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Sted: {selected?.name || weather.locationLabel}</h2>
            <p className="text-sm text-slate-600">Neste 24 timer</p>
          </div>
          <BestWindowCard bestWindow={weather.bestWindowToday} />
          <WeatherTable hours={weather.hours} />
        </section>
      )}
    </main>
  );
}
