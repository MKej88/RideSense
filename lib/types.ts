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
  windFromDirection?: number;
  windGust?: number;
}

export interface ScoredWeatherHour extends WeatherHourRaw {
  score: number;
  scoreLabel: "good" | "ok" | "bad";
  scoreReasons: string[];
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
  hours: ScoredWeatherHour[];
  bestWindowToday: BestWindow | null;
}
