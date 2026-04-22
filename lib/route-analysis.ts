import { ROUTE_PROFILES } from "@/data/routes";
import { calculateRouteScore } from "@/lib/scoring";
import { fetchForecastForLocation } from "@/lib/weather";
import {
  Route,
  RouteAnalysis,
  RouteAnalysisResponse,
  RoutePoint,
  RouteSamplePoint,
  RouteTimeAnalysisResponse,
  RouteWindHour
} from "@/lib/types";

interface RouteProfile {
  id: string;
  shortName: string;
  slot: "short" | "medium" | "long";
}

interface OverpassWay {
  geometry?: RoutePoint[];
  tags?: Record<string, string>;
}

interface OverpassPlaceElement {
  lat?: number;
  lon?: number;
  center?: RoutePoint;
  tags?: Record<string, string>;
}

interface GeonorgePlaceResult {
  meterFraPunkt?: number;
  navneobjekttype?: string;
  representasjonspunkt?: {
    nord?: number;
    øst?: number;
  };
  stedsnavn?: Array<{
    skrivemåte?: string;
  }>;
}

interface GeonorgePlaceResponse {
  navn?: GeonorgePlaceResult[];
}

interface EndpointCandidate {
  point: RoutePoint;
  surface: string;
  highway: string;
  roadName?: string;
  straightDistanceKm: number;
  bearing: number;
  isPlaceDestination?: boolean;
}

interface OsrmResponse {
  routes?: Array<{
    distance: number;
    geometry?: {
      coordinates: [number, number][];
    };
  }>;
}

interface RoutedCandidate {
  route: Route;
  surface: string;
  highway: string;
  endPoint: RoutePoint;
  bearing: number;
  withinRequestedRange: boolean;
  distanceGapKm: number;
}

const ROUTE_SAMPLE_COUNT = 5;
const PRIMARY_SURFACES = ["asphalt"];
const SECONDARY_SURFACES = [
  "paved",
  "concrete",
  "concrete:lanes",
  "concrete:plates"
];
const ALLOWED_HIGHWAYS = [
  "cycleway",
  "living_street",
  "residential",
  "service",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "unclassified"
];
const BASE_MAX_ENDPOINT_CANDIDATES = 12;
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const OVERPASS_FETCH_TIMEOUT_MS = 5000;
const OSRM_FETCH_TIMEOUT_MS = 4000;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 8;
const ROUTE_MATCH_TOLERANCE_KM = 0.5;
const ROUTE_SEARCH_ATTEMPTS = 5;
const OSRM_PROFILES = ["bicycle", "driving"] as const;
const ROUTE_BUILD_CONCURRENCY = 4;
const GEONORGE_PLACE_FETCH_TIMEOUT_MS = 3500;
const GEONORGE_PLACE_URL = "https://ws.geonorge.no/stedsnavn/v1/punkt";
const LONG_ROUTE_THRESHOLD_KM = 80;
const DESIRED_ROUTED_CANDIDATES = 6;

export async function analyzePredefinedRoutes(
  lat: number,
  lon: number,
  locationLabel: string,
  minDistanceKm: number,
  maxDistanceKm: number
): Promise<RouteAnalysisResponse> {
  const origin = { lat, lon };
  const routesForLocation = await buildRoutesForLocation(
    origin,
    locationLabel,
    minDistanceKm,
    maxDistanceKm
  );
  const routes = await Promise.all(routesForLocation.map((route) => analyzeRoute(route)));
  const bestRoute = [...routes].sort((left, right) => right.summary.score - left.summary.score)[0];

  return {
    locationLabel,
    minDistanceKm,
    maxDistanceKm,
    analyzedAt: new Date().toISOString(),
    routes,
    bestRouteId: bestRoute?.route.id ?? null,
    bestRouteExplanation: bestRoute ? explainBestRoute(bestRoute, routes) : null
  };
}

async function buildRoutesForLocation(
  origin: RoutePoint,
  locationLabel: string,
  minDistanceKm: number,
  maxDistanceKm: number
): Promise<Route[]> {
  const endpointCandidates = await fetchEndpointCandidates(origin, minDistanceKm, maxDistanceKm);
  const routedCandidates = await buildRoutedCandidates(
    origin,
    locationLabel,
    endpointCandidates,
    minDistanceKm,
    maxDistanceKm
  );
  const chosenRoutes = chooseBestRoutes(routedCandidates, minDistanceKm, maxDistanceKm);

  if (routedCandidates.length === 0 || chosenRoutes.length === 0) {
    throw new Error("Fant ingen egnede veiruter innenfor valgt kilometerområde.");
  }

  return chosenRoutes.map((candidate) => candidate.route);
}

async function fetchEndpointCandidates(
  origin: RoutePoint,
  minDistanceKm: number,
  maxDistanceKm: number
): Promise<EndpointCandidate[]> {
  const adaptiveCandidates = buildAdaptiveEndpointCandidates(origin, minDistanceKm, maxDistanceKm);
  const selectedAdaptiveCandidates = selectDiverseEndpoints(adaptiveCandidates, maxDistanceKm);
  const placeCandidates =
    maxDistanceKm >= 60 ? await fetchRegionalPlaceCandidates(origin, minDistanceKm, maxDistanceKm) : [];

  if (maxDistanceKm >= LONG_ROUTE_THRESHOLD_KM) {
    return mergeEndpointCandidates(
      getEndpointCandidateLimit(maxDistanceKm),
      placeCandidates,
      selectedAdaptiveCandidates
    );
  }

  try {
    const ways = await fetchOverpassWays(origin, maxDistanceKm);
    const rawCandidates = ways.flatMap((way) => toEndpointCandidates(way, origin, maxDistanceKm));

    if (rawCandidates.length > 0) {
      return mergeEndpointCandidates(
        getEndpointCandidateLimit(maxDistanceKm),
        placeCandidates,
        selectDiverseEndpoints(rawCandidates, maxDistanceKm),
        selectedAdaptiveCandidates
      );
    }
  } catch {
    // Fall through to a routing-based fallback when Overpass is unavailable.
  }

  return mergeEndpointCandidates(
    getEndpointCandidateLimit(maxDistanceKm),
    placeCandidates,
    selectedAdaptiveCandidates
  );
}

