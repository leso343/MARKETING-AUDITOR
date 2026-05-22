import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "papaparse",
    "bcryptjs",
    "@prisma/client",
    "prisma",
  ],
  outputFileTracingIncludes: {
    "/audit/[client]": ["./public/csvs/**/*", "./data/csvs/**/*"],
  },
};

export default nextConfig;
