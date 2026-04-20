import { NextRequest, NextResponse } from "next/server";
import { GeocodeResult } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const GEONORGE_ADDRESS_URL = "https://ws.geonorge.no/adresser/v1/sok";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  place_rank?: number;
  importance?: number;
  address?: {
    country?: string;
    county?: string;
  };
}

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface GeonorgeAddressResult {
  adressetekst?: string;
  adressetekstutenadressetilleggsnavn?: string;
  adressenavn?: string;
  kommunenavn?: string;
  poststed?: string;
  representasjonspunkt?: {
    lat?: number;
    lon?: number;
  };
}

interface GeonorgeAddressResponse {
  adresser?: GeonorgeAddressResult[];
}

interface ParsedStreetQuery {
  streetName: string;
  houseNumber?: string;
  houseLetter?: string;
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function searchNominatimVariants(
  query: string,
  context?: string,
  limit = 5,
  nearLat?: number,
  nearLon?: number
): Promise<GeocodeResult[]> {
  const dynamicSearch = Boolean(context) || nearLat !== undefined || nearLon !== undefined;
  const variants = buildNominatimQueries(query, context);
  const settled = await Promise.allSettled(
    variants.map((searchText) =>
      searchNominatim(searchText, limit, nearLat, nearLon, dynamicSearch)
    )
  );
  const successfulResults = settled
    .filter(
      (result): result is PromiseFulfilledResult<NominatimResult[]> => result.status === "fulfilled"
    )
    .flatMap((result) => result.value);

  if (successfulResults.length === 0) {
    throw new Error("Nominatim ga ingen svar.");
  }

  return dedupeAndRank(successfulResults, limit);
}

async function searchGeonorgeAddresses(
  query: string,
  context?: string,
  limit = 10,
  nearLat?: number,
  nearLon?: number
): Promise<GeocodeResult[]> {
  const parsedStreetQuery = parseStreetQuery(query);
  const searches = [
    fetchGeonorgeAddresses({
      adressenavn: query,
      ...(context ? { kommunenavn: context } : {}),
      fuzzy: "true",
      treffPerSide: String(limit),
      side: "0"
    }),
    fetchGeonorgeAddresses({
      sok: context ? `${query} ${context}` : query,
      fuzzy: "true",
      treffPerSide: String(limit),
      side: "0"
    }),
    ...(parsedStreetQuery
      ? [
          fetchGeonorgeAddresses({
            adressenavn: parsedStreetQuery.streetName,
            ...(parsedStreetQuery.houseNumber
              ? { nummer: parsedStreetQuery.houseNumber }
              : {}),
            ...(parsedStreetQuery.houseLetter
              ? { bokstav: parsedStreetQuery.houseLetter }
              : {}),
            ...(context ? { kommunenavn: context } : {}),
            fuzzy: "true",
            treffPerSide: String(limit),
            side: "0"
          })
        ]
      : [])
  ];

  const settled = await Promise.allSettled(searches);
  const fulfilledSearches = settled.filter(
    (result): result is PromiseFulfilledResult<GeonorgeAddressResult[]> =>
      result.status === "fulfilled"
  );
  const successfulResults = fulfilledSearches.flatMap((result) => result.value);

  if (fulfilledSearches.length === 0) {
    throw new Error("Kartverket svarte ikke på adressesøket.");
  }

  if (successfulResults.length === 0) {
    return [];
  }

  const seen = new Set<string>();

  return successfulResults
    .map((item) => ({
      name: formatGeonorgeAddressName(item),
      lat: item.representasjonspunkt?.lat ?? NaN,
      lon: item.representasjonspunkt?.lon ?? NaN,
      country: "Norge",
      county: item.kommunenavn,
      municipality: item.kommunenavn,
      poststed: item.poststed
    }))
    .filter(
      (item) =>
        Number.isFinite(item.lat) &&
        Number.isFinite(item.lon) &&
        item.name.length > 0 &&
        (!context || matchesSelectedPlace(item, context, nearLat, nearLon))
    )
    .sort((left, right) => {
      if (nearLat === undefined || nearLon === undefined) {
        return left.name.localeCompare(right.name, "nb-NO");
      }

      return (
        calculateDistanceKm(nearLat, nearLon, left.lat, left.lon) -
        calculateDistanceKm(nearLat, nearLon, right.lat, right.lon)
      );
    })
    .filter((item) => {
      const key = `${item.name}|${item.lat}|${item.lon}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ municipality: _municipality, poststed: _poststed, ...item }) => item);
}

async function fetchGeonorgeAddresses(
  params: Record<string, string>
): Promise<GeonorgeAddressResult[]> {
  const url = `${GEONORGE_ADDRESS_URL}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Geonorge svarte med ${response.status}`);
  }

  const payload = (await response.json()) as GeonorgeAddressResponse;
  return payload.adresser || [];
}

function formatGeonorgeAddressName(item: GeonorgeAddressResult): string {
  const addressText =
    item.adressetekst || item.adressetekstutenadressetilleggsnavn || item.adressenavn || "";
  const poststed = toDisplayCase(item.poststed);
  const municipality = toDisplayCase(item.kommunenavn);

  return [addressText, poststed || municipality].filter(Boolean).join(", ");
}

function matchesSelectedPlace(
  item: GeocodeResult & { municipality?: string; poststed?: string },
  context: string,
  nearLat?: number,
  nearLon?: number
): boolean {
  const normalizedContext = normalizeText(context);
  const municipality = normalizeText(item.municipality);
  const poststed = normalizeText(item.poststed);
  const name = normalizeText(item.name);
  const contextMatched =
    municipality === normalizedContext ||
    poststed === normalizedContext ||
    name.includes(`${normalizedContext},`) ||
    name.endsWith(`, ${normalizedContext}`) ||
    name.includes(` ${normalizedContext} `);

  if (contextMatched) {
    return true;
  }

  if (nearLat === undefined || nearLon === undefined) {
    return false;
  }

  return calculateDistanceKm(nearLat, nearLon, item.lat, item.lon) <= 35;
}

function normalizeText(value?: string): string {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("nb-NO");
}

function parseStreetQuery(query: string): ParsedStreetQuery | null {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return null;
  }

  const addressMatch = trimmed.match(/^(.+?)\s+(\d+)([a-zA-Z]?)$/u);

  if (!addressMatch) {
    return {
      streetName: trimmed
    };
  }

  const [, streetName, houseNumber, houseLetter] = addressMatch;

  return {
    streetName: streetName.trim(),
    houseNumber,
    houseLetter: houseLetter ? houseLetter.toUpperCase() : undefined
  };
}

function toDisplayCase(value?: string): string {
  if (!value) {
    return "";
  }

  return value
    .toLocaleLowerCase("nb-NO")
    .replace(/(^|[\s-])\p{L}/gu, (match) => match.toLocaleUpperCase("nb-NO"));
}

function calculateDistanceKm(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): number {
  const earthRadiusKm = 6371;
  const latDelta = ((endLat - startLat) * Math.PI) / 180;
  const lonDelta = ((endLon - startLon) * Math.PI) / 180;
  const startLatRadians = (startLat * Math.PI) / 180;
  const endLatRadians = (endLat * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLatRadians) * Math.cos(endLatRadians) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchNominatim(
  searchText: string,
  limit: number,
  nearLat?: number,
  nearLon?: number,
  dynamicSearch = false
): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: searchText,
    format: "jsonv2",
    limit: String(limit),
    addressdetails: "1",
    countrycodes: "no"
  });

  if (Number.isFinite(nearLat) && Number.isFinite(nearLon)) {
    const latDelta = 0.45;
    const lonDelta = 0.45 / Math.max(0.3, Math.cos((nearLat! * Math.PI) / 180));
    const left = nearLon! - lonDelta;
    const right = nearLon! + lonDelta;
    const top = nearLat! + latDelta;
    const bottom = nearLat! - latDelta;

    params.set("viewbox", `${left},${top},${right},${bottom}`);
    params.set("bounded", "1");
  }

  const url = `${NOMINATIM_URL}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.GEOCODE_USER_AGENT ||
        "RideSense/1.0 (kontakt: ridesense@example.com)",
      Accept: "application/json"
    },
    ...(dynamicSearch ? { cache: "no-store" as const } : { next: { revalidate: 3600 } })
  });

