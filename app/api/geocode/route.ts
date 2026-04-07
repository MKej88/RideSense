import { NextRequest, NextResponse } from "next/server";
import { GeocodeResult } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
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

async function searchNominatim(query: string): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(
    `${query}, Norway`
  )}&format=jsonv2&limit=5&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.GEOCODE_USER_AGENT ||
        "RideSense/1.0 (kontakt: ridesense@example.com)",
      Accept: "application/json"
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    throw new Error(`Nominatim svarte med ${response.status}`);
  }

  const data = (await response.json()) as NominatimResult[];

  return data.map((item) => ({
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

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Skriv inn minst 2 tegn for å søke sted." },
      { status: 400 }
    );
  }

  try {
    const results = await searchNominatim(query);
    return NextResponse.json({ results });
  } catch {
    try {
      const results = await searchOpenMeteo(query);
      return NextResponse.json({ results });
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
