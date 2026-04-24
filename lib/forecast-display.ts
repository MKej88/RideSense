import { BestWindow, ScoredWeatherHour, WeatherResponse } from "@/lib/types";
import { getOsloDayKey, OSLO_TIME_ZONE } from "@/lib/time-format";

const osloHourFormatter = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  hour12: false,
  timeZone: OSLO_TIME_ZONE
});

export interface ForecastDay {
  dayKey: string;
  label: string;
  hours: ScoredWeatherHour[];
  bestWindow: BestWindow | null;
}

function getOsloHour(time: string): number {
  return Number(osloHourFormatter.format(new Date(time)));
}

function isCyclingHour(time: string): boolean {
  return getOsloHour(time) >= 6;
}

export function getNextHourTimestamp(nowMs: number): number {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return Math.floor(nowMs / ONE_HOUR_MS) * ONE_HOUR_MS + ONE_HOUR_MS;
}

export function getCurrentOrNextHour<T extends { time: string }>(
  hours: T[],
  referenceMs: number
): T | null {
  if (hours.length === 0) {
    return null;
  }

  const nextHourTs = getNextHourTimestamp(referenceMs);
  const nextHour = hours.find((hour) => new Date(hour.time).getTime() >= nextHourTs);

  if (nextHour) {
    return nextHour;
  }

  return hours[hours.length - 1] || null;
}

export function buildBestWindowFromHours(
  hours: WeatherResponse["hours"],
  analysisRunMs: number
): BestWindow | null {
  const nextHourTs = getNextHourTimestamp(analysisRunMs);
  const futureHours = hours.filter((hour) => new Date(hour.time).getTime() >= nextHourTs);

  if (futureHours.length === 0) {
    return null;
  }

  const windowSize = Math.min(3, futureHours.length);
  let bestStartIndex = 0;
  let rollingSum = 0;

  for (let index = 0; index < windowSize; index += 1) {
    rollingSum += futureHours[index].score;
  }

  let bestAverage = rollingSum / windowSize;

  for (let index = windowSize; index < futureHours.length; index += 1) {
    rollingSum += futureHours[index].score;
    rollingSum -= futureHours[index - windowSize].score;
    const average = rollingSum / windowSize;

    if (average > bestAverage) {
      bestAverage = average;
      bestStartIndex = index - windowSize + 1;
    }
  }

  const bestSegment = futureHours.slice(bestStartIndex, bestStartIndex + windowSize);

  return {
    startTime: bestSegment[0].time,
    endTime: bestSegment[bestSegment.length - 1].time,
    averageScore: Math.round(bestAverage),
    explanation: "Beste synlige tidsvindu basert på gjennomsnittlig værscore."
  };
}

export function getVisibleWeatherHours(
  weather: WeatherResponse | null,
  analysisRunMs: number | null,
  forecastRange: "24h" | "7d"
): ScoredWeatherHour[] {
  if (!weather || analysisRunMs === null) {
    return [];
  }

  const nextHourTs = getNextHourTimestamp(analysisRunMs);

  if (forecastRange === "7d") {
    const futureHours = weather.hours.filter((hour) => new Date(hour.time).getTime() >= nextHourTs);
    const dayKeys = Array.from(new Set(futureHours.map((hour) => getOsloDayKey(hour.time))));
    const allowedDays = new Set(dayKeys.slice(0, 7));

    return futureHours.filter(
      (hour) => allowedDays.has(getOsloDayKey(hour.time)) && isCyclingHour(hour.time)
    );
  }

  const nextDayHours = weather.hours
    .filter((hour) => new Date(hour.time).getTime() >= nextHourTs)
    .slice(0, 24);

  return nextDayHours.filter((hour) => isCyclingHour(hour.time));
}

export function getForecastDays(
  visibleWeatherHours: ScoredWeatherHour[],
  analysisRunMs: number | null
): ForecastDay[] {
  if (analysisRunMs === null) {
    return [];
  }

  const grouped = new Map<string, ScoredWeatherHour[]>();

  visibleWeatherHours.forEach((hour) => {
    const key = getOsloDayKey(hour.time);
    const existing = grouped.get(key) || [];
    existing.push(hour);
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries()).map(([dayKey, hours]) => ({
    dayKey,
    label: new Date(hours[0].time).toLocaleDateString("nb-NO", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      timeZone: OSLO_TIME_ZONE
    }),
    hours,
    bestWindow: buildBestWindowFromHours(hours, analysisRunMs)
  }));
}
