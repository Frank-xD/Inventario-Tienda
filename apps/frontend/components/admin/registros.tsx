"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { api, bs, enviar, type MetodoPago, type UnidadMedida } from "@/lib/api";
import { formatCantidad, importe, importeVenta } from "@/lib/cantidad";
import { cn } from "@/lib/utils";
import { useLiveData } from "@/hooks/use-live-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Buscador, Campo, ErrorEnvio, EstadoCarga, SinResultados, Titulo, useEnvio } from "./comun";

interface ProductoLinea {
  id: number;
  nombre: string;
  unidadMedida: UnidadMedida;
}

interface VentaApi {
  id: number;
  fecha: string;
  subtotal: string;
  descuento: string;
  total: string;
  metodoPago: MetodoPago;
  estado: "completada" | "anulada";
  motivoAnulacion: string | null;
  detalles: { id: number; cantidad: string; precioUnit: string; descuento: string; producto: ProductoLinea }[];
}

interface CompraApi {
  id: number;
  fecha: string;
  total: string;
  proveedor: { id: number; nombre: string };
  detalles: {
    id: number;
    cantidad: string;
    costoUnit: string;
    fechaVencimiento: string | null;
    producto: ProductoLinea;
  }[];
}

/** Ventas y compras en una sola lista. */
type Registro =
  | { tipo: "venta"; id: number; fecha: string; total: number; venta: VentaApi }
  | { tipo: "compra"; id: number; fecha: string; total: number; compra: CompraApi };

type Filtro = "todos" | "venta" | "compra";

const LIMITE = 200;
const fechaHora = new Intl.DateTimeFormat("es-BO", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/La_Paz",
});
const fechaCorta = new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });

