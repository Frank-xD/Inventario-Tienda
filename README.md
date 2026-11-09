# Inventario Tienda

Sistema de inventario para una tienda, con disponibilidad de productos en tiempo real.

## Stack

| Capa | Tecnología | Uso |
|---|---|---|
| Backend | NestJS 12 | API organizada en módulos (`apps/backend`) |
| Lenguaje | TypeScript | El mismo en frontend y backend |
| Base de datos | PostgreSQL 17 | Relaciones, transacciones y consistencia |
| ORM | Prisma 7 | Modelos (`prisma/schema.prisma`), migraciones y consultas |
| Tiempo real | Socket.IO (`@nestjs/websockets`) | Namespace `/inventory`: cambios de productos y stock |
| Frontend | Next.js 16 + React 19 | `apps/frontend` |
| Diseño | Tailwind CSS 4 + shadcn/ui | Componentes en `apps/frontend/components/ui` |
| Gráficos | Recharts | Estadísticas del dashboard |
| Despliegue | Docker + Docker Compose | Entorno de desarrollo y de producción |
| Monorepo | pnpm workspaces | Un único `pnpm-lock.yaml` en la raíz |

## Estructura

```
apps/
  backend/                  NestJS + Prisma
    prisma/schema.prisma    Modelos: Category, Product, StockMovement
    prisma/migrations/      Migraciones SQL
    prisma/seed.ts          Datos de ejemplo
    src/prisma/             PrismaService (global)
    src/inventory/          Gateway de Socket.IO (eventos en tiempo real)
    src/products/           CRUD de productos + movimientos de stock (transacción)
    src/categories/         Categorías
    src/stats/              Datos agregados para gráficos
    src/health/             Healthcheck (API + base de datos)
  frontend/                 Next.js
    components/ui/          Componentes shadcn/ui
    components/dashboard/   Dashboard (tabla, KPIs y gráfico)
    lib/api.ts              Cliente HTTP
    lib/socket.ts           Cliente Socket.IO
docker-compose.yml          Desarrollo (hot reload)
docker-compose.prod.yml     Override de producción
```

## Opción A: todo en Docker (recomendado)

Requisitos: Docker y Docker Compose.

```bash
cp .env.example .env              # opcional, ya hay valores por defecto
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api |
| Healthcheck | http://localhost:3001/api/health |
| PostgreSQL | `localhost:5432` (usuario `tienda`, contraseña `password`, base `tienda_db`) |

El código de `apps/backend` y `apps/frontend` se monta como volumen, así que los cambios se recargan solos.
Las migraciones se aplican al arrancar el backend. Para cargar datos de ejemplo:

```bash
docker compose exec backend pnpm db:seed
```

Si agregas o cambias dependencias, reconstruye y renueva los volúmenes de `node_modules`:

```bash
docker compose up --build -V
```

## Opción B: PostgreSQL en Docker y apps en local

Requisitos: Node.js 22+, pnpm 12 (`npm i -g pnpm@12.18.0`) y Docker.

```bash
pnpm install                          # instala todo el workspace y genera el cliente de Prisma
pnpm db:up                            # levanta solo PostgreSQL
cp apps/backend/.env.example apps/backend/.env
pnpm db:migrate                       # aplica migraciones
pnpm db:seed                          # datos de ejemplo
pnpm dev:backend                      # API en http://localhost:3001
pnpm dev:frontend                     # Web en http://localhost:3000
```

## Prisma: flujo de trabajo

1. Edita `apps/backend/prisma/schema.prisma`.
2. Crea la migración: `pnpm db:migrate -- --name descripcion_del_cambio`
   (en Docker: `docker compose exec backend pnpm prisma migrate dev --name ...`).
3. El cliente se regenera en `apps/backend/src/generated/prisma` (no se versiona).
4. Explora los datos con `pnpm db:studio`.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/products` | Lista de productos |
| GET | `/api/products/:id` | Detalle con los últimos movimientos |
| POST | `/api/products` | Crear producto |
| PATCH | `/api/products/:id` | Actualizar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| POST | `/api/products/:id/movements` | `{ type: "IN" \| "OUT" \| "ADJUSTMENT", quantity, note? }` |
| GET | `/api/categories` | Categorías con número de productos |
| POST | `/api/categories` | Crear categoría |
| GET | `/api/stats/summary` | KPIs y stock por categoría |
| GET | `/api/health` | Estado de la API y de la base de datos |

### Eventos en tiempo real (Socket.IO, namespace `/inventory`)

`product:created`, `product:updated`, `product:deleted`, `stock:changed`

## shadcn/ui

La configuración está en `apps/frontend/components.json`. Para agregar componentes:

```bash
cd apps/frontend
pnpm dlx shadcn@latest add dialog input select
```

## Producción

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Construye imágenes optimizadas (backend compilado y Next.js `standalone`) sin volúmenes de código.
`NEXT_PUBLIC_API_URL` se incrusta en el build del frontend: defínelo en `.env` con la URL pública de la API.

## Scripts útiles (raíz)

| Script | Acción |
|---|---|
| `pnpm docker:up` / `pnpm docker:down` | Levanta / detiene el entorno Docker |
| `pnpm build` | Compila backend y frontend |
| `pnpm lint` | Lint de todo el workspace |
| `pnpm test` | Tests del backend (Vitest) |
