import { z } from 'zod';
import { cantidad, dinero, fecha, id, texto } from '../common/schemas.js';
import { METODOS_PAGO } from '../common/tienda.js';

export const crearVenta = z.object({
  metodoPago: z.enum(METODOS_PAGO),
  /** Descuento sobre el total de la venta. */
  descuento: dinero.default(0),
  items: z
    .array(
      z.object({
        productoId: id,
        cantidad,
        /** Descuento de la línea (monto, no porcentaje). */
        descuento: dinero.default(0),
      }),
    )
    .min(1),
});

export const anularVenta = z.object({ motivo: texto });

export const filtrosVentas = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  cajaId: id.optional(),
  estado: z.enum(['completada', 'anulada']).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100),
});

export type CrearVenta = z.infer<typeof crearVenta>;
export type FiltrosVentas = z.infer<typeof filtrosVentas>;
