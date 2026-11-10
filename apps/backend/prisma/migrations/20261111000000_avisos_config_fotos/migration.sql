-- Configuración de la tienda, avisos (campana) y fotos de productos en la BD.

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

-- productos.foto_url deja de usarse: la URL la arma la API a partir de
-- producto_fotos. v_catalogo_publico depende de la columna.
DROP VIEW v_catalogo_publico;
ALTER TABLE productos DROP COLUMN foto_url;

CREATE VIEW v_catalogo_publico AS
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
