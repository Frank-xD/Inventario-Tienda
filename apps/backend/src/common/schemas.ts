import { z } from 'zod';

/** Helpers de validación reutilizables (zod + StandardSchemaValidationPipe). */
export const id = z.coerce.number().int().positive();
export const dinero = z.coerce.number().nonnegative().multipleOf(0.01);
export const montoPositivo = z.coerce.number().positive().multipleOf(0.01);
/**
 * Cantidad de producto: piezas, o kg con hasta 3 decimales (gramos).
 * Que un producto por unidad no reciba decimales lo valida la BD
 * (trg_validar_cantidad), porque aquí no se conoce el producto.
 */
export const cantidad = z.coerce
  .number()
  .positive()
  .multipleOf(0.001, 'Máximo 3 decimales (gramos)');
/** Cómo se vende un producto: por pieza o por peso. */
export const unidadMedida = z.enum(['unidad', 'kg']);
export const texto = z.string().trim().min(1);
export const textoOpcional = z.string().trim().min(1).optional().nullable();
/** Fecha calendario YYYY-MM-DD. */
export const fecha = z.iso.date();

export const idParam = z.coerce.number().int().positive();
