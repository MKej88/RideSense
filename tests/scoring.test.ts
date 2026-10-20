import { describe, expect, it } from "vitest";
import { calculateBikeScore, findBestWindowNext7Days, getScoreLabel } from "@/lib/scoring";
import { buildBestWindowFromHours, getVisibleWeatherHours } from "@/lib/forecast-display";
import { getOsloDayKey } from "@/lib/time-format";
import type { ScoredWeatherHour, WeatherHourRaw, WeatherResponse } from "@/lib/types";

const baseHour: WeatherHourRaw = {
  time: "2026-10-20T12:00:00Z",
  airTemperature: 20,
  precipitationAmount: 0,
  windSpeed: 2,
  cloudCoverPercent: 10
};

function scoredHour(time: string, score: number): ScoredWeatherHour {
  return {
    ...baseHour,
    time,
    score,
    scoreLabel: getScoreLabel(score),
    scoreReasons: [],
    dataBasis: "forecast_only",
    confidence: { score: 100, level: "high", reason: "Test" }
  };
}

describe("værscore og sikkerhet", () => {
  it("holder scoren innen 0–100 og klassifiserer den riktig", () => {
    const good = calculateBikeScore(baseHour);
    const poor = calculateBikeScore({
      ...baseHour,
      airTemperature: -15,
      precipitationAmount: 20,
      windSpeed: 30,
      cloudCoverPercent: 100
    });
    expect(good.score).toBeGreaterThan(poor.score);
    expect(good.score).toBeLessThanOrEqual(100);
    expect(poor.score).toBeGreaterThanOrEqual(0);
    expect(getScoreLabel(75)).toBe("good");
    expect(getScoreLabel(50)).toBe("ok");
    expect(getScoreLabel(49)).toBe("bad");
  });

  it("straffer kraftig nedbør og farlige vindkast", () => {
    const ideal = calculateBikeScore(baseHour);
    const rain = calculateBikeScore({ ...baseHour, precipitationAmount: 5 });
    const gust = calculateBikeScore({ ...baseHour, windGust: 18 });
    expect(rain.score).toBeLessThan(ideal.score);
    expect(gust.score).toBeLessThan(ideal.score);
    expect(gust.scoreReasons.join(" ")).toContain("frarådes");
  });
});

describe("prognosevisning", () => {
  it("velger høyeste gjennomsnitt i et sammenhengende tre-timers vindu", () => {
    const start = Date.parse("2026-10-20T10:00:00Z");
    const hours = [30, 40, 80, 90, 100, 10].map((score, idx) =>
      scoredHour(new Date(start + idx * 3_600_000).toISOString(), score)
    );
    const window = buildBestWindowFromHours(hours, start - 3_600_000);
    expect(window?.averageScore).toBe(90);
    expect(window?.startTime).toBe(hours[2].time);
    expect(window?.endTime).toBe(hours[4].time);
  });

  it("respekterer dato og sommertid i Norge", () => {
    // 25. oktober 2026 stilles klokken tilbake: 00:30Z og 01:30Z er begge 02:30 lokalt.
    expect(getOsloDayKey("2026-10-25T00:30:00Z")).toBe("2026-10-25");
    expect(getOsloDayKey("2026-10-25T01:30:00Z")).toBe("2026-10-25");
    expect(getOsloDayKey("2026-10-24T22:30:00Z")).toBe("2026-10-25");
  });

  it("utelater nattimer fra 24-timers visning", () => {
    const start = Date.parse("2026-10-20T20:00:00Z");
    const hours = Array.from({ length: 24 }, (_, i) =>
      scoredHour(new Date(start + (i + 1) * 3_600_000).toISOString(), 70)
    );
    const response = { hours } as WeatherResponse;
    const visible = getVisibleWeatherHours(response, start, "24h");
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(24);
    expect(visible.every(hour => {
      const hourInOslo = Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Oslo", hour: "2-digit", hourCycle: "h23"
      }).format(new Date(hour.time)));
      return hourInOslo >= 6;
    })).toBe(true);
  });

  it("tar ikke med gamle timer i syvdagersvinduet", () => {
    const now = Date.now();
    const scores = [
      scoredHour(new Date(now - 3_600_000).toISOString(), 100),
      scoredHour(new Date(now + 3_600_000).toISOString(), 60),
      scoredHour(new Date(now + 2 * 3_600_000).toISOString(), 70)
    ];
    expect(findBestWindowNext7Days(scores)?.averageScore).toBe(65);
  });
});
