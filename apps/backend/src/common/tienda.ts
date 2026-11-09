/** Zona horaria de la tienda (la misma que usan las vistas del SQL). */
export const TIENDA_TZ = 'America/La_Paz';

export const METODOS_PAGO = ['efectivo', 'transferencia'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const TIPOS_MOVIMIENTO_CAJA = ['ingreso', 'egreso'] as const;
export type TipoMovimientoCaja = (typeof TIPOS_MOVIMIENTO_CAJA)[number];

export type TipoMovimientoInventario =
  'compra' | 'venta' | 'ajuste' | 'merma' | 'anulacion_venta';

/**
 * Bolivia usa UTC-4 todo el año (sin horario de verano), así que un día
 * calendario de la tienda va de 00:00 a 23:59:59.999 en -04:00.
 */
const OFFSET_TIENDA = '-04:00';

export function inicioDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00${OFFSET_TIENDA}`);
}

export function finDia(fecha: string): Date {
  return new Date(`${fecha}T23:59:59.999${OFFSET_TIENDA}`);
}
