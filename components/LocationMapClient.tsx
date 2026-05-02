"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

interface LeafletLike {
  map: (element: HTMLDivElement) => LeafletMapLike;
  tileLayer: (
    urlTemplate: string,
    options: {
      minZoom: number;
      maxZoom: number;
      subdomains: string;
      attribution: string;
    }
  ) => { addTo: (map: LeafletMapLike) => void };
  divIcon: (options: {
    className: string;
    html: string;
    iconSize: [number, number];
  }) => LeafletDivIconLike;
  marker: (
    latLng: [number, number],
    options: {
      draggable: boolean;
      icon: LeafletDivIconLike | null;
    }
  ) => LeafletMarkerLike;
}

interface LeafletMapLike {
  setView: (latLng: [number, number], zoom: number) => void;
  remove: () => void;
}

interface LeafletMarkerLike {
  addTo: (map: LeafletMapLike) => void;
  bindPopup: (label: string) => { openPopup: () => void };
  on: (event: string, callback: () => void) => void;
  getLatLng: () => { lat: number; lng: number };
  setLatLng: (latLng: [number, number]) => void;
}

interface LeafletDivIconLike {}

interface LocationMapClientProps {
  lat: number;
  lon: number;
  label: string;
  onMarkerMoved: (lat: number, lon: number) => void;
}

export function LocationMapClient({
  lat,
  lon,
  label,
  onMarkerMoved
}: LocationMapClientProps): ReactElement {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapLike | null>(null);
  const markerRef = useRef<LeafletMarkerLike | null>(null);
  const iconRef = useRef<LeafletDivIconLike | null>(null);
  const onMarkerMovedRef = useRef(onMarkerMoved);
  const initialPositionRef = useRef<[number, number]>([lat, lon]);
  const initialLabelRef = useRef(label);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onMarkerMovedRef.current = onMarkerMoved;
  }, [onMarkerMoved]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const initializeMap = async (): Promise<void> => {
      try {
        const leafletModule = await import("leaflet");
        const leaflet = leafletModule.default as unknown as LeafletLike;

        const map = leaflet.map(mapContainerRef.current as HTMLDivElement);
        mapRef.current = map;

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            minZoom: 0,
            maxZoom: 18,
            subdomains: "abc",
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          })
          .addTo(map);

        if (!iconRef.current) {
          iconRef.current = leaflet.divIcon({
            className: "ridesense-map-pin",
            html: '<span class="ridesense-map-pin-dot"></span>',
            iconSize: [20, 20]
          });
        }

        const marker = leaflet.marker(initialPositionRef.current, {
          draggable: true,
          icon: iconRef.current
        });
        marker.addTo(map);
        marker.bindPopup(initialLabelRef.current).openPopup();
        marker.on("dragend", () => {
          const nextPosition = marker.getLatLng();
          onMarkerMovedRef.current(nextPosition.lat, nextPosition.lng);
        });
        markerRef.current = marker;

        map.setView(initialPositionRef.current, 12);
        setLoadError(null);
      } catch {
        setLoadError(
          "Kartbiblioteket Leaflet mangler. Kjør 'npm install' og start serveren på nytt."
        );
      }
    };

    void initializeMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) {
      return;
    }

    mapRef.current.setView([lat, lon], 12);
    markerRef.current.setLatLng([lat, lon]);
    markerRef.current.bindPopup(label).openPopup();
  }, [lat, lon, label]);

  return (
    <section className="rounded-xl bg-slate-900 p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-100">Kart</h3>
      <p className="mt-1 text-sm text-slate-400">
        Dra markøren for å oppdatere valgt sted og hente ny værprognose. Kartbakgrunnen er fra OpenStreetMap.
      </p>
      {loadError ? (
        <div
          className="mt-3 flex h-72 w-full items-center justify-center rounded-lg border border-red-500/60 bg-red-950/40 p-4 text-center text-sm text-red-100 md:h-96"
          role="alert"
        >
          <p>{loadError}</p>
        </div>
      ) : (
        <div ref={mapContainerRef} className="mt-3 h-72 w-full overflow-hidden rounded-lg md:h-96" />
      )}
    </section>
  );
}