async function fetchOverpassWays(
  origin: RoutePoint,
  maxDistanceKm: number
): Promise<OverpassWay[]> {
  const highwayPattern = ALLOWED_HIGHWAYS.join("|");
  const searchRadiusMeters = Math.min(
    18000,
    Math.max(4000, Math.round((maxDistanceKm / 2) * 1100))
  );
  const strictSurfacePattern = [...PRIMARY_SURFACES, ...SECONDARY_SURFACES].join("|");
  const queries = [
    `
[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];
(
  way(around:${searchRadiusMeters},${origin.lat},${origin.lon})
    [highway~"^(${highwayPattern})$"]
    [surface~"^(${strictSurfacePattern})$"];
);
out tags geom;
`,
    `
[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];
(
  way(around:${searchRadiusMeters},${origin.lat},${origin.lon})
    [highway~"^(${highwayPattern})$"];
);
out tags geom;
`
  ];

  for (const query of queries) {
    const ways = await fetchFirstAvailableOverpassResult(query);

    if (ways.length > 0) {
      return ways;
    }
  }

  throw new Error("Karttjenesten for veidata svarte ikke raskt nok.");
}

async function fetchRegionalPlaceCandidates(
  origin: RoutePoint,
  minDistanceKm: number,
  maxDistanceKm: number
): Promise<EndpointCandidate[]> {
  const oneWayTargets = buildTargetDistances(minDistanceKm, maxDistanceKm).map(
    (distanceKm) => distanceKm / 2
  );
  const bearings =
    maxDistanceKm >= LONG_ROUTE_THRESHOLD_KM
      ? [45, 80, 100, 125, 150, 200, 225, 250]
      : [60, 90, 120, 150, 210, 240];
  const searchPoints = oneWayTargets.flatMap((distanceKm) =>
    bearings.map((bearing) => ({
      distanceKm,
      bearing,
      point: projectPoint(origin, bearing, distanceKm)
    }))
  );
  const results = await mapWithConcurrency(searchPoints, 4, async (searchPoint) => {
    const places = await fetchGeonorgePlacesNearPoint(searchPoint.point);

    return places
      .map((place) => toGeonorgePlaceEndpointCandidate(place, origin))
      .filter((candidate): candidate is EndpointCandidate => {
        if (!candidate) {
          return false;
        }

        const estimatedTotalDistanceKm = candidate.straightDistanceKm * 2.2;

        return (
          candidate.straightDistanceKm >= Math.max(8, minDistanceKm / 2 * 0.6) &&
          candidate.straightDistanceKm <= Math.max(12, maxDistanceKm / 2 * 1.1) &&
          distanceToRange(estimatedTotalDistanceKm, minDistanceKm, maxDistanceKm) <=
            Math.max(20, maxDistanceKm * 0.2)
        );
      });
  });

  const seen = new Set<string>();

  return results
    .flat()
    .filter((candidate) => {
      const key = `${candidate.roadName}|${roundToOneDecimal(candidate.point.lat)}|${roundToOneDecimal(candidate.point.lon)}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftGap = distanceToRange(left.straightDistanceKm * 2.2, minDistanceKm, maxDistanceKm);
      const rightGap = distanceToRange(
        right.straightDistanceKm * 2.2,
        minDistanceKm,
        maxDistanceKm
      );

      if (leftGap !== rightGap) {
        return leftGap - rightGap;
      }

      return endpointPriority(right) - endpointPriority(left);
    })
    .slice(0, maxDistanceKm >= LONG_ROUTE_THRESHOLD_KM ? 8 : 6);
}

function buildAdaptiveEndpointCandidates(
  origin: RoutePoint,
  minDistanceKm: number,
  maxDistanceKm: number
): EndpointCandidate[] {
  const totalDistanceTargets = buildTargetDistances(minDistanceKm, maxDistanceKm);
  const ratios =
    maxDistanceKm >= 80
      ? [0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.64]
      : [0.3, 0.34, 0.38, 0.42, 0.46];
  const bearings =
    maxDistanceKm >= 80
      ? [0, 20, 40, 60, 80, 100, 120, 145, 170, 195, 220, 245, 270, 295, 320, 340]
      : [0, 35, 70, 110, 145, 180, 215, 250, 290, 325];
  const candidates: EndpointCandidate[] = [];

  for (const totalDistanceKm of totalDistanceTargets) {
    for (const ratio of ratios) {
      const straightDistanceKm = Math.max(1.2, roundToOneDecimal(totalDistanceKm * ratio));

      for (const bearing of bearings) {
        const point = projectPoint(origin, bearing, straightDistanceKm);

        candidates.push({
          point,
          surface: "paved",
          highway: "road",
          straightDistanceKm,
          bearing,
          isPlaceDestination: false
        });
      }
    }
  }

  return candidates;
}

function toEndpointCandidates(
  way: OverpassWay,
  origin: RoutePoint,
  maxDistanceKm: number
): EndpointCandidate[] {
  const points = normalizeGeometry(way.geometry);
  const highway = way.tags?.highway;
  const surface = way.tags?.surface || inferSurface(highway);

  if (!points || !highway) {
    return [];
  }

  return sampleGeometry(points).flatMap((point) => {
    const straightDistanceKm = estimateDistanceKm(origin, point);

    if (straightDistanceKm < 0.6 || straightDistanceKm > maxDistanceKm * 0.7) {
      return [];
    }

    return [
      {
        point,
        surface,
        highway,
        roadName: way.tags?.name,
        straightDistanceKm,
        bearing: calculateBearing(origin, point),
        isPlaceDestination: false
      }
    ];
  });
}

function inferSurface(highway?: string): string {
  if (!highway) {
    return "unknown";
  }

  if (highway === "cycleway" || highway === "residential" || highway === "living_street") {
    return "paved";
  }

  return "unknown";
}

function sampleGeometry(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 8) {
    return points;
  }

  const step = Math.max(1, Math.floor(points.length / 6));
  const sampled: RoutePoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    sampled.push(points[index]);
  }

  const lastPoint = points[points.length - 1];

  if (sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }

  return sampled;
}

function selectDiverseEndpoints(
  candidates: EndpointCandidate[],
  maxDistanceKm: number
): EndpointCandidate[] {
  const ranked = [...candidates].sort((left, right) => endpointPriority(right) - endpointPriority(left));
  const selected: EndpointCandidate[] = [];
  const sectorCounts = new Map<number, number>();
  const candidateLimit = getEndpointCandidateLimit(maxDistanceKm);
  const sectorLimit = maxDistanceKm >= 80 ? 4 : 3;
  const minDistanceBetweenCandidatesKm = maxDistanceKm >= 80 ? 0.5 : 0.35;
  const secondaryDistanceBetweenCandidatesKm = maxDistanceKm >= 80 ? 0.3 : 0.2;

  for (const candidate of ranked) {
    const sector = Math.floor(((candidate.bearing + 360) % 360) / 45);
    const count = sectorCounts.get(sector) || 0;

    if (count >= sectorLimit) {
      continue;
    }

    if (
      selected.some(
        (existing) =>
          angleDifference(existing.bearing, candidate.bearing) < 8 &&
          estimateDistanceKm(existing.point, candidate.point) < minDistanceBetweenCandidatesKm
      )
    ) {
      continue;
    }

    selected.push(candidate);
    sectorCounts.set(sector, count + 1);

    if (selected.length === candidateLimit) {
      break;
    }
  }

  if (selected.length < Math.min(8, ranked.length)) {
    for (const candidate of ranked) {
      if (
        selected.some(
          (existing) =>
            angleDifference(existing.bearing, candidate.bearing) < 6 &&
            estimateDistanceKm(existing.point, candidate.point) < secondaryDistanceBetweenCandidatesKm
        )
      ) {
        continue;
      }

      selected.push(candidate);

      if (selected.length === candidateLimit) {
        break;
      }
    }
  }

  return selected;
}

async function buildRoutedCandidates(
  origin: RoutePoint,
  locationLabel: string,
  endpointCandidates: EndpointCandidate[],
  minDistanceKm: number,
  maxDistanceKm: number
): Promise<RoutedCandidate[]> {
  const toleranceKm = Math.max(2, maxDistanceKm * 0.15);
  const routedCandidates: RoutedCandidate[] = [];

  for (let index = 0; index < endpointCandidates.length; index += ROUTE_BUILD_CONCURRENCY) {
    const batch = endpointCandidates.slice(index, index + ROUTE_BUILD_CONCURRENCY);
    const routedBatch = await Promise.all(
      batch.map((candidate) =>
        routeToCandidate(origin, locationLabel, candidate, minDistanceKm, maxDistanceKm, toleranceKm)
      )
    );

    routedCandidates.push(
      ...routedBatch.filter((candidate): candidate is RoutedCandidate => candidate !== null)
    );

    if (hasEnoughRoutedCandidates(routedCandidates)) {
      break;
    }
  }

  return routedCandidates;
}

async function routeToCandidate(
  origin: RoutePoint,
  locationLabel: string,
  candidate: EndpointCandidate,
  minDistanceKm: number,
  maxDistanceKm: number,
  toleranceKm: number
): Promise<RoutedCandidate | null> {
  const minAcceptedKm = Math.max(1, minDistanceKm - ROUTE_MATCH_TOLERANCE_KM);
  const maxAcceptedKm = maxDistanceKm + ROUTE_MATCH_TOLERANCE_KM;
  let currentStraightDistanceKm = candidate.straightDistanceKm;
  let bestCandidate: RoutedCandidate | null = null;
  const attemptCount = candidate.isPlaceDestination ? 2 : ROUTE_SEARCH_ATTEMPTS;

  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    const point =
      attempt === 0
        ? candidate.point
        : projectPoint(origin, candidate.bearing, currentStraightDistanceKm);
    const osrmRoute = await fetchOsrmRoute(origin, point, currentStraightDistanceKm);

    if (!osrmRoute) {
      continue;
    }

    const oneWayDistanceKm = roundToOneDecimal(osrmRoute.distance / 1000);
    const totalDistanceKm = roundToOneDecimal(oneWayDistanceKm * 2);
    const withinRequestedRange =
      totalDistanceKm >= minAcceptedKm && totalDistanceKm <= maxAcceptedKm;
    const distanceGapKm =
      totalDistanceKm < minAcceptedKm
        ? roundToOneDecimal(minAcceptedKm - totalDistanceKm)
        : totalDistanceKm > maxAcceptedKm
          ? roundToOneDecimal(totalDistanceKm - maxAcceptedKm)
          : 0;
    const roundTripPoints = [
      ...osrmRoute.points,
      ...osrmRoute.points.slice(0, -1).reverse()
    ];
    const endLabel = candidate.roadName
      ? candidate.isPlaceDestination
        ? candidate.roadName
        : `Vendepunkt ved ${candidate.roadName}`
      : `Vendepunkt ca. ${oneWayDistanceKm} km fra start`;
    const routedCandidate: RoutedCandidate = {
      surface: candidate.surface,
      highway: candidate.highway,
      endPoint: point,
      bearing: candidate.bearing,
      withinRequestedRange,
      distanceGapKm,
      route: {
        id: "",
        shortName: "",
        description: `${formatRoadDescription(candidate.highway, candidate.surface)} tur/retur`,
        distanceKm: totalDistanceKm,
        oneWayDistanceKm,
        isRoundTrip: true,
        startLabel: locationLabel,
        endLabel,
        points: roundTripPoints
      }
    };

    if (
      !bestCandidate ||
      routedCandidate.distanceGapKm < bestCandidate.distanceGapKm
    ) {
      bestCandidate = routedCandidate;
    }

    if (withinRequestedRange) {
      return routedCandidate;
    }

    const desiredTotalDistanceKm = totalDistanceKm < minAcceptedKm ? minDistanceKm : maxDistanceKm;
    const ratio = desiredTotalDistanceKm / Math.max(totalDistanceKm, 1);

    currentStraightDistanceKm = clamp(
      roundToOneDecimal(currentStraightDistanceKm * ratio),
      1,
      Math.max(1.5, maxDistanceKm * 0.7)
    );
  }

  if (bestCandidate && bestCandidate.distanceGapKm <= toleranceKm) {
    return bestCandidate;
  }

  return null;
}

async function fetchOsrmRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  straightDistanceKm: number
): Promise<{ distance: number; points: RoutePoint[] } | null> {
  for (const profile of OSRM_PROFILES) {
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${origin.lon},${origin.lat};${destination.lon},${destination.lat}` +
      `?overview=full&geometries=geojson&steps=false&alternatives=false`;

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": process.env.MET_USER_AGENT || "RideSense/1.0"
        },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(getOsrmFetchTimeoutMs(straightDistanceKm))
      });
    } catch {
      continue;
    }

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as OsrmResponse;
    const bestRoute = payload.routes?.[0];

    if (!bestRoute?.geometry?.coordinates || bestRoute.geometry.coordinates.length < 2) {
      continue;
    }

    return {
      distance: bestRoute.distance,
      points: bestRoute.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }))
    };
  }

  return null;
}

