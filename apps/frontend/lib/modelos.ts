/**
 * Modelos que usan las pantallas. La API manda los NUMERIC como string;
 * aquí se convierten a number una sola vez.
 */
import {
  urlApi,
  type AvisoApi,
  type CategoriaApi,
  type ProductoApi,
  type ProveedorApi,
  type TipoAviso,
  type UnidadMedida,
} from "@/lib/api";

export type { TipoAviso, UnidadMedida };

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string;
  notas: string;
  activo: boolean;
  productos: number;
}

export interface Categoria {
  id: number;
  nombre: string;
  activa: boolean;
  productos: number;
}

export interface Producto {
  id: number;
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  categoriaId: number;
  proveedorId: number | null;
  precio: number;
  costo: number;
  stock: number;
  stockMinimo: number;
  unidadMedida: UnidadMedida;
  activo: boolean;
  /** URL absoluta o null. */
  fotoUrl: string | null;
}

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  fecha: string;
  leido: boolean;
  /** El problema ya no existe (se repuso el stock, se retiró el lote…). */
  resuelto: boolean;
}

export const aProveedor = (p: ProveedorApi): Proveedor => ({
  id: p.id,
  nombre: p.nombre,
  telefono: p.telefono ?? "",
  notas: p.notas ?? "",
  activo: p.activo,
  productos: p._count.productos,
});

export const aCategoria = (c: CategoriaApi): Categoria => ({
  id: c.id,
  nombre: c.nombre,
  activa: c.activa,
  productos: c._count.productos,
});

export const aProducto = (p: ProductoApi): Producto => ({
  id: p.id,
  codigoBarras: p.codigoBarras ?? "",
  nombre: p.nombre,
  descripcion: p.descripcion ?? "",
  categoriaId: p.categoriaId,
  proveedorId: p.proveedorId,
  precio: Number(p.precio),
  costo: Number(p.costo),
  stock: Number(p.stock),
  stockMinimo: Number(p.stockMinimo),
  unidadMedida: p.unidadMedida,
  activo: p.activo,
  fotoUrl: urlApi(p.fotoUrl),
});

export const aAviso = (a: AvisoApi): Aviso => ({
  id: a.id,
  tipo: a.tipo,
  titulo: a.titulo,
  texto: a.texto,
  fecha: a.creadoEn,
  leido: a.leidoEn !== null,
  resuelto: a.resueltoEn !== null,
});

/** Busca por nombre en una lista ya cargada ("—" si no está). */
export const nombreDe = (lista: { id: number; nombre: string }[] | null | undefined, id: number | null) =>
  (id !== null && lista?.find((x) => x.id === id)?.nombre) || "—";
