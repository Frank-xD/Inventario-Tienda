# Inventario Tienda

Sistema de gestión para una tienda de barrio: catálogo, inventario, compras, ventas (POS), caja,
vencimientos, anuncios y un catálogo público con disponibilidad en tiempo real.

## Stack

| Capa | Tecnología | Uso |
|---|---|---|
| Backend | NestJS 12 | API organizada en módulos (`apps/backend`) |
| Lenguaje | TypeScript | El mismo en frontend y backend |
| Base de datos | PostgreSQL 17 | Relaciones, transacciones y consistencia |
| ORM | Prisma 7 | Cliente tipado, migraciones y consultas (incluye vistas) |
| Validación | zod | Validación de entradas con `StandardSchemaValidationPipe` de NestJS |
| Tiempo real | Socket.IO (`@nestjs/websockets`) | Namespace `/tienda`: stock, ventas, caja y anuncios |
| Frontend | Next.js 16 + React 19 | `apps/frontend` |
| Diseño | Tailwind CSS 4 + shadcn/ui | Componentes en `apps/frontend/components/ui` |
| Gráficos | Recharts | Estadísticas del dashboard |
| Despliegue | Docker + Docker Compose | Entorno de desarrollo y de producción |
| Monorepo | pnpm workspaces | Un único `pnpm-lock.yaml` en la raíz |

## Modelo de datos

El esquema está en [`docs/tienda_schema.sql`](docs/tienda_schema.sql) y se aplica como migración inicial
(`apps/backend/prisma/migrations/20261110000000_init`). Cubre catálogo, proveedores, compras, ventas (POS),
caja con arqueo, lotes con fecha de vencimiento, anuncios y vistas para el portal público.

Reglas importantes (las garantiza la base de datos, no solo la API):

- **El stock no es una columna**: es la suma de `movimientos_inventario` (vista `v_stock`). Nunca se edita a mano;
  se registran compras, ventas, ajustes (con motivo) o mermas.
- **Triggers**: cada línea de compra suma stock, actualiza el costo del producto, recalcula el total y crea el lote
  si trae vencimiento; cada línea de venta resta stock; anular una venta devuelve el stock.
- **Una sola caja abierta** a la vez (índice único parcial). Vender requiere una caja abierta.
- Zona horaria de la tienda: `America/La_Paz`. Moneda: bolivianos (Bs).

`prisma/schema.prisma` describe esas tablas y vistas para el cliente de Prisma con nombres en camelCase
(`@map` a las columnas en español). Los CHECK, triggers y vistas viven en el SQL.

## Estructura

```
docs/tienda_schema.sql         Esquema de la base de datos (fuente de verdad)
apps/
  backend/                     NestJS + Prisma
    prisma/schema.prisma       Tablas y vistas para Prisma
    prisma/migrations/         Migraciones SQL
    prisma/seed.ts             Datos de ejemplo (14 días de ventas)
    src/common/                Validación (zod), filtro de errores de Postgres, helpers de zona horaria
    src/realtime/              Gateway Socket.IO (namespace /tienda)
    src/catalogo/              Categorías, proveedores y productos
    src/inventario/            Stock, alertas, ajustes, mermas y lotes
    src/compras/               Compras a proveedores
    src/caja/                  Apertura, movimientos y cierre con arqueo
    src/ventas/                POS: ventas y anulaciones
    src/anuncios/              Anuncios
    src/publico/               Portal público (catálogo sin cifras de stock)
    src/reportes/              KPIs y datos para gráficos
  frontend/                    Next.js
    app/page.tsx               Panel de la tienda
    app/catalogo/page.tsx      Catálogo público
    components/ui/             Componentes shadcn/ui
    hooks/use-live-data.ts     Datos que se recargan con eventos de Socket.IO
docker-compose.yml             Desarrollo (hot reload)
docker-compose.prod.yml        Override de producción
```

## Opción A: todo en Docker (recomendado)

Requisitos: Docker y Docker Compose.

```bash
cp .env.example .env              # opcional, ya hay valores por defecto
docker compose up --build
```

| Servicio | URL |
|---|---|
| Panel de la tienda | http://localhost:3000 |
| Catálogo público | http://localhost:3000/catalogo |
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

