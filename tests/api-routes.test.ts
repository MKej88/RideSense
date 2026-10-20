import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getWeather } from "@/app/api/weather/route";
import { GET as getGeocode } from "@/app/api/geocode/route";
import { GET as getSymbol } from "@/app/api/weather-symbol/route";
import { fetchForecastForLocation } from "@/lib/weather";

vi.mock("@/lib/weather", () => ({
  fetchForecastForLocation: vi.fn()
}));

const mockedForecast = vi.mocked(fetchForecastForLocation);
const request = (route: string) => new NextRequest("http://localhost:3000" + route);

describe("GET /api/weather", () => {
  beforeEach(() => mockedForecast.mockReset());

  it.each([
    "/api/weather",
    "/api/weather?lat=&lon=10",
    "/api/weather?lat=abc&lon=10",
    "/api/weather?lat=91&lon=10",
    "/api/weather?lat=60&lon=-181"
  ])("gir 400 ved ugyldige koordinater: %s", async url => {
    const response = await getWeather(request(url));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("UGYLDIG_INPUT");
    expect(mockedForecast).not.toHaveBeenCalled();
  });

  it("returnerer data og riktig cache-kontroll for vanlig forespørsel", async () => {
    const body = { locationLabel: "Bodø", hours: [] };
    mockedForecast.mockResolvedValue(body as unknown as Awaited<ReturnType<typeof fetchForecastForLocation>>);
    const response = await getWeather(request("/api/weather?lat=67.28&lon=14.4&label=Bod%C3%B8"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
    expect(response.headers.get("cache-control")).toContain("s-maxage=120");
    expect(mockedForecast).toHaveBeenCalledWith(67.28, 14.4, "Bodø", false);
  });

  it("bruker no-store ved eksplisitt oppdatering", async () => {
    mockedForecast.mockResolvedValue({ hours: [] } as unknown as Awaited<ReturnType<typeof fetchForecastForLocation>>);
    const response = await getWeather(request("/api/weather?lat=0&lon=0&refresh=1"));
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mockedForecast).toHaveBeenCalledWith(0, 0, "Valgt sted", true);
  });

  it("gir 502 dersom ekstern værleverandør feiler", async () => {
    mockedForecast.mockRejectedValue(new Error("MET er utilgjengelig"));
    const response = await getWeather(request("/api/weather?lat=67.28&lon=14.4"));
    expect(response.status).toBe(502);
  });
});

describe("GET /api/geocode (simulerte eksterne svar)", () => {
  const oldFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = oldFetch;
  });

  it("avviser for korte søk før ekstern forespørsel", async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    const response = await getGeocode(request("/api/geocode?q=x"));
    expect(response.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("håndterer adresser fra Geonorge uten eksternt nett", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      adresser: [{ adressetekst: "Storgata 1", kommunenavn: "Bodø",
        poststed: "Bodø", representasjonspunkt: { lat: 67.28, lon: 14.4 } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    globalThis.fetch = mockFetch;
    const response = await getGeocode(request("/api/geocode?q=Storgata%201&context=Bod%C3%B8"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.results[0].lat).toBe(67.28);
    expect(payload.results[0].name).toContain("Storgata");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("gir 502 når adresseleverandøren feiler ved områdesøk", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Ute av drift"));
    const response = await getGeocode(request("/api/geocode?q=Storgata&context=Bod%C3%B8"));
    expect(response.status).toBe(502);
  });
});

describe("GET /api/weather-symbol", () => {
  const oldFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = oldFetch; });

  it("returnerer gyldig SVG-fallback uten tilgang til eksterne leverandører", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const response = await getSymbol(request("/api/weather-symbol?code=helt_ukjent_symbol_12345"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  });
});
