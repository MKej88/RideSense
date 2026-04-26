"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

interface LocationMapProps {
  lat: number;
  lon: number;
  label: string;
  onMarkerMoved: (lat: number, lon: number) => void;
}

function LocationMapFallback({
  message,
  details,
  isError = false
}: {
  message: string;
  details: string;
  isError?: boolean;
}): ReactElement {
  return (
    <section className="rounded-xl bg-slate-900 p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-100">Kart</h3>
      <div
        className={`mt-3 flex h-72 w-full items-center justify-center rounded-lg border p-4 text-sm md:h-96 ${
          isError ? "border-red-500/60 bg-red-950/40 text-red-100" : "border-slate-700 bg-slate-800/40 text-slate-300"
        }`}
        role={isError ? "alert" : "status"}
      >
        <div className="max-w-sm text-center">
          <p className="font-semibold">{message}</p>
          <p className="mt-2 text-xs text-slate-300">{details}</p>
        </div>
      </div>
    </section>
  );
}

const LocationMapClient = dynamic(
  () => import("./LocationMapClient").then((module) => module.LocationMapClient),
  {
    ssr: false,
    loading: () => (
      <LocationMapFallback
        message="Laster kart..."
        details="Henter kartkomponent i nettleseren. Dette tar vanligvis bare et øyeblikk."
      />
    )
  }
);

export function LocationMap(props: LocationMapProps): ReactElement {
  return <LocationMapClient {...props} />;
}
