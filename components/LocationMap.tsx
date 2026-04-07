"use client";

import { useEffect, useRef } from "react";

interface LocationMapProps {
  lat: number;
  lon: number;
  label: string;
  onMarkerMoved: (lat: number, lon: number) => void;
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => void;
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

type LeafletGlobal = {
  map: (element: HTMLDivElement) => LeafletMap;
  tileLayer: (
    urlTemplate: string,
    options: {
      maxZoom: number;
      attribution: string;
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

export function LocationMap({ lat, lon, label, onMarkerMoved }: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

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
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap-bidragsytere"
      }).addTo(map);

      const icon = window.L.divIcon({
        className: "ridesense-map-pin",
        html: '<span class="ridesense-map-pin-dot"></span>',
        iconSize: [20, 20]
      });

      const marker = window.L.marker([lat, lon], { draggable: true, icon });
      marker.addTo(map);
      marker.bindPopup(label).openPopup();
      marker.on("dragend", () => {
        const nextPosition = marker.getLatLng();
        onMarkerMoved(nextPosition.lat, nextPosition.lng);
      });
      markerRef.current = marker;

      map.setView([lat, lon], 12);
    }

    initializeMap();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [onMarkerMoved]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) {
      return;
    }

    mapRef.current.setView([lat, lon], 12);
    markerRef.current.setLatLng([lat, lon]);
    markerRef.current.bindPopup(label).openPopup();
  }, [lat, lon, label]);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Kart</h3>
      <p className="mt-1 text-sm text-slate-600">
        Dra markøren for å oppdatere vær og sykkelscore for ny posisjon.
      </p>
      <div ref={mapContainerRef} className="mt-3 h-72 w-full overflow-hidden rounded-lg md:h-96" />
    </section>
  );
}
