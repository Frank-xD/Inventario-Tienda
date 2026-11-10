-- Venta por peso (kg).
--
-- Cada producto declara su unidad de medida: 'unidad' (se vende entero) o
-- 'kg' (se vende por peso, con hasta 3 decimales = gramos). Las cantidades
-- pasan de INTEGER a NUMERIC(12,3). Un trigger impide decimales en los
-- productos que se venden por unidad.
--
-- Las vistas dependen de esas columnas: PostgreSQL no permite cambiar el tipo
-- de una columna usada por una vista, así que se borran y se recrean.

-- ---------------------------------------------------------------------
-- 1. Quitar vistas que dependen de las cantidades (orden de dependencia)
-- ---------------------------------------------------------------------
DROP VIEW v_catalogo_publico;
DROP VIEW v_alertas_stock;
DROP VIEW v_stock;
DROP VIEW v_por_vencer;
DROP VIEW v_ventas_por_producto;

-- ---------------------------------------------------------------------
-- 2. Unidad de medida del producto y cantidades decimales
-- ---------------------------------------------------------------------
ALTER TABLE productos
    ADD COLUMN unidad_medida TEXT NOT NULL DEFAULT 'unidad'
        CHECK (unidad_medida IN ('unidad', 'kg'));

ALTER TABLE productos              ALTER COLUMN stock_minimo     TYPE NUMERIC(12,3);
ALTER TABLE detalle_venta          ALTER COLUMN cantidad         TYPE NUMERIC(12,3);
ALTER TABLE detalle_compra         ALTER COLUMN cantidad         TYPE NUMERIC(12,3);
ALTER TABLE lotes                  ALTER COLUMN cantidad_inicial TYPE NUMERIC(12,3);
ALTER TABLE movimientos_inventario ALTER COLUMN cantidad         TYPE NUMERIC(12,3);

-- ---------------------------------------------------------------------
-- 3. Productos por unidad: cantidades enteras
--    SQLSTATE propio 'TD001' para que la API devuelva el mensaje tal cual.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4. Vistas recreadas (ahora con cantidades decimales y unidad_medida)
-- ---------------------------------------------------------------------

-- Stock actual por producto (suma de movimientos)
CREATE VIEW v_stock AS
SELECT p.id AS producto_id,
       p.nombre,
       p.unidad_medida,
       p.stock_minimo,
       COALESCE(SUM(m.cantidad), 0)::numeric(12,3) AS stock
  FROM productos p
  LEFT JOIN movimientos_inventario m ON m.producto_id = p.id
 GROUP BY p.id;

-- Alertas del panel interno: stock bajo y agotados
CREATE VIEW v_alertas_stock AS
SELECT s.producto_id, s.nombre, s.unidad_medida, s.stock, s.stock_minimo,
       CASE WHEN s.stock <= 0 THEN 'agotado' ELSE 'bajo' END AS nivel,
       p.proveedor_id
  FROM v_stock s
  JOIN productos p ON p.id = s.producto_id
 WHERE p.activo AND s.stock <= s.stock_minimo;

-- Lotes registrados que ya vencieron o vencen en los próximos 7 días.
CREATE VIEW v_por_vencer AS
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

-- Catálogo para el portal público (sin cifras exactas de stock ni costos).
-- unidad_medida permite mostrar "Bs 9,00 / kg".
CREATE VIEW v_catalogo_publico AS
SELECT p.id,
       p.nombre,
       c.nombre AS categoria,
       p.foto_url,
       p.precio,
       p.unidad_medida,
       CASE WHEN s.stock <= 0              THEN 'agotado'
            WHEN s.stock <= p.stock_minimo THEN 'pocas_unidades'
            ELSE 'disponible' END AS disponibilidad
  FROM productos p
  JOIN categorias c  ON c.id = p.categoria_id
  JOIN v_stock    s  ON s.producto_id = p.id
 WHERE p.activo AND c.activa;

-- Reporte: más vendidos y margen por producto (ventas completadas).
-- "unidades" está en la unidad del producto (piezas o kg).
CREATE VIEW v_ventas_por_producto AS
SELECT d.producto_id,
       p.nombre,
       p.unidad_medida,
       SUM(d.cantidad)                                          AS unidades,
       SUM(d.cantidad * d.precio_unit - d.descuento)            AS ingresos,
       SUM(d.cantidad * d.precio_unit - d.descuento
           - d.cantidad * d.costo_unit)                         AS margen
  FROM detalle_venta d
  JOIN ventas    v ON v.id = d.venta_id AND v.estado = 'completada'
  JOIN productos p ON p.id = d.producto_id
 GROUP BY d.producto_id, p.nombre, p.unidad_medida;
