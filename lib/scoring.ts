import {
  RouteScoreSummary,
  ScoreLabel,
  ScoredWeatherHour,
  WeatherHourRaw
} from "@/lib/types";

interface ScoreThresholds {
  idealTempMin: number;
  idealTempMax: number;
  coldPenaltyStart: number;
  heatPenaltyStart: number;
  moderateWindStart: number;
  strongWindStart: number;
  gustPenaltyStart: number;
  lightRainStart: number;
  heavyRainStart: number;
}

// Terskler samlet på ett sted for enkel justering i senere versjoner.
export const SCORE_THRESHOLDS: ScoreThresholds = {
  idealTempMin: 12,
  idealTempMax: 22,
  coldPenaltyStart: 5,
  heatPenaltyStart: 26,
  moderateWindStart: 7,
  strongWindStart: 11,
  gustPenaltyStart: 14,
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

export function calculateBikeScore(hour: WeatherHourRaw): ScoredWeatherHour {
  let score = 100;
  const reasons: string[] = [];

  if (hour.precipitationAmount >= SCORE_THRESHOLDS.heavyRainStart) {
    score -= 35;
    reasons.push("kraftig nedbør trekker mye ned");
  } else if (hour.precipitationAmount >= SCORE_THRESHOLDS.lightRainStart) {
    score -= 18;
    reasons.push("lett nedbør trekker ned");
  }

  if (hour.windSpeed >= SCORE_THRESHOLDS.strongWindStart) {
    score -= 28;
    reasons.push("sterk vind gjør forholdene krevende");
  } else if (hour.windSpeed >= SCORE_THRESHOLDS.moderateWindStart) {
    score -= 14;
    reasons.push("moderat vind trekker ned");
  }

  if (
    hour.windGust !== undefined &&
    hour.windGust >= SCORE_THRESHOLDS.gustPenaltyStart
  ) {
    score -= 12;
    reasons.push("vindkast gir uforutsigbare forhold");
  }

  if (hour.airTemperature < SCORE_THRESHOLDS.coldPenaltyStart) {
    score -= 20;
    reasons.push("kald temperatur");
  } else if (hour.airTemperature < SCORE_THRESHOLDS.idealTempMin) {
    score -= 8;
    reasons.push("litt kjølig temperatur");
  } else if (hour.airTemperature > SCORE_THRESHOLDS.heatPenaltyStart + 4) {
    score -= 20;
    reasons.push("svært høy temperatur");
  } else if (hour.airTemperature > SCORE_THRESHOLDS.heatPenaltyStart) {
    score -= 10;
    reasons.push("varm temperatur");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ...hour,
    score,
    scoreLabel: getScoreLabel(score),
    scoreReasons: reasons.length > 0 ? reasons : ["stabile og gode forhold"]
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
  const today = new Date().toISOString().slice(0, 10);
  const todayHours = hours.filter((hour) => hour.time.startsWith(today));

  if (todayHours.length === 0) {
    return null;
  }

  const windowSize = Math.min(3, todayHours.length);
  let bestStartIndex = 0;
  let bestAverage = -1;

  for (let index = 0; index <= todayHours.length - windowSize; index += 1) {
    const segment = todayHours.slice(index, index + windowSize);
    const average =
      segment.reduce((sum, hour) => sum + hour.score, 0) / segment.length;

    if (average > bestAverage) {
      bestAverage = average;
      bestStartIndex = index;
    }
  }

  const bestSegment = todayHours.slice(bestStartIndex, bestStartIndex + windowSize);
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
