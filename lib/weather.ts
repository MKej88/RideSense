import { calculateBikeScore, findBestWindowToday } from "@/lib/scoring";
import { ScoredWeatherHour, WeatherHourRaw, WeatherResponse } from "@/lib/types";

const MET_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
const MET_FETCH_TIMEOUT_MS = 4000;

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function resolveWindGust(
  instantDetails: Record<string, unknown> | undefined,
  next1hDetails: Record<string, unknown> | undefined,
  next6hDetails: Record<string, unknown> | undefined,
  next12hDetails: Record<string, unknown> | undefined
): number | undefined {
  const gustCandidates = [
    instantDetails?.wind_speed_of_gust,
    next1hDetails?.wind_speed_of_gust,
    next6hDetails?.wind_speed_of_gust,
    next12hDetails?.wind_speed_of_gust
  ];

  for (const candidate of gustCandidates) {
    const gustValue = asFiniteNumber(candidate);
    if (gustValue !== undefined) {
      return gustValue;
    }
  }

  return undefined;
}

export async function fetchForecastForLocation(
  lat: number,
  lon: number,
  locationLabel: string
): Promise<WeatherResponse> {
  const url = `${MET_FORECAST_URL}?lat=${lat}&lon=${lon}`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": process.env.MET_USER_AGENT || "RideSense/1.0 ridesense@example.com"
      },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(MET_FETCH_TIMEOUT_MS)
    });
  } catch {
    throw new Error("Værtjenesten svarte ikke raskt nok.");
  }

  if (!response.ok) {
    throw new Error("Kunne ikke hente værdata fra MET API.");
  }

  const payload = await response.json();
  const series = payload?.properties?.timeseries;

  if (!Array.isArray(series)) {
    throw new Error("Uventet datastruktur fra værleverandør.");
  }

  const hoursRaw: WeatherHourRaw[] = series.slice(0, 24).map((entry: any) => {
    const details = entry?.data?.instant?.details;
    const next1h = entry?.data?.next_1_hours?.details;
    const next6h = entry?.data?.next_6_hours?.details;
    const next12h = entry?.data?.next_12_hours?.details;

    return {
      time: entry.time,
      airTemperature: details?.air_temperature ?? 0,
      precipitationAmount: next1h?.precipitation_amount ?? 0,
      windSpeed: details?.wind_speed ?? 0,
      windFromDirection: details?.wind_from_direction,
      windGust: resolveWindGust(details, next1h, next6h, next12h)
    };
  });

  const scoredHours: ScoredWeatherHour[] = hoursRaw.map(calculateBikeScore);

  return {
    locationLabel,
    timezone: "Europe/Oslo",
    hours: scoredHours,
    bestWindowToday: findBestWindowToday(scoredHours)
  };
}
