import { test, expect } from "@playwright/test";

test("åpner RideSense, velger Oslo og viser prognose uten live-API", async ({ page }) => {
  const now = Date.now();
  const hours = Array.from({ length: 48 }, (_, i) => ({
    time: new Date(now + (i + 1) * 3_600_000).toISOString(),
    airTemperature: 20,
    precipitationAmount: 0,
    windSpeed: 2,
    cloudCoverPercent: 15,
    symbolCode: "clearsky_day",
    score: 92,
    scoreLabel: "good",
    scoreReasons: ["stabile forhold"],
    dataBasis: "forecast_only",
    confidence: { score: 95, level: "high", reason: "Test" }
  }));
  await page.route("**/api/weather?**", async route => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        locationLabel: "Oslo",
        timezone: "Europe/Oslo",
        updatedAt: new Date(now).toISOString(),
        hours,
        bestWindowToday: null,
        bestWindowNext7Days: null,
        dataBasis: "forecast_only",
        observationSummary: { used: false, sourceName: "MET" }
      })
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Velg område" })).toBeVisible();
  await page.getByRole("button", { name: "Prøv med Oslo" }).click();
  await expect(page.getByRole("heading", { name: "Vær og tidspunkt" })).toBeVisible();
  await expect(page.getByText("Sted: Oslo")).toBeVisible();
  await page.getByRole("button", { name: "Neste 7 dager" }).click();
  await expect(page.getByText("Viser utvidet prognose med beste tidsvindu opptil 7 dager frem i tid.")).toBeVisible();
});
