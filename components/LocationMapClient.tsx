"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { DivIcon, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const iconRef = useRef<DivIcon | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    try {
      const map = L.map(mapContainerRef.current);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 0,
        maxZoom: 18,
        subdomains: "abc",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      if (!iconRef.current) {
        iconRef.current = L.divIcon({
          className: "ridesense-map-pin",
          html: '<span class="ridesense-map-pin-dot"></span>',
          iconSize: [20, 20]
        });
      }

      const marker = L.marker([lat, lon], { draggable: true, icon: iconRef.current });
      marker.addTo(map);
      marker.bindPopup(label).openPopup();
      marker.on("dragend", () => {
        const nextPosition = marker.getLatLng();
        onMarkerMoved(nextPosition.lat, nextPosition.lng);
      });
      markerRef.current = marker;

      map.setView([lat, lon], 12);
      setLoadError(null);
    } catch {
      setLoadError(
        "Kartet kunne ikke startes. Last siden på nytt, eller prøv igjen senere."
      );
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [lat, lon, label, onMarkerMoved]);

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
