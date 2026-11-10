-- Con productos por kg, cantidad × precio puede tener más de 2 decimales
-- (1,25 kg × Bs 8,50 = 10,625). La API redondea cada línea al centavo al
-- registrar la venta; el reporte hace lo mismo para que los totales cuadren.
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
