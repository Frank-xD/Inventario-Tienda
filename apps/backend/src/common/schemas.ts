import { z } from 'zod';

/** Helpers de validación reutilizables (zod + StandardSchemaValidationPipe). */
export const id = z.coerce.number().int().positive();
export const dinero = z.coerce.number().nonnegative().multipleOf(0.01);
export const montoPositivo = z.coerce.number().positive().multipleOf(0.01);
export const cantidad = z.coerce.number().int().positive();
export const texto = z.string().trim().min(1);
export const textoOpcional = z.string().trim().min(1).optional().nullable();
/** Fecha calendario YYYY-MM-DD. */
export const fecha = z.iso.date();

export const idParam = z.coerce.number().int().positive();
