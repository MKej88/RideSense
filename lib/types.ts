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

export type ScoreLabel = "good" | "ok" | "bad";

export interface ScoredWeatherHour extends WeatherHourRaw {
  score: number;
  scoreLabel: ScoreLabel;
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

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface Route {
  id: string;
  shortName: string;
  description: string;
  distanceKm: number;
  oneWayDistanceKm: number;
  isRoundTrip: boolean;
  startLabel: string;
  endLabel: string;
  points: RoutePoint[];
}

export interface RouteSamplePoint extends RoutePoint {
  index: number;
  label: string;
}

export interface RoutePointAnalysis {
  sample: RouteSamplePoint;
  weather: ScoredWeatherHour;
}

export interface RouteScoreSummary {
  score: number;
  scoreLabel: ScoreLabel;
  explanation: string;
  averageWindSpeed: number;
  averagePrecipitation: number;
  averageTemperature: number;
  scoreSpread: number;
}

export interface RouteAnalysis {
  route: Route;
  sampledPoints: RoutePointAnalysis[];
  summary: RouteScoreSummary;
}

export interface RouteAnalysisResponse {
  locationLabel: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  analyzedAt: string;
  routes: RouteAnalysis[];
  bestRouteId: string | null;
  bestRouteExplanation: string | null;
}
