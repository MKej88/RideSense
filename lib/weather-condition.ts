import { ScoredWeatherHour } from "@/lib/types";

export type WeatherConditionKey = "sol" | "regn" | "vind" | "fare";

export interface WeatherConditionVisual {
  key: WeatherConditionKey;
  icon: string;
  label: string;
}

const DANGEROUS_WIND_GUST_THRESHOLD = 17;
const HIGH_WIND_THRESHOLD = 10.8;

const WEATHER_CONDITION_VISUALS: Record<WeatherConditionKey, WeatherConditionVisual> = {
  sol: { key: "sol", icon: "☀️", label: "Sol" },
  regn: { key: "regn", icon: "🌧️", label: "Regn" },
  vind: { key: "vind", icon: "💨", label: "Vind" },
  fare: { key: "fare", icon: "⚠️", label: "Fare" }
};

function isRainSymbol(symbolCode?: string): boolean {
  const symbol = (symbolCode || "").toLowerCase();
  return symbol.includes("rain") || symbol.includes("showers");
}

function isDangerSymbol(symbolCode?: string): boolean {
  const symbol = (symbolCode || "").toLowerCase();
  return symbol.includes("thunder") || symbol.includes("sleet") || symbol.includes("snow");
}

export function getWeatherConditionKey(
  hour: Pick<ScoredWeatherHour, "symbolCode" | "windSpeed" | "windGust" | "precipitationAmount">
): WeatherConditionKey {
  if (isDangerSymbol(hour.symbolCode)) {
    return "fare";
  }

  if (hour.windGust !== undefined && hour.windGust >= DANGEROUS_WIND_GUST_THRESHOLD) {
    return "fare";
  }

  if (isRainSymbol(hour.symbolCode)) {
    return "regn";
  }

  if (hour.precipitationAmount > 0) {
    return "regn";
  }

  if (hour.windSpeed >= HIGH_WIND_THRESHOLD) {
    return "vind";
  }

  return "sol";
}

export function getWeatherConditionVisual(
  hour: Pick<ScoredWeatherHour, "symbolCode" | "windSpeed" | "windGust" | "precipitationAmount">
): WeatherConditionVisual {
  return WEATHER_CONDITION_VISUALS[getWeatherConditionKey(hour)];
}

export function getWeatherLegendItems(): WeatherConditionVisual[] {
  return [
    WEATHER_CONDITION_VISUALS.sol,
    WEATHER_CONDITION_VISUALS.regn,
    WEATHER_CONDITION_VISUALS.vind,
    WEATHER_CONDITION_VISUALS.fare
  ];
}