async function fetchFirstAvailableOverpassResult(query: string): Promise<OverpassWay[]> {
  try {
    return await Promise.any(
      OVERPASS_ENDPOINTS.map((endpoint) => fetchOverpassFromEndpoint(endpoint, query))
    );
  } catch {
    return [];
  }
}

async function fetchOverpassFromEndpoint(
  endpoint: string,
  query: string
): Promise<OverpassWay[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent":
        process.env.OVERPASS_USER_AGENT || process.env.GEOCODE_USER_AGENT || "RideSense/1.0"
    },
    body: new URLSearchParams({ data: query }).toString(),
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Overpass svarte med ${response.status}`);
  }

  const payload = (await response.json()) as { elements?: OverpassWay[] };
  const elements = payload.elements || [];

  if (elements.length === 0) {
    throw new Error("Ingen veidata fra endepunktet.");
  }

  return elements;
}

function chooseBestRoutes(
  routedCandidates: RoutedCandidate[],
  minDistanceKm: number,
  maxDistanceKm: number
): RoutedCandidate[] {
  const targetDistances = buildTargetDistances(minDistanceKm, maxDistanceKm);
  const inRangeCandidates = routedCandidates.filter((candidate) => candidate.withinRequestedRange);
  const chosen: RoutedCandidate[] = [];

  for (const [index, profile] of (ROUTE_PROFILES as RouteProfile[]).entries()) {
    const targetDistanceKm = targetDistances[index] ?? targetDistances[targetDistances.length - 1];
    const selected = inRangeCandidates
      .filter((candidate) => chosen.every((existing) => areDistinctRoutes(existing, candidate)))
      .sort((left, right) => routePriority(right, targetDistanceKm) - routePriority(left, targetDistanceKm))[0];

    if (!selected) {
      continue;
    }

    chosen.push({
      ...selected,
      route: {
        ...selected.route,
        id: profile.id,
        shortName: profile.shortName
      }
    });
  }

  return chosen;
}

async function analyzeRoute(route: Route): Promise<RouteAnalysis> {
  const samples = sampleRoutePoints(route, ROUTE_SAMPLE_COUNT);
  const sampledPoints = await Promise.all(
    samples.map(async (sample) => {
      const forecast = await fetchForecastForLocation(
        sample.lat,
        sample.lon,
        `${route.shortName} ${sample.label}`
      );
      const currentHour = forecast.hours[0];

      if (!currentHour) {
        throw new Error("Fant ikke nok værdata for ruteanalyse.");
      }

      return {
        sample,
        weather: currentHour
      };
    })
  );

  return {
    route,
    sampledPoints,
    summary: calculateRouteScore(sampledPoints.map((point) => point.weather))
  };
}

function sampleRoutePoints(route: Route, sampleCount: number): RouteSamplePoint[] {
  const segments = route.points.slice(0, -1).map((point, index) => ({
    start: point,
    end: route.points[index + 1],
    distance: estimateDistanceKm(point, route.points[index + 1])
  }));
  const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);

  if (totalDistance === 0) {
    return route.points.slice(0, sampleCount).map((point, index) => ({
      ...point,
      index,
      label: pointLabel(index, sampleCount)
    }));
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const targetDistance = sampleCount === 1 ? 0 : (totalDistance * index) / (sampleCount - 1);
    let walked = 0;

    for (const segment of segments) {
      const nextWalked = walked + segment.distance;

      if (targetDistance <= nextWalked || segment === segments[segments.length - 1]) {
        const offset = segment.distance === 0 ? 0 : (targetDistance - walked) / segment.distance;

        return {
          lat: segment.start.lat + (segment.end.lat - segment.start.lat) * offset,
          lon: segment.start.lon + (segment.end.lon - segment.start.lon) * offset,
          index,
          label: pointLabel(index, sampleCount)
        };
      }

      walked = nextWalked;
    }

    const lastPoint = route.points[route.points.length - 1];

    return {
      ...lastPoint,
      index,
      label: pointLabel(index, sampleCount)
    };
  });
}

function buildTargetDistances(minDistanceKm: number, maxDistanceKm: number): number[] {
  if (Math.abs(maxDistanceKm - minDistanceKm) < 1) {
    return [minDistanceKm, roundToOneDecimal((minDistanceKm + maxDistanceKm) / 2), maxDistanceKm];
  }

  return [
    minDistanceKm,
    roundToOneDecimal((minDistanceKm + maxDistanceKm) / 2),
    maxDistanceKm
  ];
}

function endpointPriority(candidate: EndpointCandidate): number {
  const destinationScore = candidate.isPlaceDestination ? 45 : 0;
  const surfaceScore = candidate.surface === "asphalt" ? 60 : 20;
  const highwayScore =
    candidate.highway === "cycleway"
      ? 16
      : candidate.highway === "residential" || candidate.highway === "living_street"
        ? 12
        : 8;

  return destinationScore + surfaceScore + highwayScore + candidate.straightDistanceKm;
}

function routePriority(candidate: RoutedCandidate, targetDistanceKm: number): number {
  const surfaceScore = candidate.surface === "asphalt" ? 50 : 20;
  const highwayScore =
    candidate.highway === "cycleway"
      ? 16
      : candidate.highway === "residential" || candidate.highway === "living_street"
        ? 12
        : 8;
  const distancePenalty = Math.abs(candidate.route.distanceKm - targetDistanceKm) * 10;

  return 100 + surfaceScore + highwayScore - distancePenalty;
}

function areDistinctRoutes(left: RoutedCandidate, right: RoutedCandidate): boolean {
  return (
    angleDifference(left.bearing, right.bearing) >= 25 ||
    estimateDistanceKm(left.endPoint, right.endPoint) >= 0.8
  );
}

function normalizeGeometry(points?: RoutePoint[]): RoutePoint[] | null {
  if (!points || points.length < 2) {
    return null;
  }

  return points.map((point) => ({
    lat: point.lat,
    lon: point.lon
  }));
}

function formatRoadDescription(highway: string, surface: string): string {
  const roadLabel =
    highway === "cycleway"
      ? "Sykkelvei"
      : highway === "residential" || highway === "living_street"
        ? "Lokalvei"
        : "Veistrekning";
  const surfaceLabel = surface === "asphalt" ? "asfalt" : "hardt dekke";

  return `${roadLabel} med ${surfaceLabel}`;
}

function projectPoint(origin: RoutePoint, bearingDegrees: number, distanceKm: number): RoutePoint {
  const earthRadiusKm = 6371;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lon1 = (origin.lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI
  };
}

function mergeEndpointCandidates(
  limit: number,
  ...candidateGroups: EndpointCandidate[][]
): EndpointCandidate[] {
  const merged: EndpointCandidate[] = [];

  for (const group of candidateGroups) {
    for (const candidate of group) {
      if (merged.length >= limit) {
        return merged;
      }

      if (merged.some((existing) => estimateDistanceKm(existing.point, candidate.point) < 0.35)) {
        continue;
      }

      merged.push(candidate);
    }
  }

  return merged;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getOsrmFetchTimeoutMs(straightDistanceKm: number): number {
  return Math.min(12000, Math.max(OSRM_FETCH_TIMEOUT_MS, 3500 + straightDistanceKm * 90));
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function getEndpointCandidateLimit(maxDistanceKm: number): number {
  return maxDistanceKm >= 80 ? 18 : BASE_MAX_ENDPOINT_CANDIDATES;
}

function hasEnoughRoutedCandidates(candidates: RoutedCandidate[]): boolean {
  const inRange = candidates.filter((candidate) => candidate.withinRequestedRange);

  if (inRange.length < DESIRED_ROUTED_CANDIDATES) {
    return false;
  }

  const distinctBearings = new Set(inRange.map((candidate) => Math.round(candidate.bearing / 20)));
  return distinctBearings.size >= 3;
}

async function fetchGeonorgePlacesNearPoint(point: RoutePoint): Promise<GeonorgePlaceResult[]> {
  const params = new URLSearchParams({
    ost: String(point.lon),
    nord: String(point.lat),
    radius: "5000",
    koordsys: "4326",
    treffPerSide: "12",
    side: "1"
  });

  try {
    const response = await fetch(`${GEONORGE_PLACE_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(GEONORGE_PLACE_FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as GeonorgePlaceResponse;

    return (payload.navn || []).filter((item) => isRelevantPlaceType(item.navneobjekttype));
  } catch {
    return [];
  }
}