  if (!response.ok) {
    throw new Error(`Nominatim svarte med ${response.status}`);
  }

  return (await response.json()) as NominatimResult[];
}

function buildNominatimQueries(query: string, context?: string): string[] {
  const variants = new Set<string>();

  if (context) {
    variants.add(`${query}, ${context}, Norway`);
    variants.add(`${query}, ${context}`);
  }

  variants.add(`${query}, Norway`);
  variants.add(query);

  return [...variants];
}

function dedupeAndRank(results: NominatimResult[], limit: number): GeocodeResult[] {
  const seen = new Set<string>();

  return [...results]
    .sort((left, right) => {
      const rightImportance = right.importance || 0;
      const leftImportance = left.importance || 0;

      if (rightImportance !== leftImportance) {
        return rightImportance - leftImportance;
      }

      const rightRank = right.place_rank || 0;
      const leftRank = left.place_rank || 0;

      return rightRank - leftRank;
    })
    .filter((item) => {
      const key = `${item.display_name}|${item.lat}|${item.lon}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((item) => ({
      name: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      country: item.address?.country,
      county: item.address?.county
    }));
}

async function searchOpenMeteo(query: string): Promise<GeocodeResult[]> {
  const url = `${OPEN_METEO_GEOCODE_URL}?name=${encodeURIComponent(
    query
  )}&count=5&language=no&format=json&countryCode=NO`;

  const response = await fetch(url, {
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo svarte med ${response.status}`);
  }

  const payload = (await response.json()) as { results?: OpenMeteoResult[] };

  return (payload.results || []).map((item) => ({
    name: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
    lat: item.latitude,
    lon: item.longitude,
    country: item.country,
    county: item.admin1
  }));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const context = request.nextUrl.searchParams.get("context")?.trim();
  const nearLat = parseOptionalNumber(request.nextUrl.searchParams.get("nearLat"));
  const nearLon = parseOptionalNumber(request.nextUrl.searchParams.get("nearLon"));

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Skriv inn minst 2 tegn for å søke sted." },
      { status: 400 }
    );
  }

  try {
    if (context) {
      const results = await searchGeonorgeAddresses(query, context, 10, nearLat, nearLon);

      return NextResponse.json(
        { results },
        {
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const [addressSearchResult, placeSearchResult] = await Promise.allSettled([
      searchGeonorgeAddresses(query, undefined, 8, nearLat, nearLon),
      searchNominatimVariants(query, context, context ? 10 : 6, nearLat, nearLon)
    ]);
    const addressResults =
      addressSearchResult.status === "fulfilled" ? addressSearchResult.value : [];
    const placeResults = placeSearchResult.status === "fulfilled" ? placeSearchResult.value : [];

    if (addressResults.length === 0 && placeResults.length === 0) {
      throw new Error("Ingen treff fra stedsøk.");
    }

    const seen = new Set<string>();
    const results = [...addressResults, ...placeResults].filter((item) => {
      const key = `${item.name}|${item.lat}|${item.lon}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).slice(0, 10);

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control":
            context || nearLat !== undefined || nearLon !== undefined
              ? "no-store"
              : "s-maxage=3600, stale-while-revalidate=600"
        }
      }
    );
  } catch {
    try {
      if (context) {
        throw new Error("Nominatim feilet");
      }

      const results = await searchOpenMeteo(query);
      return NextResponse.json(
        { results },
        {
          headers: {
            "Cache-Control": "s-maxage=3600, stale-while-revalidate=600"
          }
        }
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "Kunne ikke hente stedsdata akkurat nå. Prøv igjen om litt."
        },
        { status: 502 }
      );
    }
  }
}
