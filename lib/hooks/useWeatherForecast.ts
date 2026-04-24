import { useCallback, useEffect, useRef, useState } from "react";
import { GeocodeResult, WeatherResponse } from "@/lib/types";

interface ApiError {
  error: string;
}

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
      const response = await fetch(
        `/api/weather?lat=${place.lat}&lon=${place.lon}&label=${encodeURIComponent(place.name)}`,
        { signal: controller.signal }
      );
      const payload = (await response.json()) as WeatherResponse & ApiError;

      if (!response.ok) {
        throw new Error(payload.error || "Klarte ikke å hente værdata.");
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
