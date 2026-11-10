export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Prisma serializa los NUMERIC como string. */
export type Decimal = string;

/** Cómo se vende un producto: por pieza (cantidades enteras) o por peso. */
export type UnidadMedida = "unidad" | "kg";

export type MetodoPago = "efectivo" | "transferencia";

// ---------------------------------------------------------------------
// Respuestas de la API (tal como llegan: NUMERIC = string)
// ---------------------------------------------------------------------

export interface Resumen {
  hoy: { total: number; ventas: number; ticketPromedio: number; efectivo: number; transferencia: number };
  inventario: { productosActivos: number; valorCosto: number; valorVenta: number };
  alertas: { agotados: number; bajos: number };
  vencimientos: { vencidos: number; porVencer: number };
  proveedores: { activos: number; inactivos: number };
  cajaAbiertaId: number | null;
}

export interface VentaDiaria {
  dia: string;
  total: number;
  ventas: number;
  efectivo: number;
  transferencia: number;
}

export interface VentaPorProducto {
  productoId: number;
  nombre: string;
  unidadMedida: UnidadMedida;
  /** Piezas o kg, según unidadMedida. */
  unidades: Decimal;
  ingresos: Decimal;
  margen: Decimal;
}

export interface MovimientoReciente {
  tipo: "venta" | "compra" | "ajuste" | "merma";
  id: number;
  fecha: string;
  detalle: string;
  total: number;
  estado: "completada" | "anulada";
}

export interface ResumenCaja {
  montoInicial: Decimal;
  ventasEfectivo: Decimal;
  ventasTransferencia: Decimal;
  otrosIngresos: Decimal;
  egresos: Decimal;
  efectivoEsperado: Decimal;
  montoContado: Decimal | null;
  diferencia: Decimal | null;
}

export interface CajaActual {
  id: number;
  abiertaEn: string;
  cerradaEn: string | null;
  resumen: ResumenCaja | null;
}

export interface ProveedorApi {
  id: number;
  nombre: string;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  _count: { productos: number };
}

export interface CategoriaApi {
  id: number;
  nombre: string;
  activa: boolean;
  _count: { productos: number };
}

export interface ProductoApi {
  id: number;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  categoriaId: number;
  proveedorId: number | null;
  precio: Decimal;
  costo: Decimal;
  stockMinimo: Decimal;
  unidadMedida: UnidadMedida;
  activo: boolean;
  /** Relativa a API_URL: "/api/productos/1/foto?v=…". */
  fotoUrl: string | null;
  stock: Decimal;
}

export type TipoAviso = "stock" | "vencimiento" | "proveedor" | "info";

export interface AvisoApi {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  creadoEn: string;
  leidoEn: string | null;
  resueltoEn: string | null;
}

export interface Configuracion {
  nombreTienda: string;
  correo: string | null;
  telefono: string | null;
  notifStock: boolean;
  notifVencimientos: boolean;
  notifProveedores: boolean;
  resumenSemanal: boolean;
}

export interface ProductoCatalogo {
  id: number;
  nombre: string;
  categoria: string;
  fotoUrl: string | null;
  precio: Decimal;
  unidadMedida: UnidadMedida;
  disponibilidad: "disponible" | "pocas_unidades" | "agotado";
}

export interface Tienda {
  nombreTienda: string;
  correo: string | null;
  telefono: string | null;
}

export interface Anuncio {
  id: number;
  texto: string;
}

// ---------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------

/**
 * Llama a la API. Con un FormData no fija Content-Type (el navegador pone
 * el boundary del multipart). Lanza Error con el mensaje del backend.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const esFormulario = init?.body instanceof FormData;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: esFormulario ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    throw new Error(msg ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** POST/PATCH/PUT con cuerpo JSON. */
export const enviar = <T>(metodo: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown) =>
  api<T>(path, { method: metodo, body: body === undefined ? undefined : JSON.stringify(body) });

/** Convierte una ruta del backend ("/api/…") en URL absoluta. */
export const urlApi = (ruta: string | null) => (ruta ? `${API_URL}${ruta}` : null);

export const bs = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
