"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, Minus, Plus, Scale, Search, ShoppingCart, Smartphone, Tag, Trash2 } from "lucide-react";
import { bs, enviar, type MetodoPago } from "@/lib/api";
import { errorCantidad, formatCantidad, importeVenta, pasoCantidad } from "@/lib/cantidad";
import { nombreDe, type Producto } from "@/lib/modelos";
import { cn } from "@/lib/utils";
import { useCaja, useCategorias, useProductos, useProveedores } from "@/hooks/use-datos";
import { AppHeader } from "@/components/nav/app-header";
import { CodigoInput } from "@/components/scanner/codigo-input";
import { Campo, ErrorEnvio, EstadoCarga, useEnvio } from "@/components/admin/comun";
import { ImagenProducto, TarjetaProducto } from "@/components/productos/tarjeta-producto";
import { BarraCaja } from "./caja";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ItemVenta {
  producto: Producto;
  cantidad: number;
}

/** Registro de venta: descuenta stock y suma a la caja abierta. */
export function Venta() {
  const router = useRouter();
  const productosQ = useProductos();
  const proveedoresQ = useProveedores();
  const categoriasQ = useCategorias();
  const cajaQ = useCaja();
  // Solo se venden productos activos de categorías activas.
  const productos = useMemo(() => {
    const ocultas = new Set((categoriasQ.data ?? []).filter((c) => !c.activa).map((c) => c.id));
    return (productosQ.data ?? []).filter((p) => p.activo && !ocultas.has(p.categoriaId));
  }, [productosQ.data, categoriasQ.data]);
  const proveedores = (proveedoresQ.data ?? []).filter((p) => p.activo);
  const categorias = (categoriasQ.data ?? []).filter((c) => c.activa);
  const caja = cajaQ.data?.caja ?? null;
  const errorCarga = productosQ.error ?? cajaQ.error ?? proveedoresQ.error ?? categoriasQ.error;
  const { enviando, error: errorEnvio, setError: setErrorEnvio, ejecutar } = useEnvio();
  const [proveedorId, setProveedorId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [recibido, setRecibido] = useState("");
  // Descuento manual sobre el total: en Bs o en %.
  const [descuento, setDescuento] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState<"bs" | "pct">("bs");
  const [aviso, setAviso] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!proveedorId || p.proveedorId === Number(proveedorId)) &&
        (!categoriaId || p.categoriaId === Number(categoriaId)) &&
        (!q || p.nombre.toLowerCase().includes(q)),
    );
  }, [productos, proveedorId, categoriaId, busqueda]);

  // Producto por kg cuyo peso se está ingresando.
  const [pesando, setPesando] = useState<Producto | null>(null);

  // Cada línea se redondea al centavo, igual que el backend.
  const subtotal = Math.round(items.reduce((s, i) => s + importeVenta(i.cantidad, i.producto.precio, i.producto.unidadMedida), 0) * 100) / 100;
  const valorDescuento = Number(descuento) || 0;
  const montoDescuento =
    Math.round((tipoDescuento === "pct" ? (subtotal * valorDescuento) / 100 : valorDescuento) * 100) / 100;
  const errorDescuento =
    valorDescuento < 0
      ? "El descuento no puede ser negativo."
      : tipoDescuento === "pct" && valorDescuento > 100
        ? "El descuento no puede superar el 100 %."
        : montoDescuento > subtotal
          ? "El descuento supera el subtotal."
          : null;
  const total = Math.round((subtotal - (errorDescuento ? 0 : montoDescuento)) * 100) / 100;
  const cambio = Number(recibido) - total;
  const enCarrito = (p: Producto) => items.find((i) => i.producto.id === p.id)?.cantidad ?? 0;

  /** Fija la cantidad del producto en la venta; devuelve un error si se pasa del stock. */
  const fijarCantidad = (p: Producto, nueva: number): string | null => {
    if (nueva > p.stock)
      return p.stock <= 0
        ? `${p.nombre} está agotado.`
        : `Solo hay ${formatCantidad(p.stock, p.unidadMedida)} de ${p.nombre}.`;
    setAviso(null);
    setErrorEnvio(null);
    setItems((prev) => {
      if (nueva <= 0) return prev.filter((i) => i.producto.id !== p.id);
      if (!prev.some((i) => i.producto.id === p.id)) return [...prev, { producto: p, cantidad: nueva }];
      return prev.map((i) => (i.producto.id === p.id ? { ...i, cantidad: nueva } : i));
    });
    return null;
  };

  /** Por unidad suma 1; por kg abre la ventana para ingresar el peso. */
  const agregar = (p: Producto): string | null => {
    if (p.unidadMedida === "kg") {
      if (p.stock <= 0) return `${p.nombre} está agotado.`;
      setPesando(p);
      return null;
    }
    return fijarCantidad(p, enCarrito(p) + 1);
  };

  const onCodigo = (codigo: string) => {
    const p = productos.find((x) => x.codigoBarras === codigo);
    if (!p) return `No hay un producto a la venta con el código ${codigo}.`;
    return agregar(p);
  };

  const limpiar = () => {
    setItems([]);
    setRecibido("");
    setDescuento("");
    setTipoDescuento("bs");
    setMetodo("efectivo");
  };

  const cancelar = () => {
    if (items.length && !window.confirm("¿Descartar esta venta?")) return;
    limpiar();
    router.push("/");
  };

  const confirmar = () =>
    void ejecutar(async () => {
      // El backend vuelve a validar stock, unidad (enteros) y que la caja esté abierta.
      const venta = await enviar<{ id: number; total: string }>("POST", "/ventas", {
        metodoPago: metodo,
        descuento: montoDescuento,
        items: items.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad })),
      });
      const vuelto = metodo === "efectivo" && recibido ? ` · cambio ${bs.format(cambio)}` : "";
      const conDescuento = montoDescuento > 0 ? ` (descuento ${bs.format(montoDescuento)})` : "";
      setAviso(
        `Venta #${venta.id} registrada: ${bs.format(Number(venta.total))}${conDescuento} en ${metodo === "efectivo" ? "efectivo" : "transferencia/QR"}${vuelto}.`,
      );
      limpiar();
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <AppHeader titulo="Venta" subtitulo="Escanea o elige los productos que se llevan" />
      <EstadoCarga cargando={productosQ.cargando} error={errorCarga} />
      <BarraCaja caja={caja} cargando={cajaQ.cargando} />

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
                aria-label="Proveedor"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Categoría"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
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
                placeholder="Buscar por nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar producto por nombre"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibles.map((p) => {
                const cantidad = enCarrito(p);
                // Por kg se puede volver a tocar para corregir el peso.
                const sinMas = p.unidadMedida === "kg" ? p.stock <= 0 : cantidad >= p.stock;
                return (
                  <TarjetaProducto
                    key={p.id}
                    producto={p}
                    categoria={nombreDe(categorias, p.categoriaId)}
                    enLista={cantidad}
                    modo="venta"
                    disabled={sinMas}
                    onClick={() => agregar(p)}
                  />
                );
              })}
              {visibles.length === 0 && (
                <p className="text-muted-foreground col-span-full py-10 text-center text-sm">
                  No hay productos con esos filtros.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Columna derecha: lista de la venta */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>Lista de productos</CardTitle>
            <CardDescription>
              {items.length ? `${items.length} producto(s)` : "Escanea o toca un producto para agregarlo"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {items.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
                <ShoppingCart className="size-8" aria-hidden />
                La venta está vacía.
              </div>
            ) : (
              <ul className="divide-y">
                {items.map(({ producto: p, cantidad }) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <ImagenProducto producto={p} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nombre}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {bs.format(p.precio)}
                        {p.unidadMedida === "kg" ? " / kg" : " c/u"}
                      </p>
                    </div>
                    {p.unidadMedida === "kg" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label={`Quitar ${p.nombre}`}
                          onClick={() => fijarCantidad(p, 0)}
                        >
                          <Trash2 />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 min-w-20 tabular-nums"
                          title="Cambiar el peso"
                          aria-label={`Cambiar el peso de ${p.nombre}`}
                          onClick={() => setPesando(p)}
                        >
                          <Scale className="size-3.5" /> {formatCantidad(cantidad, "kg")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label={`Quitar una unidad de ${p.nombre}`}
                          onClick={() => fijarCantidad(p, cantidad - 1)}
                        >
                          {cantidad === 1 ? <Trash2 /> : <Minus />}
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">{cantidad}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label={`Agregar una unidad de ${p.nombre}`}
                          disabled={cantidad >= p.stock}
                          onClick={() => fijarCantidad(p, cantidad + 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                    )}
                    <span className="w-20 text-right text-sm font-medium tabular-nums">
                      {bs.format(importeVenta(cantidad, p.precio, p.unidadMedida))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>

          <div className="flex flex-col gap-4 border-t px-6 pt-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{bs.format(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="v-descuento" className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Tag className="size-3.5" /> Descuento
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    id="v-descuento"
                    type="number"
                    min={0}
                    step={tipoDescuento === "pct" ? 1 : 0.5}
                    max={tipoDescuento === "pct" ? 100 : undefined}
                    inputMode="decimal"
                    placeholder="0"
                    className="h-8 w-24 text-right tabular-nums"
                    aria-invalid={!!errorDescuento}
                    value={descuento}
                    onChange={(e) => setDescuento(e.target.value)}
                  />
                  <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label="Tipo de descuento">
                    {(["bs", "pct"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={tipoDescuento === t}
                        onClick={() => setTipoDescuento(t)}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium",
                          tipoDescuento === t
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t === "bs" ? "Bs" : "%"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {errorDescuento ? (
                <p className="text-destructive text-right text-xs">{errorDescuento}</p>
              ) : (
                montoDescuento > 0 && (
                  <p className="text-right text-xs text-emerald-600 tabular-nums">− {bs.format(montoDescuento)}</p>
                )
              )}
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="text-3xl font-semibold tabular-nums">{bs.format(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
              <Button
                variant={metodo === "efectivo" ? "default" : "outline"}
                role="radio"
                aria-checked={metodo === "efectivo"}
                onClick={() => setMetodo("efectivo")}
              >
                <Banknote /> Efectivo
              </Button>
              <Button
                variant={metodo === "transferencia" ? "default" : "outline"}
                role="radio"
                aria-checked={metodo === "transferencia"}
                onClick={() => setMetodo("transferencia")}
              >
                <Smartphone /> Transferencia / QR
              </Button>
            </div>

            {metodo === "efectivo" && (
              <div className="grid grid-cols-2 items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Recibido (Bs)"
                  aria-label="Monto recibido"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  className="tabular-nums"
                />
                <p className="text-right text-sm">
                  <span className="text-muted-foreground">Cambio: </span>
                  <span className={`font-semibold tabular-nums ${cambio < 0 ? "text-destructive" : ""}`}>
                    {recibido ? bs.format(cambio) : "—"}
                  </span>
                </p>
              </div>
            )}

            <ErrorEnvio>{errorEnvio}</ErrorEnvio>
            {!caja && !cajaQ.cargando && items.length > 0 && (
              <p className="text-sm text-amber-600">Abre la caja para poder cobrar.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={cancelar}>
                Cancelar
              </Button>
              <Button
                size="lg"
                onClick={confirmar}
                disabled={
                  items.length === 0 ||
                  !caja ||
                  enviando ||
                  !!errorDescuento ||
                  (metodo === "efectivo" && !!recibido && cambio < 0)
                }
              >
                {enviando ? "Cobrando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={pesando !== null}
        onOpenChange={(o) => !o && setPesando(null)}
        titulo={pesando ? pesando.nombre : ""}
        descripcion={pesando ? `${bs.format(pesando.precio)} / kg · ${formatCantidad(pesando.stock, "kg")} disponibles` : undefined}
        className="max-w-sm"
      >
        {pesando && (
          <FormPeso
            key={pesando.id}
            producto={pesando}
            inicial={enCarrito(pesando)}
            onConfirmar={(kg) => {
              const err = fijarCantidad(pesando, kg);
              if (!err) setPesando(null);
              return err;
            }}
          />
        )}
      </Modal>
    </div>
  );
}

const ATAJOS_KG = [0.25, 0.5, 1, 2];

/** Peso de un producto por kg: en kg, o por el monto en Bs que pide el cliente. */
function FormPeso({
  producto,
  inicial,
  onConfirmar,
}: {
  producto: Producto;
  inicial: number;
  onConfirmar: (kg: number) => string | null;
}) {
  const [kg, setKg] = useState(inicial ? String(inicial) : "");
  const [monto, setMonto] = useState(inicial ? importeVenta(inicial, producto.precio, "kg").toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);

  const cantidad = Number(kg);
  const valido = kg !== "" && !errorCantidad(cantidad, "kg");

  const desdeKg = (v: string) => {
    setKg(v);
    setMonto(v === "" ? "" : importeVenta(Number(v), producto.precio, "kg").toFixed(2));
    setError(null);
  };
  const desdeMonto = (v: string) => {
    setMonto(v);
    // Bs → kg, redondeado al gramo.
    setKg(v === "" ? "" : String(Math.round((Number(v) / producto.precio) * 1000) / 1000));
    setError(null);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err = errorCantidad(cantidad, "kg") ?? onConfirmar(cantidad);
        setError(err);
      }}
    >
      <div className="grid grid-cols-4 gap-2">
        {ATAJOS_KG.map((v) => (
          <Button
            key={v}
            type="button"
            variant={cantidad === v ? "default" : "outline"}
            size="sm"
            onClick={() => desdeKg(String(v))}
          >
            {formatCantidad(v, "kg")}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Peso (kg)" htmlFor="peso-kg">
          <Input
            id="peso-kg"
            type="number"
            autoFocus
            {...pasoCantidad("kg")}
            className="tabular-nums"
            value={kg}
            onChange={(e) => desdeKg(e.target.value)}
          />
        </Campo>
        <Campo label="o por monto (Bs)" htmlFor="peso-bs">
          <Input
            id="peso-bs"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="tabular-nums"
            value={monto}
            onChange={(e) => desdeMonto(e.target.value)}
          />
        </Campo>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="lg" disabled={!valido}>
        {valido
          ? `Agregar ${formatCantidad(cantidad, "kg")} · ${bs.format(importeVenta(cantidad, producto.precio, "kg"))}`
          : "Ingresa el peso"}
      </Button>
    </form>
  );
}
