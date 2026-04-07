import { NextRequest, NextResponse } from "next/server";
import { fetchForecastForLocation } from "@/lib/weather";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const label = request.nextUrl.searchParams.get("label") || "Valgt sted";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Ugyldig posisjon. Prøv søk på nytt." },
      { status: 400 }
    );
  }

  try {
    const weather = await fetchForecastForLocation(lat, lon, label);
    return NextResponse.json(weather, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Noe gikk galt ved henting av værdata."
      },
      { status: 502 }
    );
  }
}
