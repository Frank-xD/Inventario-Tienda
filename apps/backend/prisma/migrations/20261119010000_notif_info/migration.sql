-- "Resumen semanal por correo" no se usaba: se reemplaza por el interruptor
-- de avisos informativos (proveedor, categoría o producto nuevos).
ALTER TABLE configuracion RENAME COLUMN resumen_semanal TO notif_info;
ALTER TABLE configuracion ALTER COLUMN notif_info SET DEFAULT TRUE;
-- Hasta ahora esos avisos siempre se mostraban: se conserva ese comportamiento.
UPDATE configuracion SET notif_info = TRUE;
