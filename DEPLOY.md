# Despliegue gratuito: Cloudflare Pages + Render + Supabase

Guía para publicar Mi Tiendita en internet sin costo y activa las 24 horas.

| Parte | Servicio | Plan |
|---|---|---|
| Frontend (Next.js como sitio estático) | **Cloudflare Pages** | Gratis, siempre activo |
| API (NestJS + Socket.IO) | **Render** | Gratis (750 h/mes) + "despertador" |
| Base de datos (PostgreSQL) | **Supabase** | Gratis (500 MB) |
| Despertador de la API | **cron-job.org** | Gratis |
| Respaldo diario cifrado | **GitHub Actions** | Gratis |

```
Navegador ──HTTPS──▶ Cloudflare Pages (https://….pages.dev)   páginas estáticas
    │
    └──HTTPS / WebSocket──▶ Render (https://tiendita-api.onrender.com)   API
                                   │
                                   └──SSL──▶ Supabase (Postgres, N. Virginia)
cron-job.org ──cada 10 min──▶ Render /api   (evita que se duerma)
GitHub Actions ──cada día──▶ Supabase → respaldo cifrado
```

> **Orden importante:** Supabase → Render → Cloudflare → volver a Render (CORS) → cron-job.org → respaldos.
> Render necesita la URL de Cloudflare y Cloudflare la de Render; por eso Render se configura dos veces.

---

## 0. Antes de empezar

- Las cuentas de Render y Cloudflare se crean con **GitHub** y necesitan acceso al repositorio
  `Frank-xD/Inventario-Tienda`. Instalar sus apps de GitHub en el repositorio y crear los secretos
  de los respaldos requiere ser **dueño o administrador** del repositorio (o hacerlo desde un fork propio).
- Ten a mano un gestor de contraseñas o un lugar seguro: vas a generar 3 contraseñas
  (base de datos, acceso al sistema y cifrado de respaldos).
- **Nunca** subas contraseñas ni cadenas de conexión al repositorio: es público. Van solo en los
  paneles de Render, Cloudflare y GitHub.

---

## 1. Supabase: base de datos

1. Entra a <https://supabase.com> → **Start your project** → inicia sesión con GitHub.
2. **New project**:
   - **Name:** `mi-tiendita`
   - **Database Password:** pulsa **Generate a password** y guárdala.
   - **Region:** **East US (North Virginia)** — la misma región que Render.
   - Plan **Free** → **Create new project** (tarda 1–2 minutos).
3. Copia la cadena de conexión: botón **Connect** (arriba) → pestaña **Connection String** →
   **Session pooler** (no "Direct connection": Render solo tiene IPv4).
   Se ve así:
   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
4. Reemplaza `[YOUR-PASSWORD]` por la contraseña del paso 2 y **agrega `?sslmode=require` al final**:
   ```
   postgresql://postgres.abcdefghijkl:TU_CONTRASEÑA@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   Esta es tu **`DATABASE_URL`**. Si la contraseña tiene caracteres como `@`, `#` o `/`,
   genera otra solo con letras y números (o codifícala para URL).

No hace falta crear tablas: la API aplica las migraciones sola al arrancar.

---

## 2. Render: API

1. Entra a <https://render.com> → **Get Started** → inicia sesión con GitHub.
2. **New +** → **Blueprint** → conecta el repositorio `Inventario-Tienda`
   (si no aparece: **Configure account** y dale acceso).
3. **Branch:** la rama a desplegar (`main`, o `deploy/produccion` mientras se prueba).
   Render lee `render.yaml` y propone el servicio **tiendita-api** (Docker, plan Free, Virginia).
4. Completa las variables que pide:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena del paso 1.4 (con `?sslmode=require`) |
   | `APP_PASSWORD` | Contraseña para entrar al sistema (mín. 6 caracteres; luego se puede cambiar desde Configuración) |
   | `CORS_ORIGIN` | Por ahora `https://example.com` — se corrige en el paso 4 |

   `AUTH_SECRET` lo genera Render solo.
5. **Apply**. El primer build tarda unos 5–10 minutos (pestaña **Logs**). Al final verás
   `Nest application successfully started`.
6. Anota la URL del servicio (arriba a la izquierda), p. ej. `https://tiendita-api.onrender.com`.
   Comprueba en el navegador:
   - `https://tiendita-api.onrender.com/api/health` → `{"status":"ok","database":"up"}`

> Si el nombre `tiendita-api` ya estaba tomado, Render agrega un sufijo (p. ej. `tiendita-api-x1y2`).
> Usa la URL que te muestre Render en los pasos siguientes.

---

## 3. Cloudflare Pages: frontend

1. Entra a <https://dash.cloudflare.com> → crea una cuenta (gratis).
2. **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git** →
   conecta GitHub y elige `Inventario-Tienda`.
