export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Prisma serializa los NUMERIC como string. */
export type Decimal = string;

export interface Resumen {
  hoy: { total: number; ventas: number; ticketPromedio: number; efectivo: number; transferencia: number };
  inventario: { productosActivos: number; valorCosto: number; valorVenta: number };
  alertas: { agotados: number; bajos: number };
  vencimientos: { vencidos: number; porVencer: number };
  cajaAbiertaId: number | null;
}

export interface VentaDiaria {
  dia: string;
  total: number;
  ventas: number;
  efectivo: number;
  transferencia: number;
}

export interface AlertaStock {
  productoId: number;
  nombre: string;
  stock: number;
  stockMinimo: number;
  nivel: "agotado" | "bajo";
  proveedorId: number | null;
}

export interface PorVencer {
  loteId: number;
  productoId: number;
  nombre: string;
  fechaVencimiento: string;
  cantidadInicial: number;
  diasRestantes: number;
  nivel: "vencido" | "por_vencer";
}

export interface VentaPorProducto {
  productoId: number;
  nombre: string;
  unidades: number;
  ingresos: Decimal;
  margen: Decimal;
}

export interface CajaActual {
  id: number;
  abiertaEn: string;
  resumen: {
    montoInicial: Decimal;
    ventasEfectivo: Decimal;
    ventasTransferencia: Decimal;
    otrosIngresos: Decimal;
    egresos: Decimal;
    efectivoEsperado: Decimal;
  } | null;
}

export interface ProductoCatalogo {
  id: number;
  nombre: string;
  categoria: string;
  fotoUrl: string | null;
  precio: Decimal;
  disponibilidad: "disponible" | "pocas_unidades" | "agotado";
}

export interface Anuncio {
  id: number;
  texto: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    throw new Error(msg ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const bs = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
