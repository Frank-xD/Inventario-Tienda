# syntax=docker/dockerfile:1
# Se construye con el contexto en la raíz del monorepo:
#   docker build -f apps/frontend/Dockerfile .

FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@12.18.0
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- Dependencias ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

# ---------- Desarrollo (hot reload con el código montado como volumen) ----------
FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------- Build ----------
FROM deps AS build
# NEXT_PUBLIC_* se incrusta en el bundle durante el build.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/frontend apps/frontend
WORKDIR /app/apps/frontend
RUN pnpm build

# ---------- Producción ----------
FROM node:22-bookworm-slim AS prod
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
