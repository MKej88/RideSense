import { calculateBikeScore, findBestWindowNext7Days, findBestWindowToday } from "@/lib/scoring";
import { fetchNearestStationObservation } from "@/lib/station-observations";
import { ScoredWeatherHour, WeatherHourRaw, WeatherResponse } from "@/lib/types";

const MET_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
const MET_FETCH_TIMEOUT_MS = 4000;
const OBSERVATION_MAX_AGE_HOURS = 2;
const FORECAST_HOURS = 24 * 7;

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

function resolvePrecipitationAmount(
  next1hDetails: Record<string, unknown> | undefined,
  next6hDetails: Record<string, unknown> | undefined,
  next12hDetails: Record<string, unknown> | undefined
): number {
  const next1hAmount = asFiniteNumber(next1hDetails?.precipitation_amount);
  if (next1hAmount !== undefined) {
    return Math.max(0, next1hAmount);
  }

  const next6hAmount = asFiniteNumber(next6hDetails?.precipitation_amount);
  if (next6hAmount !== undefined) {
    return Math.max(0, next6hAmount / 6);
  }

  const next12hAmount = asFiniteNumber(next12hDetails?.precipitation_amount);
  if (next12hAmount !== undefined) {
    return Math.max(0, next12hAmount / 12);
  }

  return 0;
}

function resolveSymbolCode(
  next1hSummary: Record<string, unknown> | undefined,
  next6hSummary: Record<string, unknown> | undefined,
  next12hSummary: Record<string, unknown> | undefined
): string | undefined {
  const symbolCandidates = [next1hSummary, next6hSummary, next12hSummary];

  for (const summary of symbolCandidates) {
    const symbolCode = summary?.symbol_code;
    if (typeof symbolCode === "string" && symbolCode.trim().length > 0) {
      return symbolCode;
    }
  }

  return undefined;
}

function shouldUseObservation(hourTime: string, observedAt: string): boolean {
  const diffHours =
    Math.abs(new Date(hourTime).getTime() - new Date(observedAt).getTime()) /
    (1000 * 60 * 60);

  return diffHours <= OBSERVATION_MAX_AGE_HOURS;
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

  const observation = await fetchNearestStationObservation(lat, lon);
  const hoursRaw: WeatherHourRaw[] = series.slice(0, FORECAST_HOURS).map((entry: any) => {
    const details = entry?.data?.instant?.details;
    const next1hDetails = entry?.data?.next_1_hours?.details;
    const next6hDetails = entry?.data?.next_6_hours?.details;
    const next12hDetails = entry?.data?.next_12_hours?.details;
    const next1hSummary = entry?.data?.next_1_hours?.summary;
    const next6hSummary = entry?.data?.next_6_hours?.summary;
    const next12hSummary = entry?.data?.next_12_hours?.summary;

    return {
      time: entry.time,
      airTemperature: details?.air_temperature ?? 0,
      precipitationAmount: resolvePrecipitationAmount(
        next1hDetails,
        next6hDetails,
        next12hDetails
      ),
      windSpeed: details?.wind_speed ?? 0,
      cloudCoverPercent: Math.min(100, Math.max(0, details?.cloud_area_fraction ?? 100)),
      symbolCode: resolveSymbolCode(next1hSummary, next6hSummary, next12hSummary),
      windFromDirection: details?.wind_from_direction,
      windGust: resolveWindGust(details, next1hDetails, next6hDetails, next12hDetails)
    };
  });

  const scoredHours: ScoredWeatherHour[] = hoursRaw.map((hour) =>
    calculateBikeScore(
      hour,
      observation && shouldUseObservation(hour.time, observation.observedAt)
        ? observation
        : null
    )
  );

  const hasObservation = scoredHours.some(
    (hour) => hour.dataBasis === "forecast_plus_observation"
  );

  return {
    locationLabel,
    timezone: "Europe/Oslo",
    updatedAt: payload?.properties?.meta?.updated_at || new Date().toISOString(),
    hours: scoredHours,
    bestWindowToday: findBestWindowToday(scoredHours),
    bestWindowNext7Days: findBestWindowNext7Days(scoredHours),
    dataBasis: hasObservation ? "forecast_plus_observation" : "forecast_only",
    observationSummary: {
      used: hasObservation,
      sourceName: "Netatmo Weathermap",
      stationName: observation?.stationName,
      observedAt: observation?.observedAt
    }
  };
}
