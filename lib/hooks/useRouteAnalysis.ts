import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessageForUi } from "@/lib/api-error";
import { GeocodeResult, RouteTimeAnalysisResponse } from "@/lib/types";

export function useRouteAnalysis(flowVersion: number) {
  const [routeAnalysis, setRouteAnalysis] = useState<RouteTimeAnalysisResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const routeAbortRef = useRef<AbortController | null>(null);
  const flowVersionRef = useRef(flowVersion);

  useEffect(() => {
    flowVersionRef.current = flowVersion;
  }, [flowVersion]);

  const analyzeRoutes = useCallback(async (
    selectedRouteStart: GeocodeResult | null,
    selectedStop: GeocodeResult | null
  ): Promise<void> => {
    if (!selectedRouteStart || !selectedStop) {
      setRouteError("Velg både startadresse og stoppadresse før analyse.");
      return;
    }

    const scopedVersion = flowVersionRef.current;
    const controller = new AbortController();
    routeAbortRef.current?.abort();
    routeAbortRef.current = controller;

    setRouteLoading(true);
    setRouteError(null);
    setRouteAnalysis(null);

    try {
      const response = await fetch(
        `/api/route-analysis?startLat=${selectedRouteStart.lat}&startLon=${selectedRouteStart.lon}&stopLat=${selectedStop.lat}&stopLon=${selectedStop.lon}&startLabel=${encodeURIComponent(selectedRouteStart.name)}&stopLabel=${encodeURIComponent(selectedStop.name)}`,
        { signal: controller.signal }
      );
      const payload = (await response.json()) as RouteTimeAnalysisResponse;

      if (!response.ok) {
        throw new Error(getErrorMessageForUi(payload, "Klarte ikke å analysere ruten."));
      }

      if (scopedVersion !== flowVersionRef.current || routeAbortRef.current !== controller) {
        return;
      }

      setRouteAnalysis(payload);
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.name === "AbortError") {
        return;
      }

      if (scopedVersion !== flowVersionRef.current || routeAbortRef.current !== controller) {
        return;
      }

      setRouteError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved ruteanalyse.");
      setRouteAnalysis(null);
    } finally {
      if (routeAbortRef.current === controller) {
        routeAbortRef.current = null;
        setRouteLoading(false);
      }
    }
  }, []);

  function resetRouteAnalysisState(): void {
    flowVersionRef.current += 1;
    routeAbortRef.current?.abort();
    setRouteAnalysis(null);
    setRouteLoading(false);
    setRouteError(null);
  }

  useEffect(() => {
    return () => {
      routeAbortRef.current?.abort();
    };
  }, []);

  return {
    routeAnalysis,
    setRouteAnalysis,
    routeLoading,
    routeError,
    setRouteError,
    analyzeRoutes,
    resetRouteAnalysisState
  };
}
