import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessageForUi } from "@/lib/api-error";
import { GeocodeResult, WeatherResponse } from "@/lib/types";

export function useWeatherForecast(flowVersion: number) {
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisRunMs, setAnalysisRunMs] = useState<number | null>(null);

  const weatherAbortRef = useRef<AbortController | null>(null);
  const flowVersionRef = useRef(flowVersion);

  useEffect(() => {
    flowVersionRef.current = flowVersion;
  }, [flowVersion]);

  const loadWeather = useCallback(async (place: GeocodeResult): Promise<WeatherResponse | null> => {
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
      requestUrl.searchParams.set("_ts", String(Date.now()));

      const response = await fetch(
        requestUrl.toString(),
        {
          signal: controller.signal,
          cache: "no-store"
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
  }, []);

  function resetWeatherState(): void {
    flowVersionRef.current += 1;
    weatherAbortRef.current?.abort();
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
