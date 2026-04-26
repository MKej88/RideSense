import { useEffect, useRef, useState } from "react";
import { getErrorMessageForUi } from "@/lib/api-error";
import { GeocodeResult } from "@/lib/types";

interface UseGeocodeSearchParams {
  onPlaceSearchStart?: () => void;
}

const PLACE_SEARCH_DEBOUNCE_MS = 180;

export function getAreaContextLabel(place: GeocodeResult): string {
  const primaryName = place.name.split(",")[0]?.trim();
  return primaryName || place.county || "Norge";
}

export function isSameAreaQuery(query: string, place: GeocodeResult | null): boolean {
  if (!place) {
    return false;
  }

  return query.trim() === getAreaContextLabel(place);
}

export function useGeocodeSearch({ onPlaceSearchStart }: UseGeocodeSearchParams) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<GeocodeResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const placeCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const placeAbortRef = useRef<AbortController | null>(null);
  const firstResultMeasureRef = useRef<{ queryKey: string; startedAt: number } | null>(null);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const finalizeFirstResultMeasure = (queryKey: string) => {
      const measurement = firstResultMeasureRef.current;
      if (!measurement || measurement.queryKey !== queryKey) {
        return;
      }

      const elapsedMs = Math.round(performance.now() - measurement.startedAt);
      console.info("[geocode] Time to first result:", {
        strategy: "setTimeout-debounce",
        queryKey,
        elapsedMs
      });
      firstResultMeasureRef.current = null;
    };

    if (isSameAreaQuery(trimmedQuery, selectedArea)) {
      setPlaceLoading(false);
      setSearchError(null);
      firstResultMeasureRef.current = null;
      return;
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setPlaceLoading(false);
      firstResultMeasureRef.current = null;
      return;
    }

    onPlaceSearchStart?.();

    let active = true;
    const cacheKey = trimmedQuery.toLocaleLowerCase("nb-NO");
    const controller = new AbortController();
    placeAbortRef.current?.abort();
    placeAbortRef.current = controller;
    firstResultMeasureRef.current = {
      queryKey: cacheKey,
      startedAt: performance.now()
    };

    const timeoutId = window.setTimeout(async () => {
      if (placeAbortRef.current !== controller) {
        return;
      }

      const cachedResults = placeCacheRef.current.get(cacheKey);
      if (cachedResults) {
        setResults(cachedResults);
        setPlaceLoading(false);
        setSearchError(null);
        finalizeFirstResultMeasure(cacheKey);
        return;
      }

      setPlaceLoading(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] };

        if (!response.ok) {
          throw new Error(getErrorMessageForUi(payload, "Klarte ikke å søke sted."));
        }

        if (!active || placeAbortRef.current !== controller) {
          return;
        }

        const nextResults = payload.results || [];
        placeCacheRef.current.set(cacheKey, nextResults);
        setResults(nextResults);
        finalizeFirstResultMeasure(cacheKey);
      } catch (caughtError) {
        if (!active || placeAbortRef.current !== controller) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setSearchError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stedsøk.");
        setResults([]);
      } finally {
        if (active && placeAbortRef.current === controller) {
          placeAbortRef.current = null;
          setPlaceLoading(false);
        }
      }
    }, PLACE_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      if (placeAbortRef.current === controller) {
        placeAbortRef.current = null;
      }
      window.clearTimeout(timeoutId);
      setPlaceLoading(false);
    };
  }, [onPlaceSearchStart, query, selectedArea]);

  useEffect(() => {
    return () => {
      placeAbortRef.current?.abort();
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    placeLoading,
    selectedArea,
    setSelectedArea,
    searchError,
    setSearchError,
    setResults
  };
}