const resumenProductos = (lineas: { producto: ProductoLinea }[]) => {
  const nombres = lineas.map((l) => l.producto.nombre);
  return nombres.length <= 2 ? nombres.join(", ") : `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;
};

export function Registros() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<VentaApi | null>(null);

  const rango = `${desde ? `&desde=${desde}` : ""}${hasta ? `&hasta=${hasta}` : ""}`;
  const fetchVentas = useCallback(() => api<VentaApi[]>(`/ventas?limite=${LIMITE}${rango}`), [rango]);
  const fetchCompras = useCallback(() => api<CompraApi[]>(`/compras?limite=${LIMITE}${rango}`), [rango]);
  const ventas = useLiveData(fetchVentas, ["venta:registrada", "venta:anulada"]);
  const compras = useLiveData(fetchCompras, ["compra:registrada"]);

  const registros = useMemo<Registro[]>(() => {
    const vs: Registro[] = (ventas.data ?? []).map((v) => ({
      tipo: "venta",
      id: v.id,
      fecha: v.fecha,
      total: Number(v.total),
      venta: v,
    }));
    const cs: Registro[] = (compras.data ?? []).map((c) => ({
      tipo: "compra",
      id: c.id,
      fecha: c.fecha,
      total: Number(c.total),
      compra: c,
    }));
    return [...vs, ...cs].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventas.data, compras.data]);

  const texto = q.trim().toLowerCase();
  const visibles = registros.filter((r) => {
    if (filtro !== "todos" && r.tipo !== filtro) return false;
    if (!texto) return true;
    const lineas = r.tipo === "venta" ? r.venta.detalles : r.compra.detalles;
    const extra = r.tipo === "compra" ? r.compra.proveedor.nombre : r.venta.metodoPago;
    return `#${r.id} ${extra} ${lineas.map((l) => l.producto.nombre).join(" ")}`.toLowerCase().includes(texto);
  });

  const ventasOk = visibles.filter((r) => r.tipo === "venta" && r.venta.estado === "completada");
  const comprasVis = visibles.filter((r) => r.tipo === "compra");
  const sumar = (rs: Registro[]) => rs.reduce((s, r) => s + r.total, 0);
  const cargando = !ventas.data || !compras.data;
  const error = ventas.error ?? compras.error;

  return (
    <>
      <Titulo descripcion={desde || hasta ? "Registros del período elegido" : `Últimos ${LIMITE} de cada tipo`}>
        Registros
      </Titulo>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Tipo de registro">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "venta", label: "Ventas" },
              { id: "compra", label: "Compras" },
            ] as const
          ).map((f) => (
            <Button
              key={f.id}
              role="tab"
              aria-selected={filtro === f.id}
              size="sm"
              variant={filtro === f.id ? "default" : "outline"}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Desde</span>
          <Input type="date" className="h-8 w-40" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Hasta</span>
          <Input type="date" className="h-8 w-40" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {(desde || hasta) && (
          <Button variant="ghost" size="sm" onClick={() => (setDesde(""), setHasta(""))}>
            Quitar fechas
          </Button>
        )}
        <Buscador value={q} onChange={setQ} placeholder="Buscar por N.º, producto o proveedor" />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <Resumen label="Vendido" valor={bs.format(sumar(ventasOk))} detalle={`${ventasOk.length} ventas completadas`} />
        <Resumen
          label="Anuladas"
          valor={String(visibles.filter((r) => r.tipo === "venta" && r.venta.estado === "anulada").length)}
          detalle="No suman al total"
        />
        <Resumen label="Comprado" valor={bs.format(sumar(comprasVis))} detalle={`${comprasVis.length} compras`} />
        <Resumen
          label="Diferencia"
          valor={bs.format(sumar(ventasOk) - sumar(comprasVis))}
          detalle="Vendido − comprado (no es la ganancia)"
        />
      </section>

      <EstadoCarga cargando={cargando && !error} error={error} />
      {!cargando && (
        <Card className="py-2">
          <CardContent className="px-2">
            {visibles.length === 0 ? (
              <SinResultados>No hay registros con esos filtros.</SinResultados>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Tipo</TableHead>
                    <TableHead>N.º</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Pago / proveedor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((r) => {
                    const clave = `${r.tipo}-${r.id}`;
                    const expandido = abierto === clave;
                    const anulada = r.tipo === "venta" && r.venta.estado === "anulada";
                    const lineas = r.tipo === "venta" ? r.venta.detalles : r.compra.detalles;
                    return (
                      <Fragment key={clave}>
                        <TableRow
                          className={cn("cursor-pointer", anulada && "text-muted-foreground")}
                          onClick={() => setAbierto(expandido ? null : clave)}
                          aria-expanded={expandido}
                        >
                          <TableCell>
                            {expandido ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5">
                              {r.tipo === "venta" ? (
                                <ArrowUpRight className="size-3.5 text-emerald-600" />
                              ) : (
                                <ArrowDownLeft className="size-3.5 text-sky-600" />
                              )}
                              {r.tipo === "venta" ? "Venta" : "Compra"}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">#{r.id}</TableCell>
                          <TableCell className="tabular-nums">{fechaHora.format(new Date(r.fecha))}</TableCell>
                          <TableCell className="max-w-64 truncate">{resumenProductos(lineas)}</TableCell>
                          <TableCell>
                            {r.tipo === "venta"
                              ? r.venta.metodoPago === "efectivo"
                                ? "Efectivo"
                                : "Transferencia/QR"
                              : r.compra.proveedor.nombre}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", anulada && "line-through")}>
                            {bs.format(r.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.tipo === "compra" ? (
                              <Badge variant="secondary">Registrada</Badge>
                            ) : anulada ? (
                              <Badge variant="destructive">Anulada</Badge>
                            ) : (
                              <Badge variant="secondary">Completada</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandido && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell />
                            <TableCell colSpan={7} className="bg-muted/30 whitespace-normal">
                              {r.tipo === "venta" ? (
                                <DetalleVenta venta={r.venta} onAnular={() => setAnulando(r.venta)} />
                              ) : (
                                <DetalleCompra compra={r.compra} />
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        open={anulando !== null}
        onOpenChange={(o) => !o && setAnulando(null)}
        titulo={anulando ? `Anular venta #${anulando.id}` : ""}
        descripcion="El stock de los productos se devuelve y la venta deja de contar en la caja."
        className="max-w-sm"
      >
        {anulando && <FormAnular venta={anulando} onListo={() => setAnulando(null)} />}
      </Modal>
    </>
  );
}

function Resumen({ label, valor, detalle }: { label: string; valor: string; detalle: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-xl font-semibold tabular-nums">{valor}</div>
        <p className="text-muted-foreground mt-1 text-xs">{detalle}</p>
      </CardContent>
    </Card>
  );
}

function DetalleVenta({ venta, onAnular }: { venta: VentaApi; onAnular: () => void }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th className="py-1 text-left font-medium">Producto</th>
            <th className="py-1 text-right font-medium">Cantidad</th>
            <th className="py-1 text-right font-medium">Precio</th>
            <th className="py-1 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          {venta.detalles.map((d) => (
            <tr key={d.id}>
              <td className="py-1">{d.producto.nombre}</td>
              <td className="py-1 text-right tabular-nums">{formatCantidad(d.cantidad, d.producto.unidadMedida)}</td>
              <td className="py-1 text-right tabular-nums">
                {bs.format(Number(d.precioUnit))}
                {d.producto.unidadMedida === "kg" ? " / kg" : ""}
              </td>
              <td className="py-1 text-right tabular-nums">
                {bs.format(importeVenta(Number(d.cantidad), Number(d.precioUnit), d.producto.unidadMedida) - Number(d.descuento))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-2 text-sm">
        <div className="text-muted-foreground">
          {venta.estado === "anulada" ? (
            <span className="text-destructive">Anulada: {venta.motivoAnulacion}</span>
          ) : (
            <Button variant="outline" size="sm" onClick={onAnular}>
              <Ban /> Anular venta
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-right">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{bs.format(Number(venta.subtotal))}</dd>
          {Number(venta.descuento) > 0 && (
            <>
              <dt className="text-muted-foreground">Descuento</dt>
              <dd className="text-emerald-600 tabular-nums">− {bs.format(Number(venta.descuento))}</dd>
            </>
          )}
          <dt className="font-medium">Total</dt>
          <dd className="font-semibold tabular-nums">{bs.format(Number(venta.total))}</dd>
        </dl>
      </div>
    </div>
  );
}

function DetalleCompra({ compra }: { compra: CompraApi }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground text-xs">
        <tr>
          <th className="py-1 text-left font-medium">Producto</th>
          <th className="py-1 text-right font-medium">Cantidad</th>
          <th className="py-1 text-right font-medium">Costo</th>
          <th className="py-1 text-right font-medium">Vence</th>
          <th className="py-1 text-right font-medium">Importe</th>
        </tr>
      </thead>
      <tbody>
        {compra.detalles.map((d) => (
          <tr key={d.id}>
            <td className="py-1">{d.producto.nombre}</td>
            <td className="py-1 text-right tabular-nums">{formatCantidad(d.cantidad, d.producto.unidadMedida)}</td>
            <td className="py-1 text-right tabular-nums">
              {bs.format(Number(d.costoUnit))}
              {d.producto.unidadMedida === "kg" ? " / kg" : ""}
            </td>
            <td className="py-1 text-right tabular-nums">
              {d.fechaVencimiento ? fechaCorta.format(new Date(d.fechaVencimiento)) : "—"}
            </td>
            <td className="py-1 text-right tabular-nums">
              {bs.format(importe(Number(d.cantidad), Number(d.costoUnit)))}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t">
          <td colSpan={4} className="pt-2 text-right font-medium">
            Total
          </td>
          <td className="pt-2 text-right font-semibold tabular-nums">{bs.format(Number(compra.total))}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function FormAnular({ venta, onListo }: { venta: VentaApi; onListo: () => void }) {
  const { enviando, error, ejecutar } = useEnvio();
  const [motivo, setMotivo] = useState("");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(async () => {
          await enviar("POST", `/ventas/${venta.id}/anular`, { motivo: motivo.trim() });
          onListo();
        });
      }}
    >
      <p className="text-sm">
        Total: <strong className="tabular-nums">{bs.format(Number(venta.total))}</strong>
      </p>
      <Campo label="Motivo" htmlFor="anular-motivo">
        <Textarea
          id="anular-motivo"
          required
          autoFocus
          placeholder="Ej.: el cliente devolvió el producto, error al cobrar…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>
      <ErrorEnvio>{error}</ErrorEnvio>
      <Button type="submit" variant="destructive" size="lg" disabled={enviando || !motivo.trim()}>
        {enviando ? "Anulando…" : "Anular venta"}
      </Button>
    </form>
  );
}