function toGeonorgePlaceEndpointCandidate(
  place: GeonorgePlaceResult,
  origin: RoutePoint
): EndpointCandidate | null {
  const lat = place.representasjonspunkt?.nord;
  const lon = place.representasjonspunkt?.øst;
  const name = place.stedsnavn?.[0]?.skrivemåte;

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const point: RoutePoint = { lat: Number(lat), lon: Number(lon) };

  return {
    point,
    surface: "paved",
    highway: "regional",
    roadName: name,
    straightDistanceKm: estimateDistanceKm(origin, point),
    bearing: calculateBearing(origin, point),
    isPlaceDestination: true
  };
}

function isRelevantPlaceType(placeType?: string): boolean {
  return ["By", "Tettsted", "Bygd", "Grend", "Bydel"].includes(placeType || "");
}

function distanceToRange(value: number, min: number, max: number): number {
  if (value < min) {
    return min - value;
  }

  if (value > max) {
    return value - max;
  }

  return 0;
}

function explainBestRoute(bestRoute: RouteAnalysis, routes: RouteAnalysis[]): string {
  const competingRoutes = routes.filter((route) => route.route.id !== bestRoute.route.id);

  if (competingRoutes.length === 0) {
    return `${bestRoute.route.shortName} er best nå fordi forholdene er stabile langs ruten.`;
  }

  const averageWind =
    competingRoutes.reduce((sum, route) => sum + route.summary.averageWindSpeed, 0) /
    competingRoutes.length;
  const averageRain =
    competingRoutes.reduce((sum, route) => sum + route.summary.averagePrecipitation, 0) /
    competingRoutes.length;
  const reasons: string[] = [];

  if (bestRoute.summary.averageWindSpeed <= averageWind - 0.5) {
    reasons.push("mindre vind");
  }

  if (bestRoute.summary.averagePrecipitation <= averageRain - 0.1) {
    reasons.push("mindre risiko for nedbør");
  }

  if (reasons.length === 0) {
    return `${bestRoute.route.shortName} er best nå fordi forholdene er jevnest totalt sett.`;
  }

  if (reasons.length === 1) {
    return `${bestRoute.route.shortName} er best nå på grunn av ${reasons[0]}.`;
  }

  return `${bestRoute.route.shortName} er best nå på grunn av ${reasons[0]} og ${reasons[1]}.`;
}

