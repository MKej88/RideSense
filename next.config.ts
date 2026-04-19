import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.yr.no",
        pathname: "/assets/images/weather-symbols/dark-mode/default/svg/**"
      }
    ]
  }
};

export default nextConfig;
