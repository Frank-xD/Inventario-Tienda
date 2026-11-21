import type { NextConfig } from "next";

/**
 * - NEXT_OUTPUT=export: sitio estático en out/ (Cloudflare Pages, ver DEPLOY.md).
 *   Todas las páginas son de cliente, así que se exportan tal cual.
 * - Por defecto: .next/standalone para la imagen Docker de producción.
 */
const exportar = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  output: exportar ? "export" : "standalone",
  // En desarrollo, permite abrir la app por los túneles de VS Code (pestaña Ports).
  allowedDevOrigins: ["*.devtunnels.ms"],
  experimental: {
    agentFeedback: true,
  },
  // PPR/Cache Components necesitan servidor: no se pueden usar al exportar.
  cacheComponents: !exportar,
  partialPrefetching: !exportar,
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
