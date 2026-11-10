"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { api, enviar, type UnidadMedida } from "@/lib/api";
import type { Aviso, Categoria, Producto, Proveedor } from "@/lib/modelos";
import { useAvisos, useCategorias, useProductos, useProveedores } from "@/hooks/use-datos";

/**
 * Datos del panel administrativo, compartidos por todas sus secciones y
 * actualizados en tiempo real (Socket.IO). Las funciones guardar* llaman a
 * la API y lanzan Error con el mensaje del backend si algo falla; los
 * datos se recargan solos con el evento que emite el servidor.
 */

export interface DatosProveedor {
  id?: number;
  nombre: string;
  telefono: string;
  notas: string;
  activo: boolean;
}

export interface DatosCategoria {
  id?: number;
  nombre: string;
  activa: boolean;
}

export interface DatosProducto {
  id?: number;
  nombre: string;
  codigoBarras: string;
  descripcion: string;
  categoriaId: number;
  proveedorId: number;
  precio: number;
  unidadMedida: UnidadMedida;
  stockMinimo: number;
  activo: boolean;
}

/** Qué hacer con la foto al guardar un producto. */
export type CambioFoto = { tipo: "mantener" } | { tipo: "quitar" } | { tipo: "subir"; blob: Blob };

interface AdminStore {
  proveedores: Proveedor[];
  categorias: Categoria[];
  productos: Producto[];
  avisos: Aviso[];
  noLeidos: number;
  cargando: boolean;
  error: string | null;
  guardarProveedor: (p: DatosProveedor) => Promise<void>;
  guardarCategoria: (c: DatosCategoria) => Promise<void>;
  guardarProducto: (p: DatosProducto, foto: CambioFoto) => Promise<void>;
  marcarLeido: (id: number) => Promise<void>;
  marcarTodosLeidos: () => Promise<void>;
}

const Ctx = createContext<AdminStore | null>(null);

/** "" → null, para que el backend guarde NULL en lugar de un texto vacío. */
const nulo = (s: string) => s.trim() || null;

async function guardarProveedor({ id, ...p }: DatosProveedor) {
  const body = { nombre: p.nombre.trim(), telefono: nulo(p.telefono), notas: nulo(p.notas), activo: p.activo };
  await (id ? enviar("PATCH", `/proveedores/${id}`, body) : enviar("POST", "/proveedores", body));
}

async function guardarCategoria({ id, ...c }: DatosCategoria) {
  const body = { nombre: c.nombre.trim(), activa: c.activa };
  await (id ? enviar("PATCH", `/categorias/${id}`, body) : enviar("POST", "/categorias", body));
}

async function guardarProducto({ id, ...p }: DatosProducto, foto: CambioFoto) {
  const body = {
    nombre: p.nombre.trim(),
    codigoBarras: nulo(p.codigoBarras),
    descripcion: nulo(p.descripcion),
    categoriaId: p.categoriaId,
    proveedorId: p.proveedorId,
    precio: p.precio,
    unidadMedida: p.unidadMedida,
    stockMinimo: p.stockMinimo,
    activo: p.activo,
  };
  const guardado = id
    ? await enviar<{ id: number }>("PATCH", `/productos/${id}`, body)
    : await enviar<{ id: number }>("POST", "/productos", body);

  if (foto.tipo === "subir") {
    const form = new FormData();
    form.append("foto", foto.blob, foto.blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
    await api(`/productos/${guardado.id}/foto`, { method: "PUT", body: form }).catch((e: Error) => {
      throw new Error(`El producto se guardó, pero la foto no: ${e.message}`);
    });
  } else if (foto.tipo === "quitar") {
    await enviar("DELETE", `/productos/${guardado.id}/foto`);
  }
}

const marcarLeido = async (id: number) => void (await enviar("POST", `/avisos/${id}/leer`));
const marcarTodosLeidos = async () => void (await enviar("POST", "/avisos/leer-todos"));

export function AdminStoreProvider({ children }: { children: React.ReactNode }) {
  const proveedores = useProveedores();
  const categorias = useCategorias();
  const productos = useProductos();
  const avisos = useAvisos();

  const value = useMemo<AdminStore>(
    () => ({
      proveedores: proveedores.data ?? [],
      categorias: categorias.data ?? [],
      productos: productos.data ?? [],
      avisos: avisos.data?.avisos ?? [],
      noLeidos: avisos.data?.noLeidos ?? 0,
      cargando: proveedores.cargando || categorias.cargando || productos.cargando,
      error: proveedores.error ?? categorias.error ?? productos.error ?? avisos.error,
      guardarProveedor,
      guardarCategoria,
      guardarProducto,
      marcarLeido,
      marcarTodosLeidos,
    }),
    [proveedores, categorias, productos, avisos],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin debe usarse dentro de <AdminStoreProvider>");
  return ctx;
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const suscribirMinuto = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
};

/**
 * "hace 10 minutos", "ayer", etc. Se calcula solo en el navegador (en el
 * prerender no hay "ahora" fijo) y se refresca cada minuto.
 */
export function HaceCuanto({ iso }: { iso: string }) {
  const texto = useSyncExternalStore(suscribirMinuto, () => haceCuanto(iso), () => "");
  return <time dateTime={iso}>{texto}</time>;
}

function haceCuanto(iso: string) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(min) < 1) return "ahora";
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}
