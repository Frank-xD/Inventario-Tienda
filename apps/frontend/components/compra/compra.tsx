"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, PackageOpen, Search, Trash2 } from "lucide-react";
import { bs, enviar } from "@/lib/api";
import { errorCantidad, importe, pasoCantidad, sumarCantidad } from "@/lib/cantidad";
import { nombreDe, type Producto } from "@/lib/modelos";
import { useCategorias, useProductos, useProveedores } from "@/hooks/use-datos";
import { ErrorEnvio, EstadoCarga, useEnvio } from "@/components/admin/comun";
import { AppHeader } from "@/components/nav/app-header";
import { ImagenProducto, TarjetaProducto } from "@/components/productos/tarjeta-producto";
import { CodigoInput } from "@/components/scanner/codigo-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** Una línea de la compra. Los campos son texto mientras se editan. */
interface ItemCompra {
  uid: number;
  producto: Producto;
  cantidad: string;
  costo: string;
  vencimiento: string; // yyyy-mm-dd o ""
}

let siguienteUid = 1;

/** Error de una línea, o null si se puede registrar. */
function errorLinea(i: ItemCompra): string | null {
  if (i.cantidad === "") return "Falta la cantidad";
  const err = errorCantidad(Number(i.cantidad), i.producto.unidadMedida);
  if (err) return err;
  if (i.costo === "" || Number(i.costo) < 0) return "Falta el costo";
  return null;
}

