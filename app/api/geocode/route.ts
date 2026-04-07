import { NextRequest, NextResponse } from "next/server";
import { GeocodeResult } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Skriv inn minst 2 tegn for å søke sted." },
      { status: 400 }
    );
  }

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(
    `${query}, Norway`
  )}&format=jsonv2&limit=5&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.GEOCODE_USER_AGENT || "RideSense/1.0 ridesense@example.com"
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Kunne ikke hente stedsdata akkurat nå." },
      { status: 502 }
    );
  }

  const data = (await response.json()) as Array<any>;

  const results: GeocodeResult[] = data.map((item) => ({
    name: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    country: item.address?.country,
    county: item.address?.county
  }));

  return NextResponse.json({ results });
}
