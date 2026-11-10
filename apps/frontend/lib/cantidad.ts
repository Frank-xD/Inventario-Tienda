import type { UnidadMedida } from "@/lib/api";

const fmtKg = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
const fmtUnidad = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });

/** "3", "1,25 kg", "0,5 kg". */
export function formatCantidad(cantidad: number | string, unidad: UnidadMedida = "unidad") {
  const n = Number(cantidad);
  return unidad === "kg" ? `${fmtKg.format(n)} kg` : fmtUnidad.format(n);
}

/** Sufijo del precio: "/ kg" o "" (por unidad no hace falta). */
export const sufijoPrecio = (unidad: UnidadMedida = "unidad") => (unidad === "kg" ? " / kg" : "");

/** Atributos de un <input type="number"> de cantidad según la unidad. */
export const pasoCantidad = (unidad: UnidadMedida = "unidad") =>
  unidad === "kg" ? { step: "0.001", min: 0.001, inputMode: "decimal" as const } : { step: 1, min: 1, inputMode: "numeric" as const };

/**
 * Valida una cantidad: por unidad debe ser entera; por kg, hasta 3 decimales
 * (gramos), igual que la base de datos. Devuelve el mensaje de error o null.
 */
export function errorCantidad(cantidad: number, unidad: UnidadMedida = "unidad") {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "La cantidad debe ser mayor a 0";
  if (unidad === "unidad" && !Number.isInteger(cantidad)) return "Este producto se vende por unidad";
  // Tolerancia por coma flotante: 0,1 × 1000 = 100,00000000000001.
  if (Math.abs(cantidad * 1000 - Math.round(cantidad * 1000)) > 1e-6) return "Máximo 3 decimales (gramos)";
  return null;
}

/** Suma/resta sin errores de coma flotante (0,1 + 0,2 = 0,3). */
export const sumarCantidad = (a: number, b: number) => Math.round((a + b) * 1000) / 1000;

/** Importe de una línea redondeado al centavo, igual que la API. */
export const importe = (cantidad: number, precio: number) => Math.round(cantidad * precio * 100) / 100;