/** Registro de compra a un proveedor: suma stock, fija el costo y crea lotes. */
export function Compra({ proveedorInicial }: { proveedorInicial?: string }) {
  const router = useRouter();
  const productosQ = useProductos();
  const proveedoresQ = useProveedores();
  const categoriasQ = useCategorias();
  const productos = useMemo(() => (productosQ.data ?? []).filter((p) => p.activo), [productosQ.data]);
  const proveedores = (proveedoresQ.data ?? []).filter((p) => p.activo);
  const categorias = (categoriasQ.data ?? []).filter((c) => c.activa);
  const errorCarga = productosQ.error ?? proveedoresQ.error ?? categoriasQ.error;
  const { enviando, error: errorEnvio, setError: setErrorEnvio, ejecutar } = useEnvio();

  // El proveedor elegido es el de la compra y además filtra los productos.
  const [proveedorId, setProveedorId] = useState(proveedorInicial ?? "");
  const [categoriaId, setCategoriaId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const proveedor = proveedorId ? Number(proveedorId) : null;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!proveedor || verTodos || p.proveedorId === proveedor || p.proveedorId === null) &&
        (!categoriaId || p.categoriaId === Number(categoriaId)) &&
        (!q || p.nombre.toLowerCase().includes(q) || p.codigoBarras.includes(q)),
    );
  }, [productos, proveedor, verTodos, categoriaId, busqueda]);

  const enLista = (p: Producto) =>
    items.filter((i) => i.producto.id === p.id).reduce((s, i) => sumarCantidad(s, Number(i.cantidad) || 0), 0);

  const total =
    Math.round(items.reduce((s, i) => s + importe(Number(i.cantidad) || 0, Number(i.costo) || 0), 0) * 100) / 100;
  const errores = items.map(errorLinea);
  const hayErrores = errores.some(Boolean);

  /** Suma 1 (pieza o kg) a la primera línea del producto, o crea una línea nueva. */
  const agregar = (p: Producto): string | null => {
    setAviso(null);
    setErrorEnvio(null);
    // Sin proveedor elegido, se toma el del primer producto.
    if (!proveedor && p.proveedorId) setProveedorId(String(p.proveedorId));
    setItems((prev) => {
      const existente = prev.find((i) => i.producto.id === p.id);
      if (existente)
        return prev.map((i) =>
          i.uid === existente.uid ? { ...i, cantidad: String(sumarCantidad(Number(i.cantidad) || 0, 1)) } : i,
        );
      return [
        ...prev,
        { uid: siguienteUid++, producto: p, cantidad: "1", costo: p.costo ? p.costo.toFixed(2) : "", vencimiento: "" },
      ];
    });
    return null;
  };

  /** Otra línea del mismo producto con otra fecha de vencimiento (se crea otro lote). */
  const otroLote = (i: ItemCompra) =>
    setItems((prev) => {
      const pos = prev.findIndex((x) => x.uid === i.uid);
      const nueva = { ...i, uid: siguienteUid++, cantidad: "1", vencimiento: "" };
      return [...prev.slice(0, pos + 1), nueva, ...prev.slice(pos + 1)];
    });

  const editar = (uid: number, cambios: Partial<ItemCompra>) =>
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...cambios } : i)));

  const onCodigo = (codigo: string) => {
    const p = productos.find((x) => x.codigoBarras === codigo);
    if (!p) return `No hay un producto activo con el código ${codigo}. Créalo en el panel → Productos.`;
    return agregar(p);
  };

  const limpiar = () => {
    setItems([]);
    setProveedorId("");
    setCategoriaId("");
    setBusqueda("");
    setVerTodos(false);
  };

  const cancelar = () => {
    if (items.length && !window.confirm("¿Descartar los productos de esta compra?")) return;
    limpiar();
    router.push("/");
  };

  const confirmar = () =>
    void ejecutar(async () => {
      if (!proveedor) throw new Error("Elige el proveedor de la compra.");
      const compra = await enviar<{ id: number; total: string }>("POST", "/compras", {
        proveedorId: proveedor,
        detalles: items.map((i) => ({
          productoId: i.producto.id,
          cantidad: Number(i.cantidad),
          costoUnit: Number(i.costo),
          ...(i.vencimiento && { fechaVencimiento: i.vencimiento }),
        })),
      });
      setAviso(
        `Compra #${compra.id} a ${nombreDe(proveedores, proveedor)} registrada: ${items.length} línea(s) por ${bs.format(Number(compra.total))}. El stock ya está actualizado.`,
      );
      limpiar();
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <AppHeader titulo="Compra" subtitulo="Escanea o elige los productos que llegaron del proveedor" />
      <EstadoCarga cargando={productosQ.cargando} error={errorCarga} />

      {aviso && (
        <Card className="flex-row items-center gap-3 border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm">{aviso}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Columna izquierda: filtros y productos */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                aria-label="Proveedor de la compra"
                value={proveedorId}
                disabled={items.length > 0 && !!proveedor}
                title={items.length > 0 ? "Vacía la lista para cambiar de proveedor" : undefined}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">Elige el proveedor…</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
              <Select aria-label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <CodigoInput onCodigo={onCodigo} />

            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar producto"
              />
            </div>

            {proveedor && (
              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={verTodos}
                  onChange={(e) => setVerTodos(e.target.checked)}
                />
                Mostrar también productos de otros proveedores
              </label>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibles.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  categoria={nombreDe(categorias, p.categoriaId)}
                  enLista={enLista(p)}
                  modo="compra"
                  onClick={() => agregar(p)}
                />
              ))}
              {visibles.length === 0 && !productosQ.cargando && (
                <p className="text-muted-foreground col-span-full py-10 text-center text-sm">
                  No hay productos con esos filtros.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Columna derecha: lista de la compra */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>Lista de productos</CardTitle>
            <CardDescription>
              {proveedor ? `Proveedor: ${nombreDe(proveedores, proveedor)}` : "Elige el proveedor y agrega productos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {items.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
                <PackageOpen className="size-8" aria-hidden />
                Toca un producto o escanea su código para agregarlo.
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((i, n) => {
                  const p = i.producto;
                  const kg = p.unidadMedida === "kg";
                  return (
                    <li key={i.uid} className="flex flex-col gap-2 py-3">
                      <div className="flex items-center gap-3">
                        <ImagenProducto producto={p} className="size-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nombre}</p>
                          <p className="text-muted-foreground text-xs">{nombreDe(categorias, p.categoriaId)}</p>
                        </div>
                        <span className="text-right text-sm font-medium tabular-nums">
                          {bs.format(importe(Number(i.cantidad) || 0, Number(i.costo) || 0))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Quitar ${p.nombre}`}
                          onClick={() => setItems((prev) => prev.filter((x) => x.uid !== i.uid))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_1.3fr_auto] items-end gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs">{kg ? "Cantidad (kg)" : "Cantidad"}</span>
                          <Input
                            type="number"
                            {...pasoCantidad(p.unidadMedida)}
                            className="h-8 tabular-nums"
                            value={i.cantidad}
                            aria-invalid={!!errores[n] && errores[n] !== "Falta el costo"}
                            onChange={(e) => editar(i.uid, { cantidad: e.target.value })}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs">{kg ? "Costo / kg" : "Costo unit."}</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            className="h-8 tabular-nums"
                            value={i.costo}
                            aria-invalid={errores[n] === "Falta el costo"}
                            onChange={(e) => editar(i.uid, { costo: e.target.value })}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs">Vence</span>
                          <Input
                            type="date"
                            className="h-8"
                            value={i.vencimiento}
                            onChange={(e) => editar(i.uid, { vencimiento: e.target.value })}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Agregar otro lote con otra fecha de vencimiento"
                          aria-label={`Otro lote de ${p.nombre}`}
                          onClick={() => otroLote(i)}
                        >
                          <CalendarPlus />
                        </Button>
                      </div>
                      {errores[n] && <p className="text-destructive text-xs">{errores[n]}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>

          <div className="flex flex-col gap-4 border-t px-6 pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Total de la compra</span>
              <span className="text-3xl font-semibold tabular-nums">{bs.format(total)}</span>
            </div>
            <ErrorEnvio>{errorEnvio}</ErrorEnvio>
            {items.length > 0 && !proveedor && (
              <p className="text-sm text-amber-600">Elige el proveedor de la compra.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={cancelar}>
                Cancelar
              </Button>
              <Button
                size="lg"
                onClick={confirmar}
                disabled={items.length === 0 || !proveedor || hayErrores || enviando}
              >
                {enviando ? "Registrando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
