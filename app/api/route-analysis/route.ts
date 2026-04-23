import { NextRequest, NextResponse } from "next/server";
import { analyzeUserRoute } from "@/lib/route-analysis";

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
      { error: "Ugyldig start- eller stopp-posisjon for ruteanalyse." },
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
      {
        error:
          "Koordinater må være innenfor gyldige grenser (lat: -90 til 90, lon: -180 til 180)."
      },
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
    const message =
      error instanceof Error
        ? error.message === "fetch failed"
          ? "En ekstern karttjeneste svarte ikke. Prøv igjen."
          : error.message
        : "Noe gikk galt ved analyse av ruten.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
