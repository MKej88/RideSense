export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  county?: string;
}

export interface WeatherHourRaw {
  time: string;
  airTemperature: number;
  precipitationAmount: number;
  windSpeed: number;
  cloudCoverPercent: number;
  symbolCode?: string;
  windFromDirection?: number;
  windGust?: number;
}

export type WeatherDataBasis = "forecast_only" | "forecast_plus_observation";
export type DataConfidenceLevel = "high" | "medium" | "low";

export interface DataConfidence {
  score: number;
  level: DataConfidenceLevel;
  reason: string;
}

export interface StationObservation {
  source: "netatmo";
  stationId: string;
  stationName: string;
  observedAt: string;
  distanceKm: number;
  airTemperature?: number;
  precipitationAmount?: number;
  windSpeed?: number;
}

export type ScoreLabel = "good" | "ok" | "bad";

export interface ScoredWeatherHour extends WeatherHourRaw {
  score: number;
  scoreLabel: ScoreLabel;
  scoreReasons: string[];
  tailwindMs?: number;
  dataBasis: WeatherDataBasis;
  confidence: DataConfidence;
}

export interface BestWindow {
  startTime: string;
  endTime: string;
  averageScore: number;
  explanation: string;
}

export interface WeatherResponse {
  locationLabel: string;
  timezone: string;
  updatedAt: string;
  hours: ScoredWeatherHour[];
  bestWindowToday: BestWindow | null;
  bestWindowNext7Days: BestWindow | null;
  dataBasis: WeatherDataBasis;
  observationSummary: {
    used: boolean;
    sourceName: string;
    stationName?: string;
    observedAt?: string;
  };
}
