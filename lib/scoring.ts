import {
  RouteScoreSummary,
  ScoreLabel,
  ScoredWeatherHour,
  StationObservation,
  WeatherHourRaw
} from "@/lib/types";

interface ScoreThresholds {
  idealTempMin: number;
  idealTempMax: number;
  moderateWindStart: number;
  strongWindStart: number;
  lightRainStart: number;
  heavyRainStart: number;
}

interface ObservationDelta {
  temperature: number;
  wind: number;
  precipitation: number;
}

// Terskler samlet på ett sted for enkel justering i senere versjoner.
export const SCORE_THRESHOLDS: ScoreThresholds = {
  idealTempMin: 18,
  idealTempMax: 22,
  moderateWindStart: 7,
  strongWindStart: 11,
  lightRainStart: 0.3,
  heavyRainStart: 1.5
};

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 75) {
    return "good";
  }

  if (score >= 50) {
    return "ok";
  }

  return "bad";
}

function buildObservationDelta(
  hour: WeatherHourRaw,
  observation: StationObservation
): ObservationDelta {
  return {
    temperature:
      observation.airTemperature !== undefined
        ? Math.abs(observation.airTemperature - hour.airTemperature)
        : 0,
    wind:
      observation.windSpeed !== undefined
        ? Math.abs(observation.windSpeed - hour.windSpeed)
        : 0,
    precipitation:
      observation.precipitationAmount !== undefined
        ? Math.abs(observation.precipitationAmount - hour.precipitationAmount)
        : 0
  };
}

function calculateObservationPenalty(delta: ObservationDelta): {
  penalty: number;
  reason: string | null;
} {
  const strongDeviation =
    delta.temperature >= 4 || delta.wind >= 3 || delta.precipitation >= 1;
  const mediumDeviation =
    delta.temperature >= 2 || delta.wind >= 1.5 || delta.precipitation >= 0.5;

  if (strongDeviation) {
    return {
      penalty: 10,
      reason: "lokale målinger avviker tydelig fra prognosen"
    };
  }

  if (mediumDeviation) {
    return {
      penalty: 4,
      reason: "lokale målinger avviker litt fra prognosen"
    };
  }

  return {
    penalty: 0,
    reason: null
  };
}

function buildConfidence(
  hasObservation: boolean,
  observationPenalty: number,
  observationAgeHours: number,
  stationDistanceKm: number
): { score: number; level: "high" | "medium" | "low"; reason: string } {
  if (!hasObservation) {
    return {
      score: 60,
      level: "medium",
      reason: "Bygger kun på prognose fra MET."
    };
  }

  let confidenceScore = 86;

  if (observationAgeHours > 2) {
    confidenceScore -= 16;
  } else if (observationAgeHours > 1) {
    confidenceScore -= 8;
  }

  if (stationDistanceKm > 8) {
    confidenceScore -= 12;
  } else if (stationDistanceKm > 4) {
    confidenceScore -= 6;
  }

  confidenceScore -= observationPenalty * 2;
  confidenceScore = Math.max(20, Math.min(98, Math.round(confidenceScore)));

  if (confidenceScore >= 75) {
    return {
      score: confidenceScore,
      level: "high",
      reason: "Prognose er støttet av fersk lokal observasjon."
    };
  }

  if (confidenceScore >= 50) {
    return {
      score: confidenceScore,
      level: "medium",
      reason: "Prognose er justert med observasjon, men med noe usikkerhet."
    };
  }

  return {
    score: confidenceScore,
    level: "low",
    reason: "Observasjon avviker mye eller er lite representativ for punktet."
  };
}

function calculateTemperatureScore(temperature: number): number {
  if (
    temperature >= SCORE_THRESHOLDS.idealTempMin &&
    temperature <= SCORE_THRESHOLDS.idealTempMax
  ) {
    return 40;
  }

  const deviation =
    temperature < SCORE_THRESHOLDS.idealTempMin
      ? SCORE_THRESHOLDS.idealTempMin - temperature
      : temperature - SCORE_THRESHOLDS.idealTempMax;

  return Math.max(0, 40 - deviation * 4);
}

function calculateRainScore(precipitationAmount: number): number {
  return Math.max(0, 30 - Math.max(0, precipitationAmount) * 15);
}

function calculateWindScore(windSpeed: number): number {
  return Math.max(0, 20 - Math.max(0, windSpeed) * 2);
}

function calculateWindGustPenalty(windGust?: number): number {
  if (windGust === undefined) {
    return 0;
  }

  const gust = Math.max(0, windGust);

  if (gust < 10) {
    return 0;
  }

  if (gust < 14) {
    return Math.round((gust - 10) * 1);
  }

  if (gust < 18) {
    return Math.round(4 + (gust - 14) * 1.5);
  }

  return Math.min(15, Math.round(10 + (gust - 18) * 1.25));
}

