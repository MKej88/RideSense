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
      await fs.mkdir(SYMBOLS_DIR, { recursive: true });
      await fs.writeFile(path.join(SYMBOLS_DIR, fileName), remoteSvg, "utf-8");

      return new NextResponse(remoteSvg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    const fallbackSvg = await readSymbolFile(DEFAULT_SYMBOL);
    return new NextResponse(fallbackSvg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
}
