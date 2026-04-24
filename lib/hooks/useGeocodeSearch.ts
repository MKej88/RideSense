import { useDeferredValue, useEffect, useRef, useState } from "react";
import { GeocodeResult } from "@/lib/types";

interface ApiError {
  error: string;
}

interface UseGeocodeSearchParams {
  activeTab: "forecast" | "routes";
  flowVersion: number;
}

const PLACE_SEARCH_DEBOUNCE_MS = 180;
const ADDRESS_SEARCH_DEBOUNCE_MS = 180;

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

export function useGeocodeSearch({ activeTab, flowVersion }: UseGeocodeSearchParams) {
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
  const [searchError, setSearchError] = useState<string | null>(null);

  const placeCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const addressCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const stopCacheRef = useRef(new Map<string, GeocodeResult[]>());
  const deferredQuery = useDeferredValue(query);
  const deferredAddressQuery = useDeferredValue(addressQuery);
  const deferredStopQuery = useDeferredValue(stopQuery);
  const placeAbortRef = useRef<AbortController | null>(null);
  const addressAbortRef = useRef<AbortController | null>(null);
  const stopAbortRef = useRef<AbortController | null>(null);
  const flowVersionRef = useRef(flowVersion);

  useEffect(() => {
    flowVersionRef.current = flowVersion;
  }, [flowVersion]);

  useEffect(() => {
    const scopedVersion = flowVersion;
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
    placeAbortRef.current?.abort();
    placeAbortRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      if (scopedVersion !== flowVersionRef.current || placeAbortRef.current !== controller) {
        return;
      }

      const cachedResults = placeCacheRef.current.get(cacheKey);
      if (cachedResults) {
        setResults(cachedResults);
        setPlaceLoading(false);
        setSearchError(null);
        return;
      }

      setPlaceLoading(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke sted.");
        }

        if (!active || scopedVersion !== flowVersionRef.current || placeAbortRef.current !== controller) {
          return;
        }

        const nextResults = payload.results || [];
        placeCacheRef.current.set(cacheKey, nextResults);
        setResults(nextResults);
      } catch (caughtError) {
        if (!active || scopedVersion !== flowVersionRef.current || placeAbortRef.current !== controller) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setSearchError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stedsøk.");
        setResults([]);
      } finally {
        if (active && scopedVersion === flowVersionRef.current && placeAbortRef.current === controller) {
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
  }, [deferredQuery, flowVersion, selectedArea]);

  useEffect(() => {
    const scopedVersion = flowVersion;
    const trimmedQuery = deferredAddressQuery.trim();
    const scopedArea = activeTab === "routes" ? null : selectedArea;
    const areaContext = scopedArea ? getAreaContextLabel(scopedArea) : "";

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
    addressAbortRef.current?.abort();
    addressAbortRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      if (scopedVersion !== flowVersionRef.current || addressAbortRef.current !== controller) {
        return;
      }

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
          ? `/api/geocode?q=${encodeURIComponent(trimmedQuery)}&context=${encodeURIComponent(areaContext)}&nearLat=${scopedArea.lat}&nearLon=${scopedArea.lon}`
          : `/api/geocode?q=${encodeURIComponent(trimmedQuery)}`;
        const response = await fetch(url, { signal: controller.signal });
        const payload = (await response.json()) as { results?: GeocodeResult[] } & ApiError;

        if (!response.ok) {
          throw new Error(payload.error || "Klarte ikke å søke adresse.");
        }

        if (!active || scopedVersion !== flowVersionRef.current || addressAbortRef.current !== controller) {
          return;
        }

        const nextResults = payload.results || [];
        addressCacheRef.current.set(cacheKey, nextResults);
        setAddressResults(nextResults);
      } catch (caughtError) {
        if (!active || scopedVersion !== flowVersionRef.current || addressAbortRef.current !== controller) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setAddressError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved adressesøk.");
        setAddressResults([]);
      } finally {
        if (active && scopedVersion === flowVersionRef.current && addressAbortRef.current === controller) {
          addressAbortRef.current = null;
          setAddressLoading(false);
        }
      }
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      if (addressAbortRef.current === controller) {
        addressAbortRef.current = null;
      }
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, deferredAddressQuery, flowVersion, selectedArea]);

  useEffect(() => {
    const scopedVersion = flowVersion;
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
    stopAbortRef.current?.abort();
    stopAbortRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      if (scopedVersion !== flowVersionRef.current || stopAbortRef.current !== controller) {
        return;
      }

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

        if (!active || scopedVersion !== flowVersionRef.current || stopAbortRef.current !== controller) {
          return;
        }

        const nextResults = payload.results || [];
        stopCacheRef.current.set(cacheKey, nextResults);
        setStopResults(nextResults);
      } catch (caughtError) {
        if (!active || scopedVersion !== flowVersionRef.current || stopAbortRef.current !== controller) {
          return;
        }

        if (caughtError instanceof Error && caughtError.name === "AbortError") {
          return;
        }

        setStopError(caughtError instanceof Error ? caughtError.message : "Ukjent feil ved stopp-søk.");
        setStopResults([]);
      } finally {
        if (active && scopedVersion === flowVersionRef.current && stopAbortRef.current === controller) {
          stopAbortRef.current = null;
          setStopLoading(false);
        }
      }
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      if (stopAbortRef.current === controller) {
        stopAbortRef.current = null;
      }
      window.clearTimeout(timeoutId);
    };
  }, [deferredStopQuery, flowVersion]);

  useEffect(() => {
    return () => {
      placeAbortRef.current?.abort();
      addressAbortRef.current?.abort();
      stopAbortRef.current?.abort();
    };
  }, []);

  function resetGeocodeState(): void {
    placeAbortRef.current?.abort();
    addressAbortRef.current?.abort();
    stopAbortRef.current?.abort();
    setQuery("");
    setResults([]);
    setPlaceLoading(false);
    setSelectedArea(null);
    setAddressQuery("");
    setAddressResults([]);
    setAddressLoading(false);
    setAddressError(null);
    setStopQuery("");
    setStopResults([]);
    setStopLoading(false);
    setStopError(null);
    setSelectedStop(null);
    setSelectedRouteStart(null);
    setSearchError(null);
  }

  return {
    query,
    setQuery,
    results,
    placeLoading,
    selectedArea,
    setSelectedArea,
    addressQuery,
    setAddressQuery,
    addressResults,
    setAddressResults,
    addressLoading,
    addressError,
    setAddressError,
    stopQuery,
    setStopQuery,
    stopResults,
    setStopResults,
    stopLoading,
    stopError,
    setStopError,
    selectedStop,
    setSelectedStop,
    selectedRouteStart,
    setSelectedRouteStart,
    searchError,
    setSearchError,
    setResults,
    resetGeocodeState
  };
}
