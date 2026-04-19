import { getScoreLabel } from "@/lib/scoring";
import { fetchForecastForLocation } from "@/lib/weather";
import {
  GeocodeResult,
  RoutePoint,
  RouteWindAnalysisResponse,
  RouteWindHour,
  ScoredWeatherHour
} from "@/lib/types";

const SAMPLE_POINTS = 6;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function calculateDistanceKm(start: RoutePoint, end: RoutePoint): number {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(end.lat - start.lat);
  const dLon = degreesToRadians(end.lon - start.lon);
  const startLat = degreesToRadians(start.lat);
  const endLat = degreesToRadians(end.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateHeadingDeg(start: RoutePoint, end: RoutePoint): number {
  const startLat = degreesToRadians(start.lat);
  const endLat = degreesToRadians(end.lat);
  const dLon = degreesToRadians(end.lon - start.lon);

  const y = Math.sin(dLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);

  return normalizeDegrees(radiansToDegrees(Math.atan2(y, x)));
}

function buildRouteSamples(start: RoutePoint, end: RoutePoint): RoutePoint[] {
  return Array.from({ length: SAMPLE_POINTS }, (_, index) => {
    const ratio = index / (SAMPLE_POINTS - 1);

    return {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lon: start.lon + (end.lon - start.lon) * ratio
    };
  });
}

function calculateTailwindComponent(hour: ScoredWeatherHour, headingDeg: number): number {
  if (hour.windFromDirection === undefined) {
    return 0;
  }

  const angleDiff = degreesToRadians(hour.windFromDirection - headingDeg);
  const tailwind = -hour.windSpeed * Math.cos(angleDiff);

  return Math.round(tailwind * 10) / 10;
}

function buildRouteHour(
  hoursForPoints: ScoredWeatherHour[],
  headingDeg: number
): RouteWindHour {
  const firstHour = hoursForPoints[0];
  const pointCount = hoursForPoints.length;
  const avgTemperature =
    hoursForPoints.reduce((sum, hour) => sum + hour.airTemperature, 0) / pointCount;
  const avgPrecipitation =
    hoursForPoints.reduce((sum, hour) => sum + hour.precipitationAmount, 0) / pointCount;
  const avgWind = hoursForPoints.reduce((sum, hour) => sum + hour.windSpeed, 0) / pointCount;
  const avgCloudCover =
    hoursForPoints.reduce((sum, hour) => sum + hour.cloudCoverPercent, 0) / pointCount;
  const avgBaseScore = hoursForPoints.reduce((sum, hour) => sum + hour.score, 0) / pointCount;
  const avgTailwind =
    hoursForPoints.reduce((sum, hour) => {
      return sum + calculateTailwindComponent(hour, headingDeg);
    }, 0) / pointCount;

  const tailwindBonus = Math.max(-20, Math.min(20, avgTailwind * 3));
  const adjustedScore = Math.max(0, Math.min(100, Math.round(avgBaseScore + tailwindBonus)));

  return {
    ...firstHour,
    airTemperature: Math.round(avgTemperature * 10) / 10,
    precipitationAmount: Math.round(avgPrecipitation * 10) / 10,
    windSpeed: Math.round(avgWind * 10) / 10,
    cloudCoverPercent: Math.round(avgCloudCover),
    score: adjustedScore,
    scoreLabel: getScoreLabel(adjustedScore),
    scoreReasons:
      avgTailwind >= 1
        ? ["Medvind langs ruten trekker scoren opp."]
        : avgTailwind <= -1
          ? ["Motvind langs ruten trekker scoren ned."]
          : ["Nøytral vindretning langs ruten."],
    tailwindComponent: Math.round(avgTailwind * 10) / 10
  };
}

export async function analyzeCustomRouteWind(
  start: GeocodeResult,
  end: GeocodeResult
): Promise<RouteWindAnalysisResponse> {
  const routePoints = buildRouteSamples(start, end);
  const headingDeg = calculateHeadingDeg(start, end);
  const distanceKm = calculateDistanceKm(start, end);

  const forecasts = await Promise.all(
    routePoints.map((point, index) =>
      fetchForecastForLocation(point.lat, point.lon, `Rutepunkt ${index + 1}`)
    )
  );

  const shortestHourCount = Math.min(...forecasts.map((forecast) => forecast.hours.length));
  const hours = Array.from({ length: shortestHourCount }, (_, index) => {
    const hoursForPoints = forecasts.map((forecast) => forecast.hours[index]);
    return buildRouteHour(hoursForPoints, headingDeg);
  });

  return {
    analyzedAt: new Date().toISOString(),
    start,
    end,
    distanceKm: Math.round(distanceKm * 10) / 10,
    headingDeg: Math.round(headingDeg),
    routePoints,
    hours
  };
}
