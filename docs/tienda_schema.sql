-- =====================================================================
--  Sistema de gestión de tienda de barrio - Esquema PostgreSQL
--  Cubre: catálogo, inventario, compras, ventas (POS), caja, anuncios,
--         lotes con fecha de vencimiento y vistas públicas.
--  Enfoque: un solo dueño; sin cuentas de usuario, horarios, promociones
--           ni auditoría.
--  Uso:   psql -U postgres -d tienda -f tienda_schema.sql
--  Notas: - Zona horaria de la tienda: America/La_Paz
--         - Cantidades en NUMERIC(12,3): cada producto se vende por
--           'unidad' (cantidades enteras, lo exige trg_validar_cantidad) o
--           por 'kg' (hasta 3 decimales = gramos).
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- búsqueda rápida por nombre

-- ---------------------------------------------------------------------
-- 1. CATÁLOGO
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id      SERIAL PRIMARY KEY,
    nombre  TEXT    NOT NULL UNIQUE,
    activa  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE proveedores (
    id        SERIAL PRIMARY KEY,
    nombre    TEXT    NOT NULL,
    telefono  TEXT,
    notas     TEXT,
    activo    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE productos (
    id             SERIAL PRIMARY KEY,
    codigo_barras  TEXT UNIQUE,                       -- puede ser NULL (pan, granel)
    nombre         TEXT          NOT NULL,
    descripcion    TEXT,
    categoria_id   INTEGER       NOT NULL REFERENCES categorias(id),
    proveedor_id   INTEGER       REFERENCES proveedores(id),
    precio         NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
    costo          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
    stock_minimo   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    unidad_medida  TEXT          NOT NULL DEFAULT 'unidad'
                   CHECK (unidad_medida IN ('unidad', 'kg')),   -- 'kg' = venta por peso
    activo         BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_categoria ON productos (categoria_id);
CREATE INDEX idx_productos_proveedor ON productos (proveedor_id);
CREATE INDEX idx_productos_nombre_trgm ON productos USING gin (nombre gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 2. CAJA
-- ---------------------------------------------------------------------
CREATE TABLE cajas (
    id             SERIAL PRIMARY KEY,
    abierta_en     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cerrada_en     TIMESTAMPTZ,
    monto_inicial  NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_contado  NUMERIC(12,2),                      -- se llena al cerrar (arqueo)
    notas          TEXT
);

-- Solo puede haber una caja abierta a la vez
CREATE UNIQUE INDEX uq_una_caja_abierta
    ON cajas ((TRUE)) WHERE cerrada_en IS NULL;

CREATE TABLE movimientos_caja (
    id          SERIAL PRIMARY KEY,
    caja_id     INTEGER       NOT NULL REFERENCES cajas(id),
    tipo        TEXT          NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    motivo      TEXT          NOT NULL,
    creado_en   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. ANUNCIOS
-- ---------------------------------------------------------------------
CREATE TABLE anuncios (
    id       SERIAL PRIMARY KEY,
    texto    TEXT    NOT NULL,
    desde    DATE    NOT NULL,
    hasta    DATE    NOT NULL,
    visible  BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (hasta >= desde)
);

-- ---------------------------------------------------------------------
-- 4. VENTAS (POS)
-- ---------------------------------------------------------------------
CREATE TABLE ventas (
    id                 SERIAL PRIMARY KEY,
    caja_id            INTEGER       NOT NULL REFERENCES cajas(id),
    fecha              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    subtotal           NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento          NUMERIC(12,2) NOT NULL DEFAULT 0,
    total              NUMERIC(12,2) NOT NULL DEFAULT 0,
    metodo_pago        TEXT          NOT NULL
                       CHECK (metodo_pago IN ('efectivo', 'transferencia')),
    estado             TEXT          NOT NULL DEFAULT 'completada'
                       CHECK (estado IN ('completada', 'anulada')),
    motivo_anulacion   TEXT,
    CHECK (estado <> 'anulada' OR motivo_anulacion IS NOT NULL)
);
CREATE INDEX idx_ventas_fecha ON ventas (fecha);
CREATE INDEX idx_ventas_caja  ON ventas (caja_id);

CREATE TABLE detalle_venta (
    id            SERIAL PRIMARY KEY,
    venta_id      INTEGER       NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id   INTEGER       NOT NULL REFERENCES productos(id),
    cantidad      NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),   -- piezas o kg
    precio_unit   NUMERIC(12,2) NOT NULL CHECK (precio_unit >= 0),   -- precio al momento de vender
    costo_unit    NUMERIC(12,2) NOT NULL DEFAULT 0,                  -- para calcular margen histórico
    descuento     NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_detalle_venta_venta    ON detalle_venta (venta_id);
CREATE INDEX idx_detalle_venta_producto ON detalle_venta (producto_id);

-- ---------------------------------------------------------------------
-- 5. COMPRAS A PROVEEDORES
-- ---------------------------------------------------------------------
CREATE TABLE compras (
    id            SERIAL PRIMARY KEY,
    proveedor_id  INTEGER       NOT NULL REFERENCES proveedores(id),
    fecha         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    total         NUMERIC(12,2) NOT NULL DEFAULT 0,
    notas         TEXT
);

CREATE TABLE detalle_compra (
    id            SERIAL PRIMARY KEY,
    compra_id     INTEGER       NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id   INTEGER       NOT NULL REFERENCES productos(id),
    cantidad      NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),   -- piezas o kg
    costo_unit    NUMERIC(12,2) NOT NULL CHECK (costo_unit >= 0),
    fecha_vencimiento DATE                      -- opcional: si se llena, se crea un lote
);
CREATE INDEX idx_detalle_compra_compra ON detalle_compra (compra_id);

-- ---------------------------------------------------------------------
-- 6. LOTES (fechas de vencimiento)
--    Una fila por cada fecha de vencimiento de un producto. Si una misma
--    compra trae 2 fechas distintas, se registran 2 líneas en detalle_compra
--    (una por fecha) y se crean 2 lotes. Productos sin vencimiento: sin lote.
--    Es un registro informativo para las alertas de vencimiento: no se
--    enlaza con ventas ni con el inventario. Cuando un lote se agota o se
--    retira del estante, se borra.
-- ---------------------------------------------------------------------
CREATE TABLE lotes (
    id                 SERIAL PRIMARY KEY,
    producto_id        INTEGER     NOT NULL REFERENCES productos(id),
    compra_id          INTEGER     REFERENCES compras(id),    -- NULL si es stock inicial
    fecha_vencimiento  DATE        NOT NULL,
    cantidad_inicial   NUMERIC(12,3) NOT NULL CHECK (cantidad_inicial > 0),  -- unidades recibidas con esa fecha (referencia; no baja al vender)
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lotes_producto    ON lotes (producto_id);
CREATE INDEX idx_lotes_vencimiento ON lotes (fecha_vencimiento);

-- ---------------------------------------------------------------------
-- 7. INVENTARIO: el stock es la SUMA de movimientos (nunca se edita a mano)
-- ---------------------------------------------------------------------
CREATE TABLE movimientos_inventario (
    id           BIGSERIAL PRIMARY KEY,
    producto_id  INTEGER     NOT NULL REFERENCES productos(id),
    tipo         TEXT        NOT NULL
                 CHECK (tipo IN ('compra', 'venta', 'ajuste', 'merma', 'anulacion_venta')),
    cantidad     NUMERIC(12,3) NOT NULL,            -- con signo: + entra, - sale
    motivo       TEXT,
    venta_id     INTEGER     REFERENCES ventas(id),
    compra_id    INTEGER     REFERENCES compras(id),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (cantidad <> 0),
    CHECK (tipo NOT IN ('compra', 'anulacion_venta') OR cantidad > 0),
    CHECK (tipo NOT IN ('venta', 'merma')            OR cantidad < 0),
    CHECK (tipo <> 'ajuste' OR motivo IS NOT NULL)
);
CREATE INDEX idx_mov_producto ON movimientos_inventario (producto_id);
CREATE INDEX idx_mov_fecha    ON movimientos_inventario (creado_en);

-- ---------------------------------------------------------------------
-- 1. CONFIGURACIÓN: una sola fila (id = 1)
-- ---------------------------------------------------------------------
CREATE TABLE configuracion (
    id                  SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nombre_tienda       TEXT        NOT NULL DEFAULT 'Mi Tiendita' CHECK (btrim(nombre_tienda) <> ''),
    correo              TEXT,
    telefono            TEXT,
    -- Qué avisos genera fn_sincronizar_avisos()
    notif_stock         BOOLEAN     NOT NULL DEFAULT TRUE,
    notif_vencimientos  BOOLEAN     NOT NULL DEFAULT TRUE,
    notif_proveedores   BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Preferencia guardada; el envío por correo aún no está implementado.
    resumen_semanal     BOOLEAN     NOT NULL DEFAULT FALSE,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO configuracion (id) VALUES (1);

-- ---------------------------------------------------------------------
-- 2. AVISOS
--    stock / vencimiento / proveedor: los genera y los cierra (resuelto_en)
--    fn_sincronizar_avisos() según el estado actual. La "clave" identifica
--    el problema: mientras siga abierto no se duplica.
--    info: los inserta la API (proveedor, categoría o producto nuevos).
-- ---------------------------------------------------------------------
CREATE TABLE avisos (
    id           SERIAL      PRIMARY KEY,
    tipo         TEXT        NOT NULL CHECK (tipo IN ('stock', 'vencimiento', 'proveedor', 'info')),
    titulo       TEXT        NOT NULL,
    texto        TEXT        NOT NULL,
    clave        TEXT,
    producto_id  INTEGER     REFERENCES productos(id) ON DELETE CASCADE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    leido_en     TIMESTAMPTZ,
    resuelto_en  TIMESTAMPTZ,
    CHECK (tipo = 'info' OR clave IS NOT NULL)
);
-- Un solo aviso abierto por problema.
CREATE UNIQUE INDEX uq_avisos_clave_abierta ON avisos (clave) WHERE resuelto_en IS NULL;
CREATE INDEX idx_avisos_creado ON avisos (creado_en DESC);

-- "3" / "1,25 kg"
CREATE OR REPLACE FUNCTION fn_fmt_cantidad(n NUMERIC, unidad TEXT) RETURNS TEXT AS $$
    SELECT replace(trim_scale(n)::text, '.', ',') || CASE WHEN unidad = 'kg' THEN ' kg' ELSE '' END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_sincronizar_avisos() RETURNS VOID AS $$
DECLARE
    cfg configuracion%ROWTYPE;
BEGIN
    -- Dos pestañas abiertas sincronizan a la vez: una espera a la otra.
    PERFORM pg_advisory_xact_lock(hashtext('fn_sincronizar_avisos'));
    SELECT * INTO cfg FROM configuracion WHERE id = 1;

    CREATE TEMP TABLE IF NOT EXISTS tmp_avisos (
        tipo TEXT, titulo TEXT, texto TEXT, clave TEXT, producto_id INTEGER
    ) ON COMMIT DROP;
    TRUNCATE tmp_avisos;

    IF cfg.notif_stock THEN
        INSERT INTO tmp_avisos
        SELECT 'stock',
               CASE WHEN a.nivel = 'agotado' THEN 'Agotado' ELSE 'Stock bajo' END,
               CASE WHEN a.nivel = 'agotado'
                    THEN a.nombre || ' no tiene stock.'
                    ELSE a.nombre || ' tiene solo ' || fn_fmt_cantidad(a.stock, a.unidad_medida)
                         || ' (mínimo ' || fn_fmt_cantidad(a.stock_minimo, a.unidad_medida) || ').' END,
               'stock:' || a.producto_id || ':' || a.nivel,
               a.producto_id
          FROM v_alertas_stock a;
    END IF;

    IF cfg.notif_vencimientos THEN
        INSERT INTO tmp_avisos
        SELECT 'vencimiento',
               CASE WHEN v.nivel = 'vencido' THEN 'Vencido' ELSE 'Por vencer' END,
               v.nombre || ' × ' || fn_fmt_cantidad(v.cantidad_inicial, v.unidad_medida) ||
               CASE WHEN v.nivel = 'vencido' THEN ' venció el ' || to_char(v.fecha_vencimiento, 'DD/MM')
                    WHEN v.dias_restantes = 0 THEN ' vence hoy'
                    WHEN v.dias_restantes = 1 THEN ' vence mañana'
                    ELSE ' vence en ' || v.dias_restantes || ' días' END
               || '. Retira el lote cuando ya no esté en el estante.',
               'lote:' || v.lote_id || ':' || v.nivel,
               v.producto_id
          FROM v_por_vencer v;
    END IF;

    IF cfg.notif_proveedores THEN
        INSERT INTO tmp_avisos
        SELECT 'proveedor',
               'Hacer pedido',
               'Pedir a ' || pr.nombre || ': ' || count(*) ||
               CASE WHEN count(*) = 1 THEN ' producto' ELSE ' productos' END ||
               ' con stock bajo (' || string_agg(a.nombre, ', ' ORDER BY a.nombre) || ').',
               'proveedor:' || pr.id,
               NULL
          FROM v_alertas_stock a
          JOIN proveedores pr ON pr.id = a.proveedor_id AND pr.activo
         GROUP BY pr.id, pr.nombre;
    END IF;

    -- Cierra los problemas que ya no existen (o cuyo tipo se desactivó).
    UPDATE avisos a
       SET resuelto_en = now()
     WHERE a.resuelto_en IS NULL
       AND a.tipo <> 'info'
       AND NOT EXISTS (SELECT 1 FROM tmp_avisos t WHERE t.clave = a.clave);

    -- Abre los nuevos; en los que siguen abiertos solo actualiza el texto
    -- (p. ej. el stock bajó de 3 a 2) sin marcarlos como no leídos.
    INSERT INTO avisos (tipo, titulo, texto, clave, producto_id)
    SELECT tipo, titulo, texto, clave, producto_id FROM tmp_avisos
    ON CONFLICT (clave) WHERE resuelto_en IS NULL
    DO UPDATE SET titulo = EXCLUDED.titulo, texto = EXCLUDED.texto
     WHERE avisos.texto IS DISTINCT FROM EXCLUDED.texto
        OR avisos.titulo IS DISTINCT FROM EXCLUDED.titulo;
END; $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 3. FOTOS DE PRODUCTOS (en la BD, comprimidas por el cliente)
--    Tabla aparte para que las listas de productos no carguen los bytes.
-- ---------------------------------------------------------------------
CREATE TABLE producto_fotos (
    producto_id     INTEGER     PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
    datos           BYTEA       NOT NULL CHECK (octet_length(datos) BETWEEN 1 AND 524288),  -- máx. 512 KB
    tipo            TEXT        NOT NULL CHECK (tipo IN ('image/webp', 'image/jpeg', 'image/png')),
    actualizada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TRIGGERS: automatizan el stock y la auditoría
-- =====================================================================

-- Productos por unidad: cantidades enteras. SQLSTATE propio 'TD001' para
-- que la API devuelva el mensaje tal cual.
CREATE OR REPLACE FUNCTION fn_validar_cantidad() RETURNS TRIGGER AS $$
DECLARE
    v_cantidad NUMERIC := to_jsonb(NEW) ->> TG_ARGV[0];
    v_producto productos%ROWTYPE;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = NEW.producto_id;
    IF v_producto.unidad_medida = 'unidad' AND v_cantidad <> trunc(v_cantidad) THEN
        RAISE EXCEPTION '"%" se vende por unidad: la cantidad debe ser entera (se recibió %)',
              v_producto.nombre, v_cantidad
              USING ERRCODE = 'TD001';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_cantidad
BEFORE INSERT OR UPDATE OF cantidad, producto_id ON detalle_venta
FOR EACH ROW EXECUTE FUNCTION fn_validar_cantidad('cantidad');

CREATE TRIGGER trg_validar_cantidad
BEFORE INSERT OR UPDATE OF cantidad, producto_id ON detalle_compra
FOR EACH ROW EXECUTE FUNCTION fn_validar_cantidad('cantidad');

CREATE TRIGGER trg_validar_cantidad
BEFORE INSERT OR UPDATE OF cantidad, producto_id ON movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION fn_validar_cantidad('cantidad');

CREATE TRIGGER trg_validar_cantidad
BEFORE INSERT OR UPDATE OF cantidad_inicial, producto_id ON lotes
FOR EACH ROW EXECUTE FUNCTION fn_validar_cantidad('cantidad_inicial');

-- Stock mínimo entero si es por unidad; y no se puede pasar un producto de
-- 'kg' a 'unidad' si ya tiene movimientos con decimales.
CREATE OR REPLACE FUNCTION fn_validar_unidad_producto() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unidad_medida = 'unidad' THEN
        IF NEW.stock_minimo <> trunc(NEW.stock_minimo) THEN
            RAISE EXCEPTION '"%" se vende por unidad: el stock mínimo debe ser entero', NEW.nombre
                  USING ERRCODE = 'TD001';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.unidad_medida = 'kg' AND EXISTS (
               SELECT 1 FROM movimientos_inventario
                WHERE producto_id = NEW.id AND cantidad <> trunc(cantidad)) THEN
            RAISE EXCEPTION '"%" tiene movimientos con decimales: no puede pasar a venderse por unidad', NEW.nombre
                  USING ERRCODE = 'TD001';
        END IF;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_unidad_producto
BEFORE INSERT OR UPDATE OF unidad_medida, stock_minimo ON productos
FOR EACH ROW EXECUTE FUNCTION fn_validar_unidad_producto();

-- Compra: cada línea suma stock y actualiza el costo del producto
CREATE OR REPLACE FUNCTION fn_compra_a_inventario() RETURNS TRIGGER AS $$
BEGIN
    -- Si la línea trae fecha de vencimiento, se registra su lote (solo informativo)
    IF NEW.fecha_vencimiento IS NOT NULL THEN
        INSERT INTO lotes (producto_id, compra_id, fecha_vencimiento, cantidad_inicial)
        VALUES (NEW.producto_id, NEW.compra_id, NEW.fecha_vencimiento, NEW.cantidad);
    END IF;

    INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, compra_id)
    VALUES (NEW.producto_id, 'compra', NEW.cantidad, NEW.compra_id);

    UPDATE productos SET costo = NEW.costo_unit WHERE id = NEW.producto_id;

    UPDATE compras
       SET total = (SELECT COALESCE(SUM(cantidad * costo_unit), 0)
                      FROM detalle_compra WHERE compra_id = NEW.compra_id)
     WHERE id = NEW.compra_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compra_a_inventario
AFTER INSERT ON detalle_compra
FOR EACH ROW EXECUTE FUNCTION fn_compra_a_inventario();

-- Venta: cada línea resta stock automáticamente
CREATE OR REPLACE FUNCTION fn_venta_a_inventario() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, venta_id)
    VALUES (NEW.producto_id, 'venta', -NEW.cantidad, NEW.venta_id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_a_inventario
AFTER INSERT ON detalle_venta
FOR EACH ROW EXECUTE FUNCTION fn_venta_a_inventario();

-- Anular venta: devuelve el stock con movimientos de reversa
CREATE OR REPLACE FUNCTION fn_anular_venta() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado = 'completada' AND NEW.estado = 'anulada' THEN
        INSERT INTO movimientos_inventario
               (producto_id, tipo, cantidad, motivo, venta_id)
        SELECT d.producto_id, 'anulacion_venta', d.cantidad,
               NEW.motivo_anulacion, NEW.id
          FROM detalle_venta d WHERE d.venta_id = NEW.id;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_anular_venta
AFTER UPDATE OF estado ON ventas
FOR EACH ROW EXECUTE FUNCTION fn_anular_venta();

-- =====================================================================
-- VISTAS
-- =====================================================================

-- Stock actual por producto (suma de movimientos)
CREATE OR REPLACE VIEW v_stock AS
SELECT p.id AS producto_id,
       p.nombre,
       p.unidad_medida,
       p.stock_minimo,
       COALESCE(SUM(m.cantidad), 0)::numeric(12,3) AS stock
  FROM productos p
  LEFT JOIN movimientos_inventario m ON m.producto_id = p.id
 GROUP BY p.id;

-- Alertas del panel interno: stock bajo y agotados
CREATE OR REPLACE VIEW v_alertas_stock AS
SELECT s.producto_id, s.nombre, s.unidad_medida, s.stock, s.stock_minimo,
       CASE WHEN s.stock <= 0 THEN 'agotado' ELSE 'bajo' END AS nivel,
       p.proveedor_id
  FROM v_stock s
  JOIN productos p ON p.id = s.producto_id
 WHERE p.activo AND s.stock <= s.stock_minimo;

-- Lotes registrados que ya vencieron o vencen en los próximos 7 días.
-- Cuando un lote se agota o se retira del estante, bórralo de la tabla lotes.
CREATE OR REPLACE VIEW v_por_vencer AS
SELECT l.id AS lote_id,
       l.producto_id,
       p.nombre,
       p.unidad_medida,
       l.fecha_vencimiento,
       l.cantidad_inicial,
       l.fecha_vencimiento - h.hoy AS dias_restantes,
       CASE WHEN l.fecha_vencimiento < h.hoy THEN 'vencido' ELSE 'por_vencer' END AS nivel
  FROM lotes l
  JOIN productos p ON p.id = l.producto_id
  CROSS JOIN LATERAL (SELECT (now() AT TIME ZONE 'America/La_Paz')::date AS hoy) h
 WHERE l.fecha_vencimiento <= h.hoy + 7;

-- Catálogo para el portal público (sin cifras exactas de stock ni costos)
CREATE OR REPLACE VIEW v_catalogo_publico AS
SELECT p.id,
       p.nombre,
       c.nombre AS categoria,
       f.actualizada_en AS foto_actualizada_en,   -- NULL si no tiene foto
       p.precio,
       p.unidad_medida,
       CASE WHEN s.stock <= 0              THEN 'agotado'
            WHEN s.stock <= p.stock_minimo THEN 'pocas_unidades'
            ELSE 'disponible' END AS disponibilidad
  FROM productos p
  JOIN categorias c  ON c.id = p.categoria_id
  JOIN v_stock    s  ON s.producto_id = p.id
  LEFT JOIN producto_fotos f ON f.producto_id = p.id
 WHERE p.activo AND c.activa;

-- Anuncios visibles hoy
CREATE OR REPLACE VIEW v_anuncios_vigentes AS
SELECT id, texto
  FROM anuncios
 WHERE visible
   AND (now() AT TIME ZONE 'America/La_Paz')::date BETWEEN desde AND hasta;

-- Resumen de caja (esperado en efectivo = inicial + ventas efectivo + ingresos - egresos)
CREATE OR REPLACE VIEW v_resumen_caja AS
SELECT c.id AS caja_id,
       c.abierta_en,
       c.cerrada_en,
       c.monto_inicial,
       COALESCE(v.efectivo, 0)      AS ventas_efectivo,
       COALESCE(v.transferencia, 0) AS ventas_transferencia,
       COALESCE(m.ingresos, 0)      AS otros_ingresos,
       COALESCE(m.egresos, 0)       AS egresos,
       c.monto_inicial + COALESCE(v.efectivo, 0)
         + COALESCE(m.ingresos, 0) - COALESCE(m.egresos, 0) AS efectivo_esperado,
       c.monto_contado,
       c.monto_contado - (c.monto_inicial + COALESCE(v.efectivo, 0)
         + COALESCE(m.ingresos, 0) - COALESCE(m.egresos, 0)) AS diferencia
  FROM cajas c
  LEFT JOIN LATERAL (
        SELECT SUM(total) FILTER (WHERE metodo_pago = 'efectivo')      AS efectivo,
               SUM(total) FILTER (WHERE metodo_pago = 'transferencia') AS transferencia
          FROM ventas WHERE caja_id = c.id AND estado = 'completada') v ON TRUE
  LEFT JOIN LATERAL (
        SELECT SUM(monto) FILTER (WHERE tipo = 'ingreso') AS ingresos,
               SUM(monto) FILTER (WHERE tipo = 'egreso')  AS egresos
          FROM movimientos_caja WHERE caja_id = c.id) m ON TRUE;

-- Reporte: más vendidos y margen por producto (ventas completadas)
CREATE OR REPLACE VIEW v_ventas_por_producto AS
SELECT d.producto_id,
       p.nombre,
       p.unidad_medida,
       SUM(d.cantidad)                                          AS unidades,
       SUM(ROUND(d.cantidad * d.precio_unit, 2) - d.descuento)  AS ingresos,
       SUM(ROUND(d.cantidad * d.precio_unit, 2) - d.descuento
           - ROUND(d.cantidad * d.costo_unit, 2))               AS margen
  FROM detalle_venta d
  JOIN ventas    v ON v.id = d.venta_id AND v.estado = 'completada'
  JOIN productos p ON p.id = d.producto_id
 GROUP BY d.producto_id, p.nombre, p.unidad_medida;

COMMIT;

-- =====================================================================
-- EJEMPLOS DE USO (opcional, descomenta para probar)
-- =====================================================================
-- SELECT * FROM v_alertas_stock ORDER BY nivel, nombre;
-- SELECT * FROM v_por_vencer ORDER BY fecha_vencimiento;
-- DELETE FROM lotes WHERE id = 1;   -- retirar un lote agotado o descartado

-- SELECT * FROM v_catalogo_publico WHERE nombre ILIKE '%arroz%';
-- Ventas de hoy:
--   SELECT SUM(total) FROM ventas
--    WHERE estado = 'completada'
--      AND (fecha AT TIME ZONE 'America/La_Paz')::date = (now() AT TIME ZONE 'America/La_Paz')::date;
