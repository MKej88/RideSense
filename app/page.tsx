"use client";

import { FormEvent, useState } from "react";
import { BestWindowCard } from "@/components/BestWindowCard";
import { WeatherTable } from "@/components/WeatherTable";
import { GeocodeResult, WeatherResponse } from "@/lib/types";

interface ApiError {
  error: string;
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchPlace(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setWeather(null);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å søke sted.");
      }

      setResults(payload.results || []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stedsøk.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadWeather(place: GeocodeResult): Promise<void> {
    setLoading(true);
    setError(null);
    setSelected(place);

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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved værhenting.");
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation(): void {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Nettleseren støtter ikke posisjonstjenester.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentPlace: GeocodeResult = {
          name: "Min posisjon",
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        await loadWeather(currentPlace);
      },
      () => {
        setError("Fikk ikke tilgang til posisjon. Sjekk nettleserinnstillinger.");
        setLoading(false);
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
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-60"
            disabled={loading || query.trim().length < 2}
          >
            Søk
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-800 hover:bg-slate-100 disabled:opacity-60"
            disabled={loading}
          >
            Bruk min posisjon
          </button>
        </form>

        {results.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {results.map((place) => (
              <li key={`${place.name}-${place.lat}-${place.lon}`}>
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-200"
                  onClick={() => loadWeather(place)}
                >
                  {place.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {!weather && !loading && !error && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
          Velg et sted for å se værtime-for-time, sykkelscore og dagens beste tidsvindu.
        </section>
      )}

      {loading && (
        <section className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">Laster data …</section>
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
