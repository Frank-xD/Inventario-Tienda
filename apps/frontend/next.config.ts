import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera .next/standalone para la imagen Docker de producción.
  output: "standalone",
  // En desarrollo, permite abrir la app por los túneles de VS Code (pestaña Ports).
  allowedDevOrigins: ["*.devtunnels.ms"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