function pointLabel(index: number, sampleCount: number): string {
  if (index === 0) {
    return "Start";
  }

  if (index === sampleCount - 1) {
    return "Retur";
  }

  return `Punkt ${index + 1}`;
}

function calculateBearing(start: RoutePoint, end: RoutePoint): number {
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const dLon = ((end.lon - start.lon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

function angleDifference(left: number, right: number): number {
  const diff = Math.abs(left - right) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function estimateDistanceKm(start: RoutePoint, end: RoutePoint): number {
  const avgLatRadians = (((start.lat + end.lat) / 2) * Math.PI) / 180;
  const latKm = (end.lat - start.lat) * 111.32;
  const lonKm = (end.lon - start.lon) * 111.32 * Math.cos(avgLatRadians);

  return Math.sqrt(latKm ** 2 + lonKm ** 2);
}

function buildFallbackRoutePoints(
  start: RoutePoint,
  stop: RoutePoint,
  segments = 24
): RoutePoint[] {
  if (segments < 1) {
    return [start, stop];
  }

  return Array.from({ length: segments + 1 }, (_, index) => {
    const progress = index / segments;
    return {
      lat: start.lat + (stop.lat - start.lat) * progress,
      lon: start.lon + (stop.lon - start.lon) * progress
    };
  });
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

interface RouteDirectionSegment {
  headingDegrees: number;
  weight: number;
  sampleIndex: number;
}

function findNearestSampleIndex(point: RoutePoint, sampledPoints: RoutePoint[]): number {
  if (sampledPoints.length === 0) {
    return 0;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  sampledPoints.forEach((samplePoint, index) => {
    const distance = estimateDistanceKm(point, samplePoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function buildRouteDirectionSegments(
  routePoints: RoutePoint[],
  sampledPoints: RoutePoint[]
): RouteDirectionSegment[] {
  if (routePoints.length < 2 || sampledPoints.length === 0) {
    return [];
  }

  const segments = routePoints
    .slice(0, -1)
    .map((point, index) => {
      const nextPoint = routePoints[index + 1];
      const distance = estimateDistanceKm(point, nextPoint);

      if (distance <= 0) {
        return null;
      }

      const midpoint: RoutePoint = {
        lat: (point.lat + nextPoint.lat) / 2,
        lon: (point.lon + nextPoint.lon) / 2
      };

      return {
        headingDegrees: (calculateBearing(point, nextPoint) + 360) % 360,
        distance,
        sampleIndex: findNearestSampleIndex(midpoint, sampledPoints)
      };
    })
    .filter((segment): segment is { headingDegrees: number; distance: number; sampleIndex: number } =>
      Boolean(segment)
    );

  const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);

  if (totalDistance <= 0) {
    return [];
  }

  return segments.map((segment) => ({
    headingDegrees: segment.headingDegrees,
    sampleIndex: segment.sampleIndex,
    weight: segment.distance / totalDistance
  }));
}

function getTailwindComponentMs(
  windSpeed: number,
  windFromDirection: number | undefined,
  travelHeadingDegrees: number
): number {
  if (!Number.isFinite(windSpeed) || !Number.isFinite(windFromDirection)) {
    return 0;
  }

  const windTowards = ((windFromDirection as number) + 180) % 360;
  const diff = ((windTowards - travelHeadingDegrees + 540) % 360) - 180;
  const radians = (diff * Math.PI) / 180;

  return windSpeed * Math.cos(radians);
}

function scoreLabelFromScore(score: number): "good" | "ok" | "bad" {
  if (score >= 75) {
    return "good";
  }

  if (score >= 50) {
    return "ok";
  }

  return "bad";
}

function averageDirectionDegrees(directions: number[]): number | undefined {
  if (directions.length === 0) {
    return undefined;
  }

  const vector = directions.reduce(
    (acc, direction) => {
      const radians = (direction * Math.PI) / 180;
      return {
        x: acc.x + Math.cos(radians),
        y: acc.y + Math.sin(radians)
      };
    },
    { x: 0, y: 0 }
  );

  if (Math.abs(vector.x) < 1e-6 && Math.abs(vector.y) < 1e-6) {
    return undefined;
  }

  return (((Math.atan2(vector.y, vector.x) * 180) / Math.PI) + 360) % 360;
}

function mostFrequentSymbolCode(symbolCodes: Array<string | undefined>): string | undefined {
  const counts = new Map<string, number>();

  symbolCodes.forEach((symbolCode) => {
    if (!symbolCode) {
      return;
    }

    counts.set(symbolCode, (counts.get(symbolCode) || 0) + 1);
  });

  let bestSymbol: string | undefined;
  let bestCount = -1;
  counts.forEach((count, symbolCode) => {
    if (count > bestCount) {
      bestCount = count;
      bestSymbol = symbolCode;
    }
  });

  return bestSymbol;
}

function buildRouteWeatherHour(
  hours: Awaited<ReturnType<typeof fetchForecastForLocation>>["hours"],
  routeDirectionSegments: RouteDirectionSegment[]
): RouteWindHour {
  const selectedHours = hours.filter((hour) => Boolean(hour));
  const avgScore = selectedHours.reduce((sum, hour) => sum + hour.score, 0) / selectedHours.length;
  const avgWind = selectedHours.reduce((sum, hour) => sum + hour.windSpeed, 0) / selectedHours.length;
  const avgRain =
    selectedHours.reduce((sum, hour) => sum + hour.precipitationAmount, 0) / selectedHours.length;
  const avgTemp =
    selectedHours.reduce((sum, hour) => sum + hour.airTemperature, 0) / selectedHours.length;
  const avgCloudCover =
    selectedHours.reduce((sum, hour) => sum + hour.cloudCoverPercent, 0) / selectedHours.length;
  const avgWindGustSamples = selectedHours.filter((hour) => Number.isFinite(hour.windGust));
  const avgWindGust =
    avgWindGustSamples.length > 0
      ? avgWindGustSamples.reduce((sum, hour) => sum + (hour.windGust || 0), 0) /
        avgWindGustSamples.length
      : undefined;
  const avgWindDirection = averageDirectionDegrees(
    selectedHours
      .map((hour) => hour.windFromDirection)
      .filter((direction): direction is number => Number.isFinite(direction))
  );
  const representativeSymbol = mostFrequentSymbolCode(
    selectedHours.map((hour) => hour.symbolCode)
  );
  const avgTailwind =
    routeDirectionSegments.length > 0
      ? routeDirectionSegments.reduce((sum, segment) => {
          const segmentHour = selectedHours[segment.sampleIndex] || selectedHours[0];
          const segmentTailwind = getTailwindComponentMs(
            segmentHour.windSpeed,
            segmentHour.windFromDirection,
            segment.headingDegrees
          );

          return sum + segmentTailwind * segment.weight;
        }, 0)
      : 0;

  const tailwindBonus = Math.max(-6, Math.min(8, avgTailwind * 2));
  const finalScore = Math.max(0, Math.min(100, Math.round(avgScore + tailwindBonus)));

  return {
    time: selectedHours[0].time,
    score: finalScore,
    scoreLabel: scoreLabelFromScore(finalScore),
    windSpeed: roundToOneDecimal(avgWind),
    cloudCoverPercent: roundToOneDecimal(avgCloudCover),
    symbolCode: representativeSymbol,
    windFromDirection:
      avgWindDirection !== undefined ? roundToOneDecimal(avgWindDirection) : undefined,
    windGust: avgWindGust !== undefined ? roundToOneDecimal(avgWindGust) : undefined,
    precipitationAmount: roundToOneDecimal(avgRain),
    airTemperature: roundToOneDecimal(avgTemp),
    tailwindMs: roundToOneDecimal(avgTailwind)
  };
}

function getNextHourTimestamp(nowMs: number): number {
  const oneHourMs = 60 * 60 * 1000;
  return Math.floor(nowMs / oneHourMs) * oneHourMs + oneHourMs;
}

function buildBestWindow(
  hours: RouteWindHour[],
  analysisRunMs: number,
  maxHoursAhead: number
): { startTime: string; endTime: string; averageScore: number; explanation: string } | null {
  const nextHourTs = getNextHourTimestamp(analysisRunMs);
  const upperBoundTs = nextHourTs + maxHoursAhead * 60 * 60 * 1000;
  const relevantHours = hours.filter((hour) => {
    const ts = new Date(hour.time).getTime();
    return ts >= nextHourTs && ts < upperBoundTs;
  });

  if (relevantHours.length === 0) {
    return null;
  }

  const windowSize = Math.min(3, relevantHours.length);
  let rollingSum = 0;
  let bestAverage = -1;
  let bestStart = 0;

  for (let index = 0; index < relevantHours.length; index += 1) {
    rollingSum += relevantHours[index].score;

    if (index >= windowSize) {
      rollingSum -= relevantHours[index - windowSize].score;
    }

    if (index >= windowSize - 1) {
      const average = rollingSum / windowSize;
      if (average > bestAverage) {
        bestAverage = average;
        bestStart = index - windowSize + 1;
      }
    }
  }

  const bestSegment = relevantHours.slice(bestStart, bestStart + windowSize);

  return {
    startTime: bestSegment[0].time,
    endTime: bestSegment[bestSegment.length - 1].time,
    averageScore: Math.round(bestAverage),
    explanation: "Beste tidsvindu for valgt rute, inkludert medvind langs traseen."
  };
}

async function fetchDirectedRoute(
  start: RoutePoint,
  stop: RoutePoint
): Promise<{ distanceKm: number; points: RoutePoint[] } | null> {
  const straightDistanceKm = Math.max(0.1, estimateDistanceKm(start, stop));

  for (const profile of OSRM_PROFILES) {
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${start.lon},${start.lat};${stop.lon},${stop.lat}` +
      `?overview=full&geometries=geojson&steps=false&alternatives=false`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": process.env.MET_USER_AGENT || "RideSense/1.0"
        },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(getOsrmFetchTimeoutMs(straightDistanceKm))
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as OsrmResponse;
      const bestRoute = payload.routes?.[0];

      if (!bestRoute?.geometry?.coordinates || bestRoute.geometry.coordinates.length < 2) {
        continue;
      }

      return {
        distanceKm: roundToOneDecimal(bestRoute.distance / 1000),
        points: bestRoute.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }))
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function analyzeUserRoute(
  start: RoutePoint,
  stop: RoutePoint,
  startLabel: string,
  stopLabel: string
): Promise<RouteTimeAnalysisResponse> {
  const outboundRoute = await fetchDirectedRoute(start, stop);
  const hasOutboundRoute = Boolean(outboundRoute);
  const fallbackOutboundDistanceKm = roundToOneDecimal(estimateDistanceKm(start, stop));
  const outboundPoints = outboundRoute?.points || buildFallbackRoutePoints(start, stop);
  const outboundDistanceKm = outboundRoute?.distanceKm || fallbackOutboundDistanceKm;

  const returnRoute = await fetchDirectedRoute(stop, start);
  const hasReturnRoute = Boolean(returnRoute);
  const roundTripPoints =
    hasOutboundRoute && hasReturnRoute
      ? [...outboundPoints, ...(returnRoute?.points.slice(1) || [])]
      : outboundPoints;
  const totalRoundTripDistanceKm = roundToOneDecimal(
    outboundDistanceKm + (returnRoute?.distanceKm || 0)
  );
  const route: Route = {
    id: "brukervalg",
    shortName: "Valgt rute",
    description: hasOutboundRoute
      ? hasReturnRoute
        ? "Tur/retur langs vei mellom valgt start og stopp"
        : "Enveisrute langs vei (returrute ikke tilgjengelig akkurat nå)"
      : "Forenklet enveisrute (karttjeneste utilgjengelig akkurat nå)",
    distanceKm: hasOutboundRoute && hasReturnRoute ? totalRoundTripDistanceKm : outboundDistanceKm,
    oneWayDistanceKm: outboundDistanceKm,
    isRoundTrip: hasOutboundRoute && hasReturnRoute,
    startLabel,
    endLabel: stopLabel,
    points: roundTripPoints
  };

  const sampledPoints = sampleRoutePoints(route, ROUTE_SAMPLE_COUNT);
  const forecasts = await Promise.all(
    sampledPoints.map((point, index) =>
      fetchForecastForLocation(point.lat, point.lon, `Rute punkt ${index + 1}`)
    )
  );

  const hourCount = Math.min(...forecasts.map((forecast) => forecast.hours.length));

  if (hourCount === 0) {
    throw new Error("Fant ikke nok værdata for ruten.");
  }

  const routeDirectionSegments = buildRouteDirectionSegments(route.points, sampledPoints);
  const routeHours: RouteWindHour[] = Array.from({ length: hourCount }, (_, hourIndex) => {
    const hourlySamples = forecasts.map((forecast) => forecast.hours[hourIndex]);
    return buildRouteWeatherHour(hourlySamples, routeDirectionSegments);
  });

  const analysisRunMs = Date.now();

  return {
    analyzedAt: new Date(analysisRunMs).toISOString(),
    route,
    sampledPoints,
    hours: routeHours,
    bestWindowNext24h: buildBestWindow(routeHours, analysisRunMs, 24),
    bestWindowNext7d: buildBestWindow(routeHours, analysisRunMs, 24 * 7)
  };
}