3. **Set up builds and deployments:**

   | Campo | Valor |
   |---|---|
   | Project name | `mi-tiendita` (define la URL: `mi-tiendita.pages.dev`) |
   | Production branch | `main` (o `deploy/produccion` mientras se prueba) |
   | Framework preset | **None** |
   | Build command | `pnpm --filter frontend build` |
   | Build output directory | `apps/frontend/out` |
   | Root directory | *(vacío)* |

4. **Environment variables (advanced)** → agrega:

   | Variable | Valor |
   |---|---|
   | `NEXT_OUTPUT` | `export` |
   | `NEXT_PUBLIC_API_URL` | La URL de Render del paso 2.6, **sin `/` final** |
   | `NODE_VERSION` | `22` |
   | `PNPM_VERSION` | `12.18.0` |

5. **Save and Deploy** (2–4 minutos). Anota la URL: `https://mi-tiendita.pages.dev`.

> `NEXT_PUBLIC_API_URL` queda grabada en el sitio al construirlo: si cambia la URL de Render,
> hay que actualizar la variable y volver a desplegar (**Deployments → Retry deployment**).

---

## 4. Render: permitir el frontend (CORS)

1. En Render → **tiendita-api** → **Environment**.
2. Cambia `CORS_ORIGIN` por la URL de Cloudflare, **sin `/` final**:
   `https://mi-tiendita.pages.dev`
   (varias URLs separadas por coma, p. ej. si luego agregas un dominio propio).
3. **Save Changes** → Render reinicia la API (1–2 minutos).

Ahora abre `https://mi-tiendita.pages.dev`, entra con `APP_PASSWORD` y comprueba que cargan
los datos.

---

## 5. cron-job.org: que la API no se duerma

Render duerme el plan gratuito tras **15 minutos sin visitas** (la siguiente visita tarda
30–60 s en despertarlo). Un "despertador" lo visita cada 10 minutos.

1. Entra a <https://cron-job.org> → crea una cuenta gratis.
2. **Create cronjob**:
   - **Title:** `Despertador Mi Tiendita`
   - **URL:** `https://tiendita-api.onrender.com/api` (ruta liviana: no consulta la base de datos)
   - **Execution schedule:** **Every 10 minutes**
3. **Create**. En el historial del cronjob deberías ver respuestas `200`.

> Un servicio encendido todo el mes usa ~720–744 h de las 750 gratuitas de Render: alcanza para
> **un solo** servicio. No crees otro servicio gratuito en la misma cuenta de Render.

---

## 6. Respaldos diarios (GitHub Actions)

El workflow `.github/workflows/respaldo-bd.yml` vuelca la base cada día a las 04:00 (Bolivia),
lo **cifra** y lo guarda 30 días como artefacto de GitHub. Supabase gratis no hace respaldos.

1. En GitHub: repositorio → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**, y crea:

   | Secreto | Valor |
   |---|---|
   | `BACKUP_DATABASE_URL` | La misma `DATABASE_URL` del paso 1.4 |
   | `BACKUP_PASSPHRASE` | Una contraseña larga y distinta. **Guárdala aparte:** sin ella no se pueden abrir los respaldos |

2. Pruébalo: pestaña **Actions** → **Respaldo de la base de datos** → **Run workflow**.
   Al terminar, el respaldo aparece en **Artifacts** del run.

> El workflow corre desde la rama por defecto (`main`): queda activo después de hacer merge.

### Restaurar un respaldo

```bash
# 1. Descarga el artefacto (zip) desde Actions y descomprímelo.
# 2. Descifra (pide BACKUP_PASSPHRASE):
gpg --decrypt --output respaldo.dump respaldo-AAAA-MM-DD.dump.gpg
# 3. Restaura sobre una base vacía (o la de Supabase, ¡reemplaza los datos!):
docker run --rm -i postgres:17 pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "postgresql://…?sslmode=require" < respaldo.dump
```

---

## 7. Después de desplegar

- **Primer ingreso:** entra con `APP_PASSWORD` y cámbiala en **Panel → Configuración**.
- **En el celular:** abre `https://mi-tiendita.pages.dev`. Al ser HTTPS, funciona la cámara
  (escáner de códigos y fotos de productos).
- **Actualizar la app:** cada `git push` a la rama configurada redepliega solo:
  Cloudflare reconstruye el frontend y Render la API (solo si cambió `apps/backend`).

## Limitaciones del plan gratuito

| | Límite | Qué pasa |
|---|---|---|
| Render | 512 MB RAM, CPU compartida | La API responde más lento que en local; alcanza para una tienda |
| Render | Reinicios ocasionales / sin despertador | La primera visita tras dormir tarda 30–60 s |
| Supabase | 500 MB | Incluye las fotos (~200 KB c/u): ≈ 1.000–2.000 productos con foto |
| Supabase | Pausa tras 7 días **sin ningún uso** | Se reactiva desde su panel (con uso diario no ocurre) |
| Latencia | Servidores en EE. UU. | Unos 150 ms extra desde Bolivia; casi imperceptible |

Para crecer más adelante, la misma app corre en cualquier servidor con Docker
(`docker-compose.prod.yml`): Oracle Cloud, un VPS, etc.
