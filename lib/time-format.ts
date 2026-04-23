const OSLO_TIME_ZONE = "Europe/Oslo";
const STALE_MINUTES_THRESHOLD = 60;

function asDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatOsloTime(value: string | number | Date): string {
  return asDate(value).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: OSLO_TIME_ZONE
  });
}

export function formatOsloDayAndTime(value: string | number | Date): string {
  return asDate(value).toLocaleString("nb-NO", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: OSLO_TIME_ZONE
  });
}

export function formatOsloDateTime(value: string | number | Date): string {
  return asDate(value).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: OSLO_TIME_ZONE
  });
}

export function getOsloDayKey(value: string | number | Date): string {
  return asDate(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: OSLO_TIME_ZONE
  });
}

export function isOlderThanMinutes(
  value: string | number | Date,
  thresholdMinutes: number = STALE_MINUTES_THRESHOLD,
  now: string | number | Date = Date.now()
): boolean {
  const ageMs = asDate(now).getTime() - asDate(value).getTime();
  return ageMs > thresholdMinutes * 60 * 1000;
}

export function formatAgeInMinutes(
  value: string | number | Date,
  now: string | number | Date = Date.now()
): string {
  const ageMs = Math.max(0, asDate(now).getTime() - asDate(value).getTime());
  const ageMinutes = Math.floor(ageMs / (60 * 1000));

  if (ageMinutes < 1) {
    return "mindre enn 1 min";
  }

  if (ageMinutes === 1) {
    return "1 min";
  }

  return `${ageMinutes} min`;
}

export { OSLO_TIME_ZONE, STALE_MINUTES_THRESHOLD };
