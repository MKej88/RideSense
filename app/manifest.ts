import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RideSense",
    short_name: "RideSense",
    description: "Finn gode tidspunkt og ruter for sykling basert på værdata i Norge.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020b23",
    lang: "nb-NO",
    orientation: "portrait-primary",
    categories: ["sports", "weather", "navigation"],
    icons: [
      {
        src: "/ridesense-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
