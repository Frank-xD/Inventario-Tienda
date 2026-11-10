"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PackageOpen, Plus, Trash2 } from "lucide-react";
import { bs, enviar } from "@/lib/api";
import {
  errorCantidad,
  formatCantidad,
  importe,
  pasoCantidad,
  sufijoPrecio,
  sumarCantidad,
} from "@/lib/cantidad";
import { nombreDe, type Producto } from "@/lib/modelos";
import { useCategorias, useProductos, useProveedores } from "@/hooks/use-datos";
import { ErrorEnvio, EstadoCarga, useEnvio } from "@/components/admin/comun";
import { AppHeader } from "@/components/nav/app-header";
import { CodigoInput } from "@/components/scanner/codigo-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ItemCompra {
  key: string;
  producto: Producto;
  cantidad: number;
  costo: number;
  vencimiento: string; // yyyy-mm-dd o ""
}

const fecha = new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });

/** Registro de compra a un proveedor: suma stock, fija el costo y crea lotes. */
export function Compra() {
  const router = useRouter();
  const productosQ = useProductos();
  const proveedoresQ = useProveedores();
  const categoriasQ = useCategorias();
  const productos = useMemo(() => (productosQ.data ?? []).filter((p) => p.activo), [productosQ.data]);
  const proveedores = (proveedoresQ.data ?? []).filter((p) => p.activo);
  const categorias = (categoriasQ.data ?? []).filter((c) => c.activa);
  const errorCarga = productosQ.error ?? proveedoresQ.error ?? categoriasQ.error;
  const { enviando, error: errorEnvio, ejecutar } = useEnvio();
  // Proveedor de la compra: se fija al agregar el primer producto.
  const [proveedorCompra, setProveedorCompra] = useState<number | null>(null);
  const [proveedorId, setProveedorId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [costo, setCosto] = useState("");
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const proveedorFijo = items.length > 0 ? proveedorCompra : null;
  const proveedorFiltro = proveedorFijo ?? (proveedorId ? Number(proveedorId) : null);

  const opcionesProducto = useMemo(
    () =>
      productos.filter(
        (p) =>
          (!proveedorFiltro || p.proveedorId === proveedorFiltro) &&
          (!categoriaId || p.categoriaId === Number(categoriaId)),
      ),
    [productos, proveedorFiltro, categoriaId],
  );

  const producto = productos.find((p) => p.id === Number(productoId));
  const total = items.reduce((s, i) => s + importe(i.cantidad, i.costo), 0);

  const elegirProducto = (p: Producto) => {
    if (!proveedorFijo && p.proveedorId) setProveedorId(String(p.proveedorId));
    setCategoriaId(String(p.categoriaId));
    setProductoId(String(p.id));
    setCosto(p.costo.toFixed(2));
    setAviso(null);
  };

  const onCodigo = (codigo: string) => {
    const p = productos.find((x) => x.codigoBarras === codigo);
    if (!p) return `No hay un producto activo con el código ${codigo}.`;
    if (proveedorFijo && p.proveedorId && p.proveedorId !== proveedorFijo)
      return `${p.nombre} es de ${nombreDe(proveedores, p.proveedorId)}; esta compra es de ${nombreDe(proveedores, proveedorFijo)}.`;
    elegirProducto(p);
    return null;
  };

  const kg = producto?.unidadMedida === "kg";
  const cant = Number(cantidad);
  const cost = Number(costo);
  // Por unidad, entera; por kg, hasta 3 decimales (lo mismo exige la BD).
  const errorCant = producto && cantidad !== "" ? errorCantidad(cant, producto.unidadMedida) : null;
  // Proveedor al que se le compra: el elegido o, si no, el del producto.
  const proveedorParaAgregar = proveedorFijo ?? (Number(proveedorId) || producto?.proveedorId || null);
  const puedeAgregar =
    !!producto && !!proveedorParaAgregar && cantidad !== "" && !errorCant && cost >= 0 && costo !== "";

  const agregar = () => {
    if (!producto || !puedeAgregar) return;
    if (!proveedorFijo) setProveedorCompra(proveedorParaAgregar);
    setItems((prev) => {
      const key = `${producto.id}-${vencimiento}`;
      const existente = prev.find((i) => i.key === key);
      if (existente)
        return prev.map((i) =>
          i.key === key ? { ...i, cantidad: sumarCantidad(i.cantidad, cant), costo: cost } : i,
        );
      return [...prev, { key, producto, cantidad: cant, costo: cost, vencimiento }];
    });
    setProductoId("");
    setCantidad("1");
    setCosto("");
    setVencimiento("");
  };

  const limpiar = () => {
    setItems([]);
    setProveedorCompra(null);
    setProductoId("");
    setCategoriaId("");
    setProveedorId("");
    setCantidad("1");
    setCosto("");
    setVencimiento("");
  };

  const cancelar = () => {
    if (items.length && !window.confirm("¿Descartar los productos de esta compra?")) return;
    limpiar();
    router.push("/");
  };

  const confirmar = () =>
    void ejecutar(async () => {
      if (!proveedorFijo) return;
      const compra = await enviar<{ id: number; total: string }>("POST", "/compras", {
        proveedorId: proveedorFijo,
        detalles: items.map((i) => ({
          productoId: i.producto.id,
          cantidad: i.cantidad,
          costoUnit: i.costo,
          ...(i.vencimiento && { fechaVencimiento: i.vencimiento }),
        })),
      });
      setAviso(
        `Compra #${compra.id} a ${nombreDe(proveedores, proveedorFijo)} registrada: ${items.length} producto(s) por ${bs.format(Number(compra.total))}. El stock ya está actualizado.`,
      );
      limpiar();
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <AppHeader titulo="Compra" subtitulo="Ingreso de mercadería de un proveedor" />
      <EstadoCarga cargando={productosQ.cargando} error={errorCarga} />

      {aviso && (
        <Card className="flex-row items-center gap-3 border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm">{aviso}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Columna izquierda: formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Agregar producto</CardTitle>
            <CardDescription>Elige el producto o escanea su código.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo label="Proveedor" htmlFor="c-proveedor">
              <Select
                id="c-proveedor"
                value={proveedorFijo ? String(proveedorFijo) : proveedorId}
                disabled={!!proveedorFijo}
                onChange={(e) => {
                  setProveedorId(e.target.value);
                  setProductoId("");
                }}
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Categoría" htmlFor="c-categoria">
              <Select
                id="c-categoria"
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setProductoId("");
                }}
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Producto" htmlFor="c-producto">
              <Select
                id="c-producto"
                value={productoId}
                onChange={(e) => {
                  const p = productos.find((x) => x.id === Number(e.target.value));
                  if (p) elegirProducto(p);
                  else setProductoId("");
                }}
              >
                <option value="">Selecciona un producto…</option>
                {opcionesProducto.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo label="Código manual">
              <CodigoInput onCodigo={onCodigo} />
            </Campo>

            <div className="grid grid-cols-3 gap-3">
              <Campo label="Vence" htmlFor="c-vence">
                <Input
                  id="c-vence"
                  type="date"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
              </Campo>
              <Campo label={kg ? "Cantidad (kg)" : "Cantidad"} htmlFor="c-cantidad">
                <Input
                  id="c-cantidad"
                  type="number"
                  {...pasoCantidad(producto?.unidadMedida)}
                  value={cantidad}
                  aria-invalid={!!errorCant}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="tabular-nums"
                />
              </Campo>
              <Campo label={kg ? "Costo por kg (Bs)" : "Costo unit. (Bs)"} htmlFor="c-costo">
                <Input
                  id="c-costo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  className="tabular-nums"
                />
              </Campo>
            </div>
            {errorCant && <p className="text-destructive -mt-2 text-xs">{errorCant}</p>}
            {producto && !proveedorParaAgregar && (
              <p className="text-destructive -mt-2 text-xs">Elige el proveedor al que le compras.</p>
            )}

            <Button onClick={agregar} disabled={!puedeAgregar}>
              <Plus /> Agregar a la lista
            </Button>
          </CardContent>
        </Card>

        {/* Columna derecha: lista */}
        <Card className="min-h-96">
          <CardHeader>
            <CardTitle>Lista de productos</CardTitle>
            <CardDescription>
              {proveedorFijo ? `Proveedor: ${nombreDe(proveedores, proveedorFijo)}` : "Aún no agregaste productos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {items.length === 0 ? (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-10 text-sm">
                <PackageOpen className="size-8" aria-hidden />
                Los productos que agregues aparecerán aquí.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.key}>
                      <TableCell>
                        <div className="font-medium">{i.producto.nombre}</div>
                        <div className="text-muted-foreground text-xs">
                          {nombreDe(categorias, i.producto.categoriaId)}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {i.vencimiento ? fecha.format(new Date(i.vencimiento)) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCantidad(i.cantidad, i.producto.unidadMedida)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {bs.format(i.costo)}
                        <span className="text-muted-foreground text-xs">{sufijoPrecio(i.producto.unidadMedida)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {bs.format(importe(i.cantidad, i.costo))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${i.producto.nombre}`}
                          onClick={() => setItems((prev) => prev.filter((x) => x.key !== i.key))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {errorEnvio && (
            <div className="px-6">
              <ErrorEnvio>{errorEnvio}</ErrorEnvio>
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t px-6 pt-6">
            <div>
              <p className="text-muted-foreground text-sm">Total de la compra</p>
              <p className="text-2xl font-semibold tabular-nums">{bs.format(total)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelar}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={items.length === 0 || enviando}>
                {enviando ? "Registrando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
