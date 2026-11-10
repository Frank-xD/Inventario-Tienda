"use client";

import { useMemo } from "react";
import {
  api,
  type AvisoApi,
  type CajaActual,
  type CategoriaApi,
  type Configuracion,
  type ProductoApi,
  type ProveedorApi,
} from "@/lib/api";
import { aAviso, aCategoria, aProducto, aProveedor } from "@/lib/modelos";
import { useLiveData } from "./use-live-data";

/**
 * Datos compartidos por varias pantallas, siempre al día: se vuelven a
 * pedir cuando el backend emite el evento correspondiente por Socket.IO.
 * Los fetchers están fuera de los hooks para que useLiveData no se
 * re-suscriba en cada render.
 */

const EV_PRODUCTOS = ["stock:actualizado", "producto:actualizado", "categoria:actualizada", "proveedor:actualizado"];
const EV_PROVEEDORES = ["proveedor:actualizado", "producto:actualizado"];
const EV_CATEGORIAS = ["categoria:actualizada", "producto:actualizado"];
const EV_AVISOS = [
  "avisos:actualizados",
  "stock:actualizado",
  "lotes:actualizados",
  "producto:actualizado",
  "proveedor:actualizado",
  "configuracion:actualizada",
];
const EV_CAJA = ["venta:registrada", "venta:anulada", "caja:actualizada"];

// Incluye inactivos: las pantallas filtran lo que necesitan.
const fetchProductos = () => api<ProductoApi[]>("/productos?inactivos=true");
const fetchProveedores = () => api<ProveedorApi[]>("/proveedores?todos=true");
const fetchCategorias = () => api<CategoriaApi[]>("/categorias?todas=true");
const fetchAvisos = () => api<{ avisos: AvisoApi[]; noLeidos: number }>("/avisos");
const fetchConfiguracion = () => api<Configuracion>("/configuracion");
// Envuelta: así "cargando" (data null) se distingue de "no hay caja" (caja null).
const fetchCaja = () => api<CajaActual | null>("/cajas/actual").then((caja) => ({ caja }));

/** Aplica `fn` a `data` solo cuando cambia. */
function useMapeo<A, B>(r: { data: A | null; error: string | null; recargar: () => void }, fn: (a: A) => B) {
  const { data, error, recargar } = r;
  const mapeado = useMemo(() => (data === null ? null : fn(data)), [data, fn]);
  // Mismo objeto mientras nada cambie (lo usan dependencias de useMemo).
  return useMemo(
    () => ({ data: mapeado, error, recargar, cargando: mapeado === null && !error }),
    [mapeado, error, recargar],
  );
}

const mapProductos = (xs: ProductoApi[]) => xs.map(aProducto);
const mapProveedores = (xs: ProveedorApi[]) => xs.map(aProveedor);
const mapCategorias = (xs: CategoriaApi[]) => xs.map(aCategoria);
const mapAvisos = (r: { avisos: AvisoApi[]; noLeidos: number }) => ({
  avisos: r.avisos.map(aAviso),
  noLeidos: r.noLeidos,
});
const identidad = <T,>(x: T) => x;

export const useProductos = () => useMapeo(useLiveData(fetchProductos, EV_PRODUCTOS), mapProductos);
export const useProveedores = () => useMapeo(useLiveData(fetchProveedores, EV_PROVEEDORES), mapProveedores);
export const useCategorias = () => useMapeo(useLiveData(fetchCategorias, EV_CATEGORIAS), mapCategorias);
export const useAvisos = () => useMapeo(useLiveData(fetchAvisos, EV_AVISOS), mapAvisos);
export const useConfiguracion = () =>
  useMapeo(useLiveData(fetchConfiguracion, ["configuracion:actualizada"]), identidad<Configuracion>);
/** data: { caja } cuando ya cargó (caja null = no hay caja abierta). */
export const useCaja = () => useMapeo(useLiveData(fetchCaja, EV_CAJA), identidad<{ caja: CajaActual | null }>);