1. Escribe el cambio en SQL o en `apps/backend/prisma/schema.prisma`.
   Triggers, vistas y CHECK no se pueden expresar en Prisma: créalos con una migración vacía
   (`pnpm --filter backend exec prisma migrate dev --create-only --name ...`) y edita su `migration.sql`.
2. Aplica la migración: `pnpm db:migrate -- --name descripcion_del_cambio`
   (en Docker: `docker compose exec backend pnpm prisma migrate dev --name ...`).
3. Si cambiaste tablas o vistas desde SQL, actualiza `schema.prisma` para que coincida.
   Comprueba que no quedan diferencias con
   `pnpm --filter backend exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
4. El cliente se regenera en `apps/backend/src/generated/prisma` (no se versiona).
5. Explora los datos con `pnpm db:studio`.

## API (`http://localhost:3001/api`)

Las entradas se validan con zod. Los errores de la base de datos (CHECK, únicos, claves foráneas) se devuelven como 400/409 con un mensaje claro.

| Recurso | Endpoints |
|---|---|
| Categorías | `GET /categorias` · `POST /categorias` · `PATCH /categorias/:id` |
| Proveedores | `GET /proveedores` · `GET /proveedores/:id` · `POST /proveedores` · `PATCH /proveedores/:id` |
| Productos | `GET /productos?q=&categoriaId=&proveedorId=` (incluye `stock`) · `GET /productos/:id` · `GET /productos/codigo/:codigoBarras` · `POST /productos` (acepta `stockInicial` y `fechaVencimiento`) · `PATCH /productos/:id` |
| Inventario | `GET /inventario/stock` · `GET /inventario/alertas` · `GET /inventario/movimientos?productoId=&tipo=` · `POST /inventario/ajustes` `{productoId, cantidad (±), motivo}` · `POST /inventario/mermas` `{productoId, cantidad, motivo?}` |
| Lotes | `GET /inventario/lotes?productoId=` · `GET /inventario/lotes/por-vencer` · `POST /inventario/lotes` · `DELETE /inventario/lotes/:id` |
| Compras | `GET /compras?proveedorId=&desde=&hasta=` · `GET /compras/:id` · `POST /compras` `{proveedorId, notas?, detalles: [{productoId, cantidad, costoUnit, fechaVencimiento?}]}` |
| Caja | `GET /cajas/actual` · `GET /cajas` (historial con arqueo) · `GET /cajas/:id` · `POST /cajas/abrir` `{montoInicial}` · `POST /cajas/:id/movimientos` `{tipo: ingreso\|egreso, monto, motivo}` · `POST /cajas/:id/cerrar` `{montoContado}` |
| Ventas | `GET /ventas?desde=&hasta=&cajaId=&estado=` · `GET /ventas/:id` · `POST /ventas` `{metodoPago: efectivo\|transferencia, descuento?, items: [{productoId, cantidad, descuento?}]}` · `POST /ventas/:id/anular` `{motivo}` |
| Anuncios | `GET /anuncios` · `POST /anuncios` · `PATCH /anuncios/:id` · `DELETE /anuncios/:id` |
| Público | `GET /publico/catalogo?q=&categoria=` · `GET /publico/categorias` · `GET /publico/anuncios` |
| Reportes | `GET /reportes/resumen` · `GET /reportes/ventas-diarias?dias=14` · `GET /reportes/ventas-por-producto?orden=unidades\|ingresos\|margen&limite=10` |
| Salud | `GET /health` |

Las fechas de los filtros (`desde`, `hasta`) son días calendario `YYYY-MM-DD` en la hora de La Paz.
Una venta copia el precio y el costo vigentes del producto, y se rechaza si no hay stock suficiente.

### Eventos en tiempo real (Socket.IO, namespace `/tienda`)

Solo llevan identificadores; el cliente vuelve a pedir lo que necesita (así el portal público no recibe cifras de stock).

| Evento | Payload |
|---|---|
| `stock:actualizado` | `{ productoIds }` |
| `producto:actualizado` | `{ productoId }` |
| `venta:registrada` / `venta:anulada` | `{ ventaId }` |
| `caja:actualizada` | `{ cajaId }` |
| `anuncios:actualizados` | `{}` |
| `lotes:actualizados` | `{}` |

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
