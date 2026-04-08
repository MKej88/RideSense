import { StationObservation } from "@/lib/types";

const NETATMO_PUBLIC_DATA_URL = "https://api.netatmo.com/api/getpublicdata";
const NETATMO_FETCH_TIMEOUT_MS = 3500;
const OBSERVATION_RADIUS_DEGREES = 0.08;

interface NetatmoModule {
  _id?: string;
  dashboard_data?: Record<string, unknown>;
  time_utc?: unknown;
  time?: unknown;
  last_seen?: unknown;
  last_message?: unknown;
}

interface NetatmoDevice {
  _id?: string;
  place?: {
    location?: [number, number];
  };
  station_name?: string;
  dashboard_data?: Record<string, unknown>;
  modules?: NetatmoModule[];
  time_utc?: unknown;
  time?: unknown;
  last_status_store?: unknown;
  last_seen?: unknown;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getObservedTimestampSeconds(values: Array<unknown>): number | undefined {
  for (const value of values) {
    const rawTimestamp = asFiniteNumber(value);

    if (rawTimestamp === undefined || rawTimestamp <= 0) {
      continue;
    }

    const timestamp =
      rawTimestamp > 100_000_000_000 ? Math.floor(rawTimestamp / 1000) : rawTimestamp;

    if (timestamp > 0) {
      return timestamp;
    }
  }

  return undefined;
}

function toKmDistance(latA: number, lonA: number, latB: number, lonB: number): number {
  const earthRadiusKm = 6371;
  const latDiff = toRadians(latB - latA);
  const lonDiff = toRadians(lonB - lonA);
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(lonDiff / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function extractObservation(
  device: NetatmoDevice,
  module: NetatmoModule | null,
  lat: number,
  lon: number
): StationObservation | null {
  const location = device.place?.location;

  if (!Array.isArray(location) || location.length < 2) {
    return null;
  }

  const stationLon = asFiniteNumber(location[0]);
  const stationLat = asFiniteNumber(location[1]);

  if (stationLat === undefined || stationLon === undefined) {
    return null;
  }

  const distanceKm = toKmDistance(lat, lon, stationLat, stationLon);
  const moduleData = module?.dashboard_data ?? {};
  const deviceData = device.dashboard_data ?? {};

  const airTemperature =
    asFiniteNumber(moduleData.Temperature) ?? asFiniteNumber(deviceData.Temperature);
  const windSpeed =
    asFiniteNumber(moduleData.WindStrength) ?? asFiniteNumber(deviceData.WindStrength);
  const precipitationAmount = asFiniteNumber(moduleData.Rain);

  const observedAtSeconds = getObservedTimestampSeconds([
    moduleData.time_utc,
    deviceData.time_utc,
    moduleData.time,
    deviceData.time,
    module?.time_utc,
    device.time_utc,
    module?.time,
    device.time,
    module?.last_seen,
    module?.last_message,
    device.last_status_store,
    device.last_seen
  ]);

  if (observedAtSeconds === undefined) {
    return null;
  }

  if (
    airTemperature === undefined &&
    windSpeed === undefined &&
    precipitationAmount === undefined
  ) {
    return null;
  }

  return {
    source: "netatmo",
    stationId: module?._id ?? device._id ?? "ukjent",
    stationName: device.station_name ?? "Netatmo-stasjon",
    observedAt: new Date(observedAtSeconds * 1000).toISOString(),
    distanceKm: Math.round(distanceKm * 10) / 10,
    airTemperature,
    precipitationAmount,
    windSpeed
  };
}

export async function fetchNearestStationObservation(
  lat: number,
  lon: number
): Promise<StationObservation | null> {
  const accessToken = process.env.NETATMO_ACCESS_TOKEN;

  if (!accessToken) {
    return null;
  }

  const latNe = lat + OBSERVATION_RADIUS_DEGREES;
  const lonNe = lon + OBSERVATION_RADIUS_DEGREES;
  const latSw = lat - OBSERVATION_RADIUS_DEGREES;
  const lonSw = lon - OBSERVATION_RADIUS_DEGREES;
  const url =
    `${NETATMO_PUBLIC_DATA_URL}?lat_ne=${latNe}&lon_ne=${lonNe}` +
    `&lat_sw=${latSw}&lon_sw=${lonSw}&filter=false`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(NETATMO_FETCH_TIMEOUT_MS)
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const responseBody =
    typeof payload === "object" && payload !== null && "body" in payload
      ? (payload as { body?: unknown }).body
      : undefined;
  const devices =
    Array.isArray(responseBody)
      ? responseBody
      : typeof responseBody === "object" &&
          responseBody !== null &&
          "devices" in responseBody &&
          Array.isArray((responseBody as { devices?: unknown }).devices)
        ? (responseBody as { devices: unknown[] }).devices
        : [];
  const observations = devices
    .flatMap((device): StationObservation[] => {
      if (typeof device !== "object" || device === null) {
        return [];
      }

      const netatmoDevice = device as NetatmoDevice;
      const moduleList = Array.isArray(netatmoDevice.modules)
        ? netatmoDevice.modules
        : [];
      const modules = [null, ...moduleList];

      return modules
        .map((module) => extractObservation(netatmoDevice, module, lat, lon))
        .filter((observation): observation is StationObservation => observation !== null);
    })
    .sort((left: StationObservation, right: StationObservation) => {
      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }

      return (
        new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime()
      );
    });

  return observations[0] ?? null;
}
