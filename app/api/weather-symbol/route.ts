import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const SYMBOLS_DIR = path.join(process.cwd(), "public", "weather-symbols");
const DEFAULT_SYMBOL = "unknown.svg";
const YR_SYMBOL_BASE_URL =
  "https://www.yr.no/assets/images/weather-symbols/dark-mode/default/svg";

function sanitizeSymbolCode(input: string | null): string {
  if (!input) {
    return "unknown";
  }

  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  return normalized.replace(/[^a-z0-9_]/g, "");
}

async function readSymbolFile(fileName: string): Promise<string> {
  const filePath = path.join(SYMBOLS_DIR, fileName);
  return fs.readFile(filePath, "utf-8");
}

async function fetchSymbolFromYr(symbolCode: string): Promise<string | null> {
  const remoteUrl = `${YR_SYMBOL_BASE_URL}/${symbolCode}.svg`;

  try {
    const response = await fetch(remoteUrl, {
      headers: {
        "User-Agent": process.env.MET_USER_AGENT || "RideSense/1.0 ridesense@example.com"
      },
      next: { revalidate: 86400 }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("image/svg+xml")) {
      return null;
    }

    return response.text();
  } catch {
    return null;
  }
}

async function writeSymbolToCache(fileName: string, svgContent: string): Promise<void> {
  try {
    await fs.mkdir(SYMBOLS_DIR, { recursive: true });
    await fs.writeFile(path.join(SYMBOLS_DIR, fileName), svgContent, "utf-8");
  } catch {
    // Best-effort cache write: some deployments have read-only filesystems.
  }
}

function buildFallbackSymbolSvg(symbolCode: string): string {
  const isClear = symbolCode.includes("clearsky");
  const isPartlyCloudy = symbolCode.includes("partlycloudy") || symbolCode.includes("fair");
  const isCloudy = symbolCode.includes("cloudy");
  const isRain = symbolCode.includes("rain") || symbolCode.includes("showers");
  const isSnow = symbolCode.includes("snow");
  const isFog = symbolCode.includes("fog");
  const isThunder = symbolCode.includes("thunder");

  const sun = `<circle cx="20" cy="20" r="9" fill="#fbbf24" />`;
  const cloud = `<path d="M17 44c0-5 4-9 9-9h10c5 0 9 4 9 9s-4 9-9 9H26c-5 0-9-4-9-9z" fill="#cbd5e1" />`;
  const rain = `<path d="M24 50l-2 6M31 50l-2 6M38 50l-2 6" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" />`;
  const snow = `<g stroke="#93c5fd" stroke-width="2"><path d="M24 52h6M27 49v6"/><path d="M34 52h6M37 49v6"/></g>`;
  const fog = `<path d="M16 47h30M16 52h30" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />`;
  const thunder = `<path d="M34 42l-6 11h5l-3 9 10-13h-5l3-7z" fill="#facc15" />`;

  let layers = cloud;

  if (isClear) {
    layers = `${sun}`;
  } else if (isPartlyCloudy) {
    layers = `${sun}${cloud}`;
  } else if (isCloudy) {
    layers = cloud;
  }

  if (isRain) {
    layers += rain;
  }

  if (isSnow) {
    layers += snow;
  }

  if (isFog) {
    layers += fog;
  }

  if (isThunder) {
    layers += thunder;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${symbolCode}"><rect width="64" height="64" rx="12" fill="#0f172a" />${layers}</svg>`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestedCode = sanitizeSymbolCode(request.nextUrl.searchParams.get("code"));
  const fileName = `${requestedCode}.svg`;

  try {
    const svgContent = await readSymbolFile(fileName);
    return new NextResponse(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    const remoteSvg = await fetchSymbolFromYr(requestedCode);
    if (remoteSvg) {
      await writeSymbolToCache(fileName, remoteSvg);

      return new NextResponse(remoteSvg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    let fallbackSvg = buildFallbackSymbolSvg(requestedCode);
    if (requestedCode === "unknown") {
      try {
        fallbackSvg = await readSymbolFile(DEFAULT_SYMBOL);
      } catch {
        fallbackSvg = buildFallbackSymbolSvg("unknown");
      }
    }

    return new NextResponse(fallbackSvg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
}
