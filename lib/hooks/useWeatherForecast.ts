import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessageForUi } from "@/lib/api-error";
import { GeocodeResult, WeatherResponse } from "@/lib/types";

interface LoadWeatherOptions {
  forceRefresh?: boolean;
}

interface CachedWeatherEntry {
  payload: WeatherResponse;
  cachedAtMs: number;
}

const WEATHER_CACHE_TTL_MS = 2 * 60 * 1000;

function getCacheKey(place: GeocodeResult): string {
  return `${place.lat.toFixed(5)},${place.lon.toFixed(5)}`;
}

export function useWeatherForecast(flowVersion: number) {
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisRunMs, setAnalysisRunMs] = useState<number | null>(null);

  const weatherAbortRef = useRef<AbortController | null>(null);
  const flowVersionRef = useRef(flowVersion);
  const weatherCacheRef = useRef(new Map<string, CachedWeatherEntry>());

  useEffect(() => {
    flowVersionRef.current = flowVersion;
  }, [flowVersion]);

  const loadWeather = useCallback(
    async (place: GeocodeResult, options?: LoadWeatherOptions): Promise<WeatherResponse | null> => {
      const cacheKey = getCacheKey(place);
      const forceRefresh = options?.forceRefresh ?? false;
      const cachedEntry = weatherCacheRef.current.get(cacheKey);

      if (
        !forceRefresh &&
        cachedEntry &&
        Date.now() - cachedEntry.cachedAtMs < WEATHER_CACHE_TTL_MS
      ) {
        weatherAbortRef.current?.abort();
        weatherAbortRef.current = null;
        setError(null);
        setSelected(place);
        setWeather(cachedEntry.payload);
        setAnalysisRunMs(Date.now());
        setWeatherLoading(false);
        return cachedEntry.payload;
      }

    const scopedVersion = flowVersionRef.current;
    const controller = new AbortController();
    weatherAbortRef.current?.abort();
    weatherAbortRef.current = controller;

    setWeatherLoading(true);
    setError(null);
    setSelected(place);
    setWeather(null);
    setAnalysisRunMs(null);

    try {
      const requestUrl = new URL("/api/weather", window.location.origin);
      requestUrl.searchParams.set("lat", String(place.lat));
      requestUrl.searchParams.set("lon", String(place.lon));
      requestUrl.searchParams.set("label", place.name);
      if (forceRefresh) {
        requestUrl.searchParams.set("refresh", "1");
      }

      const response = await fetch(
        requestUrl.toString(),
        {
          signal: controller.signal
        }
      );
      const payload = (await response.json()) as WeatherResponse;

      if (!response.ok) {
        throw new Error(getErrorMessageForUi(payload, "Klarte ikke å hente værdata."));
      }

      if (scopedVersion !== flowVersionRef.current || weatherAbortRef.current !== controller) {
        return null;
      }

      setAnalysisRunMs(Date.now());
      setWeather(payload);
      weatherCacheRef.current.set(cacheKey, {
        payload,
        cachedAtMs: Date.now()
      });
      return payload;
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.name === "AbortError") {
        return null;
      }

      if (scopedVersion !== flowVersionRef.current || weatherAbortRef.current !== controller) {
        return null;
      }

      setError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved værhenting.");
      setWeather(null);
      setAnalysisRunMs(null);
      return null;
    } finally {
      if (weatherAbortRef.current === controller) {
        weatherAbortRef.current = null;
        setWeatherLoading(false);
      }
    }
    },
    []
  );

  function resetWeatherState(): void {
    flowVersionRef.current += 1;
    weatherAbortRef.current?.abort();
    weatherCacheRef.current.clear();
    setSelected(null);
    setWeather(null);
    setWeatherLoading(false);
    setError(null);
    setAnalysisRunMs(null);
  }

  useEffect(() => {
    return () => {
      weatherAbortRef.current?.abort();
    };
  }, []);

  return {
    selected,
    setSelected,
    weather,
    setWeather,
    weatherLoading,
    error,
    setError,
    analysisRunMs,
    setAnalysisRunMs,
    loadWeather,
    resetWeatherState
  };
}
