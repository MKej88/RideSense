import { NextRequest, NextResponse } from "next/server";
import { analyzeCustomRouteWind } from "@/lib/custom-route-analysis";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startLat = Number(request.nextUrl.searchParams.get("startLat"));
  const startLon = Number(request.nextUrl.searchParams.get("startLon"));
  const startLabel = request.nextUrl.searchParams.get("startLabel") || "Start";
  const endLat = Number(request.nextUrl.searchParams.get("endLat"));
  const endLon = Number(request.nextUrl.searchParams.get("endLon"));
  const endLabel = request.nextUrl.searchParams.get("endLabel") || "Slutt";

  if (
    !Number.isFinite(startLat) ||
    !Number.isFinite(startLon) ||
    !Number.isFinite(endLat) ||
    !Number.isFinite(endLon)
  ) {
    return NextResponse.json(
      { error: "Ugyldig start/slutt-posisjon for ruteanalyse." },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeCustomRouteWind(
      {
        name: startLabel,
        lat: startLat,
        lon: startLon
      },
      {
        name: endLabel,
        lat: endLat,
        lon: endLon
      }
    );

    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message === "fetch failed"
          ? "En ekstern karttjeneste svarte ikke. Prøv igjen."
          : error.message
        : "Noe gikk galt ved analyse av ruten.";

    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
