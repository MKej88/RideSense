"use client";

import { useEffect, useRef } from "react";
import { RoutePoint } from "@/lib/types";

interface LocationMapProps {
  lat: number;
  lon: number;
  label: string;
  onMarkerMoved: (lat: number, lon: number) => void;
  routeName?: string | null;
  routePoints?: RoutePoint[];
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: LeafletBounds, options?: { padding?: [number, number] }) => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => void;
  setLatLng: (latlng: [number, number]) => void;
  bindPopup: (text: string) => LeafletMarker;
  openPopup: () => void;
  on: (eventName: string, callback: () => void) => void;
  getLatLng: () => { lat: number; lng: number };
};

type LeafletBounds = unknown;

type LeafletPolyline = {
  addTo: (map: LeafletMap) => void;
  remove: () => void;
  setLatLngs: (latlngs: [number, number][]) => void;
  bindPopup: (text: string) => LeafletPolyline;
  getBounds: () => LeafletBounds;
};

type LeafletGlobal = {
  map: (element: HTMLDivElement) => LeafletMap;
  tileLayer: (
    urlTemplate: string,
    options: {
      maxZoom: number;
      minZoom?: number;
      attribution: string;
      subdomains?: string;
    }
  ) => {
    addTo: (map: LeafletMap) => void;
  };
  marker: (
    latlng: [number, number],
    options: {
      draggable: boolean;
      icon: unknown;
    }
  ) => LeafletMarker;
  polyline: (
    latlngs: [number, number][],
    options: {
      color: string;
      weight: number;
      opacity: number;
    }
  ) => LeafletPolyline;
  divIcon: (options: { className: string; html: string; iconSize: [number, number] }) => unknown;
};

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

const LEAFLET_SCRIPT_ID = "leaflet-script";
const LEAFLET_STYLE_ID = "leaflet-style";

function ensureLeafletAssets(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve();
      return;
    }

    if (!document.getElementById(LEAFLET_STYLE_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_STYLE_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Kunne ikke laste Leaflet.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_SCRIPT_ID;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Kunne ikke laste Leaflet."));
    document.body.appendChild(script);
  });
}

export function LocationMap({
  lat,
  lon,
  label,
  onMarkerMoved,
  routeName,
  routePoints = []
}: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const routeRef = useRef<LeafletPolyline | null>(null);
  const initialStateRef = useRef({ lat, lon, label });

  useEffect(() => {
    let active = true;

    async function initializeMap(): Promise<void> {
      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      try {
        await ensureLeafletAssets();
      } catch {
        return;
      }

      if (!active || !mapContainerRef.current || !window.L) {
        return;
      }

      const map = window.L.map(mapContainerRef.current);
      mapRef.current = map;

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 0,
        maxZoom: 18,
        subdomains: "abc",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const icon = window.L.divIcon({
        className: "ridesense-map-pin",
        html: '<span class="ridesense-map-pin-dot"></span>',
        iconSize: [20, 20]
      });

      const { lat: initialLat, lon: initialLon, label: initialLabel } = initialStateRef.current;

      const marker = window.L.marker([initialLat, initialLon], { draggable: true, icon });
      marker.addTo(map);
      marker.bindPopup(initialLabel).openPopup();
      marker.on("dragend", () => {
        const nextPosition = marker.getLatLng();
        onMarkerMoved(nextPosition.lat, nextPosition.lng);
      });
      markerRef.current = marker;

      map.setView([initialLat, initialLon], 12);
    }

    initializeMap();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        routeRef.current = null;
      }
    };
  }, [onMarkerMoved]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) {
      return;
    }

    const routeLatLngs = routePoints.map((point) => [point.lat, point.lon] as [number, number]);

    if (window.L && routeLatLngs.length >= 2) {
      if (!routeRef.current) {
        routeRef.current = window.L.polyline(routeLatLngs, {
          color: "#f97316",
          weight: 6,
          opacity: 0.85
        });
        routeRef.current.addTo(mapRef.current);
      } else {
        routeRef.current.setLatLngs(routeLatLngs);
      }

      routeRef.current.bindPopup(routeName || "Valgt rute");
      mapRef.current.fitBounds(routeRef.current.getBounds(), { padding: [36, 36] });
    } else {
      routeRef.current?.remove();
      routeRef.current = null;
      mapRef.current.setView([lat, lon], 12);
    }

    markerRef.current.setLatLng([lat, lon]);
    markerRef.current.bindPopup(label).openPopup();
  }, [lat, lon, label, routeName, routePoints]);

  return (
    <section className="rounded-xl bg-slate-900 p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-100">Kart</h3>
      <p className="mt-1 text-sm text-slate-400">
        Dra markøren for å oppdatere startplass og vær. Når du velger en rute, vises den som en
        tydelig orange linje og kartet sentreres på ruten. Kartbakgrunnen er fra OpenStreetMap.
      </p>
      <div ref={mapContainerRef} className="mt-3 h-72 w-full overflow-hidden rounded-lg md:h-96" />
    </section>
  );
}
