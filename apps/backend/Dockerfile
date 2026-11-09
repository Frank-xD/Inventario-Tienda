# syntax=docker/dockerfile:1
# Se construye con el contexto en la raíz del monorepo:
#   docker build -f apps/backend/Dockerfile .

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.18.0
WORKDIR /app

# ---------- Dependencias (workspace filtrado al backend) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/backend/prisma apps/backend/prisma
COPY apps/backend/prisma.config.ts apps/backend/
RUN pnpm install --frozen-lockfile --filter backend...

# ---------- Desarrollo (hot reload con el código montado como volumen) ----------
FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma generate && pnpm prisma migrate deploy && pnpm start:dev"]

# ---------- Build ----------
FROM deps AS build
COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm prisma generate && pnpm build

# ---------- Producción ----------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/apps/backend/prisma /app/apps/backend/prisma
COPY apps/backend/package.json apps/backend/prisma.config.ts /app/apps/backend/
WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
