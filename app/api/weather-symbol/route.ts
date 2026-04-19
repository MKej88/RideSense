import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const SYMBOLS_DIR = path.join(process.cwd(), "public", "weather-symbols");
const DEFAULT_SYMBOL = "unknown.svg";

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
    const fallbackSvg = await readSymbolFile(DEFAULT_SYMBOL);
    return new NextResponse(fallbackSvg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
}