function calculateSunScore(cloudCoverPercent: number): number {
  const clampedClouds = Math.max(0, Math.min(100, cloudCoverPercent));
  return 10 * (1 - clampedClouds / 100);
}

export function calculateBikeScore(
  hour: WeatherHourRaw,
  observation: StationObservation | null = null
): ScoredWeatherHour {
  let score = 0;
  const reasons: string[] = [];

  const rainScore = calculateRainScore(hour.precipitationAmount);
  score += rainScore;
  if (rainScore <= 5) {
    reasons.push("kraftig nedbør trekker mye ned");
  } else if (rainScore <= 20) {
    reasons.push("lett nedbør trekker ned");
  }

  const windScore = calculateWindScore(hour.windSpeed);
  score += windScore;
  if (windScore <= 6) {
    reasons.push("sterk vind gjør forholdene krevende");
  } else if (windScore <= 14) {
    reasons.push("moderat vind trekker ned");
  }

  const windGustPenalty = calculateWindGustPenalty(hour.windGust);
  score -= windGustPenalty;
  if (hour.windGust !== undefined && hour.windGust >= 17) {
    reasons.push("vindkast over 17 m/s: landeveissykling frarådes");
  } else if (hour.windGust !== undefined && hour.windGust >= 14) {
    reasons.push("vindkast nær 15 m/s: vurder skjermet rute eller å droppe turen");
  } else if (windGustPenalty >= 8) {
    reasons.push("kraftige vindkast gir sikkerhetsrisiko");
  } else if (windGustPenalty > 0) {
    reasons.push("vindkast trekker ned");
  }

  const temperatureScore = calculateTemperatureScore(hour.airTemperature);
  score += temperatureScore;
  if (temperatureScore <= 20) {
    reasons.push("temperaturen er langt unna idealområdet");
  } else if (temperatureScore <= 32) {
    reasons.push("temperaturen er litt utenfor idealområdet");
  }

  const sunScore = calculateSunScore(hour.cloudCoverPercent);
  score += sunScore;
  if (sunScore <= 3) {
    reasons.push("mye skyer trekker ned");
  }

  let dataBasis: "forecast_only" | "forecast_plus_observation" = "forecast_only";
  let observationPenalty = 0;
  let observationAgeHours = 0;
  let stationDistanceKm = 0;

  if (observation) {
    dataBasis = "forecast_plus_observation";
    const delta = buildObservationDelta(hour, observation);
    const penaltyResult = calculateObservationPenalty(delta);

    observationPenalty = penaltyResult.penalty;
    score -= observationPenalty;

    if (penaltyResult.reason) {
      reasons.push(penaltyResult.reason);
    }

    observationAgeHours =
      (new Date(hour.time).getTime() - new Date(observation.observedAt).getTime()) /
      (1000 * 60 * 60);
    stationDistanceKm = observation.distanceKm;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidence = buildConfidence(
    observation !== null,
    observationPenalty,
    observationAgeHours,
    stationDistanceKm
  );

  return {
    ...hour,
    score,
    scoreLabel: getScoreLabel(score),
    scoreReasons: reasons.length > 0 ? reasons : ["stabile og gode forhold"],
    dataBasis,
    confidence
  };
}

export function calculateRouteScore(hours: ScoredWeatherHour[]): RouteScoreSummary {
  if (hours.length === 0) {
    return {
      score: 0,
      scoreLabel: "bad",
      explanation: "Ingen værpunkter tilgjengelig for ruten.",
      averageWindSpeed: 0,
      averagePrecipitation: 0,
      averageTemperature: 0,
      scoreSpread: 0
    };
  }

  const averageScore =
    hours.reduce((sum, hour) => sum + hour.score, 0) / hours.length;
  const scores = hours.map((hour) => hour.score);
  const scoreSpread = Math.max(...scores) - Math.min(...scores);
  const averageWindSpeed =
    hours.reduce((sum, hour) => sum + hour.windSpeed, 0) / hours.length;
  const averagePrecipitation =
    hours.reduce((sum, hour) => sum + hour.precipitationAmount, 0) / hours.length;
  const averageTemperature =
    hours.reduce((sum, hour) => sum + hour.airTemperature, 0) / hours.length;

  const routeScore = Math.max(
    0,
    Math.min(100, Math.round(averageScore - scoreSpread * 0.2))
  );

  return {
    score: routeScore,
    scoreLabel: getScoreLabel(routeScore),
    explanation: summarizeRoute(hours),
    averageWindSpeed: roundToOneDecimal(averageWindSpeed),
    averagePrecipitation: roundToOneDecimal(averagePrecipitation),
    averageTemperature: roundToOneDecimal(averageTemperature),
    scoreSpread: roundToOneDecimal(scoreSpread)
  };
}

export function findBestWindowToday(hours: ScoredWeatherHour[]): {
  startTime: string;
  endTime: string;
  averageScore: number;
  explanation: string;
} | null {
  const osloToday = formatDateInTimeZone(new Date(), "Europe/Oslo");

  return findBestWindowWithinPeriod(hours, (hourDate, now) => {
    const isTodayInOslo =
      formatDateInTimeZone(hourDate, "Europe/Oslo") === osloToday;
    const isFutureHour = hourDate.getTime() >= now.getTime();

    return isTodayInOslo && isFutureHour;
  });
}

export function findBestWindowNext7Days(hours: ScoredWeatherHour[]): {
  startTime: string;
  endTime: string;
  averageScore: number;
  explanation: string;
} | null {
  return findBestWindowWithinPeriod(hours, (hourDate, now) => {
    const msInDay = 24 * 60 * 60 * 1000;
    const diffMs = hourDate.getTime() - now.getTime();

    return diffMs >= 0 && diffMs <= 7 * msInDay;
  });
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function findBestWindowWithinPeriod(
  hours: ScoredWeatherHour[],
  predicate: (hourDate: Date, now: Date) => boolean
): {
  startTime: string;
  endTime: string;
  averageScore: number;
  explanation: string;
} | null {
  const now = new Date();
  const candidateHours = hours.filter((hour) => {
    const hourDate = new Date(hour.time);
    return predicate(hourDate, now);
  });

  if (candidateHours.length === 0) {
    return null;
  }

  const windowSize = Math.min(3, candidateHours.length);
  let bestStartIndex = 0;
  let bestAverage = -1;

  for (let index = 0; index <= candidateHours.length - windowSize; index += 1) {
    const segment = candidateHours.slice(index, index + windowSize);
    const average =
      segment.reduce((sum, hour) => sum + hour.score, 0) / segment.length;

    if (average > bestAverage) {
      bestAverage = average;
      bestStartIndex = index;
    }
  }

  const bestSegment = candidateHours.slice(bestStartIndex, bestStartIndex + windowSize);
  const first = bestSegment[0];
  const last = bestSegment[bestSegment.length - 1];

  return {
    startTime: first.time,
    endTime: last.time,
    averageScore: Math.round(bestAverage),
    explanation: summarizeWindow(bestSegment)
  };
}

function summarizeWindow(hours: ScoredWeatherHour[]): string {
  const avgWind = hours.reduce((sum, hour) => sum + hour.windSpeed, 0) / hours.length;
  const avgRain =
    hours.reduce((sum, hour) => sum + hour.precipitationAmount, 0) / hours.length;

  if (avgRain < SCORE_THRESHOLDS.lightRainStart && avgWind < SCORE_THRESHOLDS.moderateWindStart) {
    return "Lite vind og opphold gjør dette tidsvinduet spesielt bra.";
  }

  if (avgRain < SCORE_THRESHOLDS.heavyRainStart) {
    return "Begrenset nedbør og håndterbar vind gir gode sykkelforhold.";
  }

  return "Dette er dagens beste kompromiss mellom vind, nedbør og temperatur.";
}

function summarizeRoute(hours: ScoredWeatherHour[]): string {
  const avgWind = hours.reduce((sum, hour) => sum + hour.windSpeed, 0) / hours.length;
  const avgRain =
    hours.reduce((sum, hour) => sum + hour.precipitationAmount, 0) / hours.length;
  const coldPoints = hours.filter(
    (hour) => hour.airTemperature < SCORE_THRESHOLDS.idealTempMin
  ).length;

  if (
    avgRain < SCORE_THRESHOLDS.lightRainStart &&
    avgWind < SCORE_THRESHOLDS.moderateWindStart
  ) {
    return "Lite vind og lav nedbørsrisiko gir en jevn og trygg rute akkurat nå.";
  }

  if (avgWind >= SCORE_THRESHOLDS.strongWindStart) {
    return "Vind er den største utfordringen på denne ruten akkurat nå.";
  }

  if (avgRain >= SCORE_THRESHOLDS.lightRainStart) {
    return "Nedbørsrisiko på deler av ruten trekker totalscoren ned.";
  }

  if (coldPoints >= Math.ceil(hours.length / 2)) {
    return "Ruten er ganske kjølig, men ellers forholdsvis stabil akkurat nå.";
  }

  return "Forholdene er brukbare, men varierer litt mellom punktene på ruten.";
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
