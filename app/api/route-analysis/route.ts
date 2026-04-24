import { NextRequest, NextResponse } from "next/server";
import { createApiError, mapUnexpectedApiError } from "@/lib/api-error";
import { analyzeUserRoute } from "@/lib/route-analysis";

function isRouteAnalysisNoDataError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("fant ingen egnede veiruter") ||
    normalizedMessage.includes("fant ikke nok værdata")
  );
}

function parseCoordinate(value: string | null): number {
  if (value === null || value.trim() === "") {
    return NaN;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startLat = parseCoordinate(request.nextUrl.searchParams.get("startLat"));
  const startLon = parseCoordinate(request.nextUrl.searchParams.get("startLon"));
  const stopLat = parseCoordinate(request.nextUrl.searchParams.get("stopLat"));
  const stopLon = parseCoordinate(request.nextUrl.searchParams.get("stopLon"));
  const startLabel = request.nextUrl.searchParams.get("startLabel") || "Start";
  const stopLabel = request.nextUrl.searchParams.get("stopLabel") || "Stopp";

  if (
    !Number.isFinite(startLat) ||
    !Number.isFinite(startLon) ||
    !Number.isFinite(stopLat) ||
    !Number.isFinite(stopLon)
  ) {
    return NextResponse.json(
      createApiError(
        "UGYLDIG_INPUT",
        "Ugyldig start- eller stopp-posisjon for ruteanalyse.",
        "Velg start og stopp på nytt fra søkelisten."
      ),
      { status: 400 }
    );
  }

  if (
    !isValidLatitude(startLat) ||
    !isValidLongitude(startLon) ||
    !isValidLatitude(stopLat) ||
    !isValidLongitude(stopLon)
  ) {
    return NextResponse.json(
      createApiError(
        "UGYLDIG_INPUT",
        "Koordinater må være innenfor gyldige grenser.",
        "Kontroller at lat/lon er gyldige og prøv igjen."
      ),
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeUserRoute(
      { lat: startLat, lon: startLon },
      { lat: stopLat, lon: stopLon },
      startLabel,
      stopLabel
    );

    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof Error && isRouteAnalysisNoDataError(error.message)) {
      return NextResponse.json(
        createApiError(
          "MANGLENDE_DATA",
          error.message,
          "Juster start/stopp eller prøv igjen litt senere når mer data er tilgjengelig."
        ),
        { status: 422 }
      );
    }

    const mappedError = mapUnexpectedApiError(error, {
      externalAdvice: "Prøv igjen om litt. Kart- eller værtjenesten kan være midlertidig nede."
    });

    return NextResponse.json(
      createApiError(mappedError.code, mappedError.message, mappedError.advice),
      { status: 502 }
    );
  }
}
