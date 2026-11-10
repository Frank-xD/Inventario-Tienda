import { z } from 'zod';
import {
  cantidad,
  dinero,
  fecha,
  id,
  texto,
  textoOpcional,
  unidadMedida,
} from '../common/schemas.js';

export const crearProducto = z.object({
  codigoBarras: textoOpcional,
  nombre: texto,
  descripcion: textoOpcional,
  categoriaId: id,
  proveedorId: id.optional().nullable(),
  precio: dinero,
  costo: dinero.optional(),
  /** 'kg' admite cantidades con decimales; 'unidad' (por defecto), solo enteras. */
  unidadMedida: unidadMedida.optional(),
  stockMinimo: z.coerce.number().nonnegative().multipleOf(0.001).optional(),
  activo: z.boolean().optional(),
  /**
   * Stock con el que se da de alta el producto. Se registra como un
   * movimiento 'ajuste' con motivo "Stock inicial" (el stock nunca se edita).
   */
  stockInicial: cantidad.optional(),
  /** Si el stock inicial vence, se registra su lote (sin compra). */
  fechaVencimiento: fecha.optional(),
});

export const editarProducto = crearProducto
  .omit({ stockInicial: true, fechaVencimiento: true })
  .partial();

export const filtrosProductos = z.object({
  q: z.string().trim().optional(),
  categoriaId: id.optional(),
  proveedorId: id.optional(),
  inactivos: z.enum(['true', 'false']).optional(),
});

export type CrearProducto = z.infer<typeof crearProducto>;
export type EditarProducto = z.infer<typeof editarProducto>;
export type FiltrosProductos = z.infer<typeof filtrosProductos>;
