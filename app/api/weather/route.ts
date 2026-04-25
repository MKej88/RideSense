import { NextRequest, NextResponse } from "next/server";
import { createApiError, mapUnexpectedApiError } from "@/lib/api-error";
import { fetchForecastForLocation } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const label = request.nextUrl.searchParams.get("label") || "Valgt sted";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      createApiError(
        "UGYLDIG_INPUT",
        "Ugyldig posisjon i forespørselen.",
        "Søk opp stedet på nytt og prøv igjen."
      ),
      { status: 400 }
    );
  }

  try {
    const weather = await fetchForecastForLocation(lat, lon, label);
    const refreshRequested = request.nextUrl.searchParams.get("refresh") === "1";

    return NextResponse.json(weather, {
      headers: {
        "Cache-Control": refreshRequested
          ? "no-store, max-age=0"
          : "public, s-maxage=120, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    const mappedError = mapUnexpectedApiError(error, {
      externalAdvice: "Vent litt og prøv å hente værdata på nytt."
    });

    return NextResponse.json(
      createApiError(mappedError.code, mappedError.message, mappedError.advice),
      { status: 502 }
    );
  }
}
