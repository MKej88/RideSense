import { NextRequest, NextResponse } from "next/server";
import { analyzePredefinedRoutes } from "@/lib/route-analysis";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const label = request.nextUrl.searchParams.get("label") || "Valgt sted";
  const minKm = Number(request.nextUrl.searchParams.get("minKm"));
  const maxKm = Number(request.nextUrl.searchParams.get("maxKm"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Ugyldig posisjon for ruteanalyse." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(minKm) ||
    !Number.isFinite(maxKm) ||
    minKm <= 0 ||
    maxKm <= 0 ||
    minKm > maxKm
  ) {
    return NextResponse.json(
      { error: "Ugyldig min/maks km for ruteanalyse." },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzePredefinedRoutes(lat, lon, label, minKm, maxKm);

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
        : "Noe gikk galt ved analyse av rutene.";

    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
