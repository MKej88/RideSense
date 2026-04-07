import { ScoredWeatherHour, WeatherHourRaw } from "@/lib/types";

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

  const scoreLabel: ScoredWeatherHour["scoreLabel"] =
    score >= 75 ? "good" : score >= 50 ? "ok" : "bad";

  return {
    ...hour,
    score,
    scoreLabel,
    scoreReasons: reasons.length > 0 ? reasons : ["stabile og gode forhold"]
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
