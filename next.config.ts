import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.met.no",
        pathname: "/images/weathericons/svg/**"
      }
    ]
  }
};

export default nextConfig;
