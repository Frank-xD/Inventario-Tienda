"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  ChevronDown,
  ChevronRight,
  Lock,
  LockOpen,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import {
  api,
  bs,
  enviar,
  type CajaActual,
  type MetodoPago,
  type MovimientoCajaApi,
  type ResumenCaja,
  type UnidadMedida,
} from "@/lib/api";
import { formatCantidad, importe, importeVenta } from "@/lib/cantidad";
import { cn } from "@/lib/utils";
import { useLiveData } from "@/hooks/use-live-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
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

/** Ventas, compras e ingresos/egresos extra de caja en una sola lista. */
type Registro =
  | { tipo: "venta"; id: number; fecha: string; total: number; venta: VentaApi }
  | { tipo: "compra"; id: number; fecha: string; total: number; compra: CompraApi }
  | { tipo: "movimiento"; id: number; fecha: string; total: number; mov: MovimientoCajaApi };

type Filtro = "todos" | "venta" | "compra" | "movimiento" | "caja";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "venta", label: "Ventas" },
  { id: "compra", label: "Compras" },
  { id: "movimiento", label: "Ingresos y egresos" },
  { id: "caja", label: "Cajas" },
];

const TIPO_LABEL = { venta: "Venta", compra: "Compra" } as const;

const LIMITE = 200;
const LIMITE_CAJAS = 365;

/** Fila de GET /cajas (vista v_resumen_caja). */
interface CajaHistorial extends ResumenCaja {
  cajaId: number;
  abiertaEn: string;
  cerradaEn: string | null;
}
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

// Piezas de un registro, compartidas por la tabla (escritorio) y la lista (celular).
const esEgreso = (r: Registro) => r.tipo === "movimiento" && r.mov.tipo === "egreso";
const esAnulada = (r: Registro) => r.tipo === "venta" && r.venta.estado === "anulada";

const etiquetaTipo = (r: Registro) =>
  r.tipo === "movimiento" ? (esEgreso(r) ? "Egreso" : "Ingreso") : TIPO_LABEL[r.tipo];

const detalleDe = (r: Registro) =>
  r.tipo === "movimiento" ? r.mov.motivo : resumenProductos(r.tipo === "venta" ? r.venta.detalles : r.compra.detalles);

const pagoDe = (r: Registro) =>
  r.tipo === "venta"
    ? r.venta.metodoPago === "efectivo"
      ? "Efectivo"
      : "Transferencia/QR"
    : r.tipo === "compra"
      ? r.compra.proveedor.nombre
      : `Efectivo · caja #${r.mov.cajaId}`;

function IconoRegistro({ r }: { r: Registro }) {
  if (r.tipo === "venta") return <ArrowUpRight className="size-3.5 shrink-0 text-emerald-600" />;
  if (r.tipo === "compra") return <ArrowDownLeft className="size-3.5 shrink-0 text-sky-600" />;
  return <Wallet className={cn("size-3.5 shrink-0", esEgreso(r) ? "text-destructive" : "text-emerald-600")} />;
}

function TotalRegistro({ r }: { r: Registro }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        esAnulada(r) && "line-through",
        r.tipo === "movimiento" && (esEgreso(r) ? "text-destructive" : "text-emerald-600"),
      )}
    >
      {r.tipo === "movimiento" && (esEgreso(r) ? "− " : "+ ")}
      {bs.format(r.total)}
    </span>
  );
}

function EstadoRegistro({ r }: { r: Registro }) {
  if (r.tipo !== "venta") return <Badge variant="secondary">Registrado</Badge>;
  return esAnulada(r) ? <Badge variant="destructive">Anulada</Badge> : <Badge variant="secondary">Completada</Badge>;
}

function DetalleRegistro({ r, onAnular }: { r: Registro; onAnular: (v: VentaApi) => void }) {
  if (r.tipo === "venta") return <DetalleVenta venta={r.venta} onAnular={() => onAnular(r.venta)} />;
  if (r.tipo === "compra") return <DetalleCompra compra={r.compra} />;
  return <DetalleMovimiento mov={r.mov} />;
}

/**
 * Tira de tarjetas de resumen: en celular se desliza de lado (no empuja la
 * lista hacia abajo); desde sm es una grilla.
 */
function TiraResumen({ children, columnasLg }: { children: React.ReactNode; columnasLg: 4 | 5 }) {
  return (
    <section
      className={cn(
        "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [&>*]:w-40 [&>*]:shrink-0 [&>*]:snap-start",
        "sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>*]:w-auto sm:[&>*]:min-w-0",
        columnasLg === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {children}
    </section>
  );
}

/**
 * Filtros en celular: buscador a la vista y un botón "Filtros" que despliega
 * el tipo de registro y el rango de fechas en un solo panel.
 */
function FiltrosMovil({
  filtro,
  setFiltro,
  desde,
  setDesde,
  hasta,
  setHasta,
  q,
  setQ,
}: {
  filtro: Filtro;
  setFiltro: (f: Filtro) => void;
  desde: string;
  setDesde: (v: string) => void;
  hasta: string;
  setHasta: (v: string) => void;
  q: string;
  setQ: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const activos = (filtro !== "todos" ? 1 : 0) + (desde ? 1 : 0) + (hasta ? 1 : 0);
  const fecha = (v: string) => fechaCorta.format(new Date(v));
  const resumen = [
    filtro !== "todos" && FILTROS.find((f) => f.id === filtro)?.label,
    desde && hasta ? `${fecha(desde)} – ${fecha(hasta)}` : desde ? `Desde ${fecha(desde)}` : hasta && `Hasta ${fecha(hasta)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2 sm:hidden">
      <div className="flex gap-2">
        <Buscador value={q} onChange={setQ} placeholder="Buscar N.º, producto, proveedor…" className="min-w-0" />
        <Button
          variant={activos ? "secondary" : "outline"}
          className="shrink-0"
          aria-expanded={abierto}
          aria-controls="registros-filtros"
          onClick={() => setAbierto((a) => !a)}
        >
          <SlidersHorizontal /> Filtros
          {activos > 0 && (
            <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums">
              {activos}
            </span>
          )}
          <ChevronDown className={cn("transition-transform", abierto && "rotate-180")} />
        </Button>
      </div>

      {abierto ? (
        <div id="registros-filtros" className="bg-card animate-in fade-in-0 flex flex-col gap-3 rounded-lg border p-3">
          <Campo label="Tipo de registro" htmlFor="reg-tipo">
            <Select id="reg-tipo" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
              {FILTROS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Desde" htmlFor="reg-desde">
              <Input
                id="reg-desde"
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
              />
            </Campo>
            <Campo label="Hasta" htmlFor="reg-hasta">
              <Input
                id="reg-hasta"
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Campo>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!activos}
              onClick={() => {
                setFiltro("todos");
                setDesde("");
                setHasta("");
              }}
            >
              Quitar filtros
            </Button>
            <Button size="sm" onClick={() => setAbierto(false)}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        resumen && <p className="text-muted-foreground text-xs">Filtrando: {resumen}</p>
      )}
    </div>
  );
}

/** Fila tocable de la lista de celular, con su detalle desplegable. */
function FilaMovil({
  expandida,
  onToggle,
  icono,
  titulo,
  subtitulo,
  derecha,
  atenuada,
  children,
}: {
  expandida: boolean;
  onToggle: () => void;
  icono: React.ReactNode;
  titulo: React.ReactNode;
  subtitulo: React.ReactNode;
  derecha: React.ReactNode;
  atenuada?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandida}
        className={cn("flex w-full items-start gap-3 px-2 py-2.5 text-left", atenuada && "text-muted-foreground")}
      >
        <span className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">{icono}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{titulo}</span>
          <span className="text-muted-foreground truncate text-xs">{subtitulo}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-sm font-medium">{derecha}</span>
        {expandida ? (
          <ChevronDown className="text-muted-foreground mt-1 size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" />
        )}
      </button>
      {expandida && <div className="bg-muted/30 mb-2 rounded-md px-3 py-2">{children}</div>}
    </li>
  );
}

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
  const fetchMovimientos = useCallback(
    () => api<MovimientoCajaApi[]>(`/cajas/movimientos?limite=${LIMITE}${rango}`),
    [rango],
  );
  const movimientos = useLiveData(fetchMovimientos, ["caja:actualizada"]);

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
    const ms: Registro[] = (movimientos.data ?? []).map((m) => ({
      tipo: "movimiento",
      id: m.id,
      fecha: m.creadoEn,
      total: Number(m.monto),
      mov: m,
    }));
    return [...vs, ...cs, ...ms].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ventas.data, compras.data, movimientos.data]);

  const texto = q.trim().toLowerCase();
  const visibles = registros.filter((r) => {
    if (filtro !== "todos" && r.tipo !== filtro) return false;
    if (!texto) return true;
    const contenido =
      r.tipo === "movimiento"
        ? `${r.mov.tipo} ${r.mov.motivo}`
        : `${r.tipo === "compra" ? r.compra.proveedor.nombre : r.venta.metodoPago} ${(r.tipo === "venta"
            ? r.venta.detalles
            : r.compra.detalles
          )
            .map((l) => l.producto.nombre)
            .join(" ")}`;
    return `#${r.id} ${contenido}`.toLowerCase().includes(texto);
  });

  const ventasOk = visibles.filter((r) => r.tipo === "venta" && r.venta.estado === "completada");
  const comprasVis = visibles.filter((r) => r.tipo === "compra");
  const sumar = (rs: Registro[]) => rs.reduce((s, r) => s + r.total, 0);
  const movsVis = visibles.flatMap((r) => (r.tipo === "movimiento" ? [r.mov] : []));
  const ingresosExtra = movsVis.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const egresosExtra = movsVis.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0);
  const cargando = !ventas.data || !compras.data || !movimientos.data;
  const error = ventas.error ?? compras.error ?? movimientos.error;

  return (
    <>
      <Titulo
        descripcion={
          desde || hasta
            ? "Registros del período elegido"
            : filtro === "caja"
              ? `Últimas ${LIMITE_CAJAS} cajas`
              : `Últimos ${LIMITE} de cada tipo`
        }
      >
        Registros
      </Titulo>

      {/* Celular: buscador + un solo botón "Filtros" que despliega tipo y fechas. */}
      <FiltrosMovil
        filtro={filtro}
        setFiltro={setFiltro}
        desde={desde}
        setDesde={setDesde}
        hasta={hasta}
        setHasta={setHasta}
        q={q}
        setQ={setQ}
      />

      {/* Escritorio/tablet: filtros a la vista. */}
      <div className="hidden flex-wrap items-end gap-3 sm:flex">
        <div className="flex gap-2" role="tablist" aria-label="Tipo de registro">
          {FILTROS.map((f) => (
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
        <Buscador value={q} onChange={setQ} placeholder="Buscar por N.º, producto, proveedor o detalle" />
      </div>

      {filtro === "caja" ? (
        <HistorialCajas rango={rango} texto={texto} />
      ) : (
        <>
          <TiraResumen columnasLg={5}>
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
            <Resumen
              label="Ingresos − egresos"
              valor={bs.format(ingresosExtra - egresosExtra)}
              detalle={`+${bs.format(ingresosExtra)} · −${bs.format(egresosExtra)} extra de caja`}
            />
          </TiraResumen>

          <EstadoCarga cargando={cargando && !error} error={error} />
          {!cargando && (
            <Card className="py-2">
              <CardContent className="px-2">
                {visibles.length === 0 ? (
                  <SinResultados>No hay registros con esos filtros.</SinResultados>
                ) : (
                  <>
                  {/* Celular: lista tocable; el detalle se despliega debajo. */}
                  <ul className="divide-y sm:hidden">
                    {visibles.map((r) => {
                      const clave = `${r.tipo}-${r.id}`;
                      const expandido = abierto === clave;
                      return (
                        <FilaMovil
                          key={clave}
                          expandida={expandido}
                          onToggle={() => setAbierto(expandido ? null : clave)}
                          atenuada={esAnulada(r)}
                          icono={<IconoRegistro r={r} />}
                          titulo={detalleDe(r)}
                          subtitulo={`${etiquetaTipo(r)} #${r.id} · ${fechaHora.format(new Date(r.fecha))} · ${pagoDe(r)}`}
                          derecha={
                            <>
                              <TotalRegistro r={r} />
                              {esAnulada(r) && <Badge variant="destructive">Anulada</Badge>}
                            </>
                          }
                        >
                          <DetalleRegistro r={r} onAnular={setAnulando} />
                        </FilaMovil>
                      );
                    })}
                  </ul>
                  <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Tipo</TableHead>
                        <TableHead>N.º</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Productos / detalle</TableHead>
                        <TableHead>Pago / proveedor</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibles.map((r) => {
                        const clave = `${r.tipo}-${r.id}`;
                        const expandido = abierto === clave;
                        return (
                          <Fragment key={clave}>
                            <TableRow
                              className={cn("cursor-pointer", esAnulada(r) && "text-muted-foreground")}
                              onClick={() => setAbierto(expandido ? null : clave)}
                              aria-expanded={expandido}
                            >
                              <TableCell>
                                {expandido ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              </TableCell>
                              <TableCell>
                                <span className="flex items-center gap-1.5">
                                  <IconoRegistro r={r} />
                                  {etiquetaTipo(r)}
                                </span>
                              </TableCell>
                              <TableCell className="tabular-nums">#{r.id}</TableCell>
                              <TableCell className="tabular-nums">{fechaHora.format(new Date(r.fecha))}</TableCell>
                              <TableCell className="max-w-64 truncate">{detalleDe(r)}</TableCell>
                              <TableCell>{pagoDe(r)}</TableCell>
                              <TableCell className="text-right">
                                <TotalRegistro r={r} />
                              </TableCell>
                              <TableCell className="text-right">
                                <EstadoRegistro r={r} />
                              </TableCell>
                            </TableRow>
                            {expandido && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell />
                                <TableCell colSpan={7} className="bg-muted/30 whitespace-normal">
                                  <DetalleRegistro r={r} onAnular={setAnulando} />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
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
    <Card className="gap-1 py-3 sm:py-4">
      <CardHeader className="px-3 sm:px-4">
        <CardDescription className="truncate text-xs sm:text-sm">{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-4">
        <div className="truncate text-lg font-semibold tabular-nums sm:text-xl">{valor}</div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-snug sm:text-xs">{detalle}</p>
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

function DetalleMovimiento({ mov }: { mov: MovimientoCajaApi }) {
  const egreso = mov.tipo === "egreso";
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 py-1 text-sm">
      <dt className="text-muted-foreground">Tipo</dt>
      <dd>{egreso ? "Egreso (salió efectivo del cajón)" : "Ingreso (entró efectivo al cajón)"}</dd>
      <dt className="text-muted-foreground">Detalle</dt>
      <dd className="whitespace-pre-wrap">{mov.motivo}</dd>
      <dt className="text-muted-foreground">Caja</dt>
      <dd>#{mov.cajaId}</dd>
      <dt className="text-muted-foreground">Monto</dt>
      <dd className={cn("font-semibold tabular-nums", egreso ? "text-destructive" : "text-emerald-600")}>
        {egreso ? "− " : "+ "}
        {bs.format(Number(mov.monto))}
      </dd>
    </dl>
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
          toast.exito(`Venta #${venta.id} anulada. El stock se devolvió.`);
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

/** Historial de cajas: cuándo se abrió y cerró cada una, con su arqueo. */
function HistorialCajas({ rango, texto }: { rango: string; texto: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const fetchCajas = useCallback(() => api<CajaHistorial[]>(`/cajas?limite=${LIMITE_CAJAS}${rango}`), [rango]);
  const cajas = useLiveData(fetchCajas, ["caja:actualizada", "venta:registrada", "venta:anulada"]);

  const visibles = (cajas.data ?? []).filter((c) => !texto || `#${c.cajaId}`.includes(texto));
  const cerradas = visibles.filter((c) => c.cerradaEn);
  const vendido = visibles.reduce((s, c) => s + Number(c.ventasEfectivo) + Number(c.ventasTransferencia), 0);
  const diferencia = cerradas.reduce((s, c) => s + Number(c.diferencia ?? 0), 0);
  const conDiferencia = cerradas.filter((c) => Number(c.diferencia ?? 0) !== 0).length;

  return (
    <>
      <TiraResumen columnasLg={4}>
        <Resumen
          label="Cajas"
          valor={String(visibles.length)}
          detalle={visibles.length > cerradas.length ? "Una sigue abierta" : "Todas cerradas"}
        />
        <Resumen label="Vendido" valor={bs.format(vendido)} detalle="Efectivo + transferencias/QR" />
        <Resumen
          label="Diferencia de arqueos"
          valor={bs.format(diferencia)}
          detalle={diferencia > 0 ? "Sobrante acumulado" : diferencia < 0 ? "Faltante acumulado" : "Sin diferencias"}
        />
        <Resumen
          label="Arqueos con diferencia"
          valor={String(conDiferencia)}
          detalle={`de ${cerradas.length} cajas cerradas`}
        />
      </TiraResumen>

      <EstadoCarga cargando={!cajas.data && !cajas.error} error={cajas.error} />
      {cajas.data && (
        <Card className="py-2">
          <CardContent className="px-2">
            {visibles.length === 0 ? (
              <SinResultados>No hay cajas en ese período.</SinResultados>
            ) : (
              <>
              {/* Celular: lista tocable con el arqueo a la derecha. */}
              <ul className="divide-y sm:hidden">
                {visibles.map((c) => {
                  const expandida = abierta === c.cajaId;
                  const dif = c.diferencia === null ? null : Number(c.diferencia);
                  return (
                    <FilaMovil
                      key={c.cajaId}
                      expandida={expandida}
                      onToggle={() => setAbierta(expandida ? null : c.cajaId)}
                      icono={
                        c.cerradaEn ? (
                          <Lock className="text-muted-foreground size-3.5" />
                        ) : (
                          <LockOpen className="size-3.5 text-emerald-600" />
                        )
                      }
                      titulo={`Caja #${c.cajaId} · ${bs.format(Number(c.ventasEfectivo) + Number(c.ventasTransferencia))}`}
                      subtitulo={`${fechaHora.format(new Date(c.abiertaEn))}${c.cerradaEn ? ` → ${fechaHora.format(new Date(c.cerradaEn))}` : ""}`}
                      derecha={
                        c.cerradaEn ? (
                          <span
                            className={cn(
                              "tabular-nums",
                              dif !== null && dif > 0 && "text-amber-600",
                              dif !== null && dif < 0 && "text-destructive",
                              dif === 0 && "text-emerald-600",
                            )}
                          >
                            {dif === null ? "—" : dif === 0 ? "Cuadró" : `${dif > 0 ? "+" : "−"} ${bs.format(Math.abs(dif))}`}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-emerald-700">
                            Abierta
                          </Badge>
                        )
                      }
                    >
                      <DetalleCaja caja={c} />
                    </FilaMovil>
                  );
                })}
              </ul>
              <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Caja</TableHead>
                    <TableHead>Apertura</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Inicial</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((c) => {
                    const expandida = abierta === c.cajaId;
                    const dif = c.diferencia === null ? null : Number(c.diferencia);
                    return (
                      <Fragment key={c.cajaId}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setAbierta(expandida ? null : c.cajaId)}
                          aria-expanded={expandida}
                        >
                          <TableCell>
                            {expandida ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </TableCell>
                          <TableCell className="tabular-nums">#{c.cajaId}</TableCell>
                          <TableCell className="tabular-nums">{fechaHora.format(new Date(c.abiertaEn))}</TableCell>
                          <TableCell className="tabular-nums">
                            {c.cerradaEn ? (
                              fechaHora.format(new Date(c.cerradaEn))
                            ) : (
                              <Badge variant="secondary" className="text-emerald-700">
                                <LockOpen /> Abierta
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{bs.format(Number(c.montoInicial))}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {bs.format(Number(c.ventasEfectivo) + Number(c.ventasTransferencia))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {bs.format(Number(c.efectivoEsperado))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.montoContado === null ? "—" : bs.format(Number(c.montoContado))}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium tabular-nums",
                              dif !== null && dif > 0 && "text-amber-600",
                              dif !== null && dif < 0 && "text-destructive",
                              dif === 0 && "text-emerald-600",
                            )}
                          >
                            {dif === null ? "—" : dif === 0 ? "Cuadró" : `${dif > 0 ? "+" : "−"} ${bs.format(Math.abs(dif))}`}
                          </TableCell>
                        </TableRow>
                        {expandida && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell />
                            <TableCell colSpan={8} className="bg-muted/30 whitespace-normal">
                              <DetalleCaja caja={c} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Desglose de una caja y sus ingresos/egresos extra. */
function DetalleCaja({ caja: c }: { caja: CajaHistorial }) {
  const fetchDetalle = useCallback(
    () => api<CajaActual & { notas: string | null }>(`/cajas/${c.cajaId}`),
    [c.cajaId],
  );
  const detalle = useLiveData(fetchDetalle, ["caja:actualizada"]);
  const movimientos = detalle.data?.movimientos ?? [];
  const dif = c.diferencia === null ? null : Number(c.diferencia);

  return (
    <div className="grid gap-6 py-1 md:grid-cols-2">
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <dt className="text-muted-foreground flex items-center gap-1.5">
          <LockOpen className="size-3.5" /> Abierta
        </dt>
        <dd className="text-right tabular-nums">{fechaHora.format(new Date(c.abiertaEn))}</dd>
        <dt className="text-muted-foreground flex items-center gap-1.5">
          <Lock className="size-3.5" /> Cerrada
        </dt>
        <dd className="text-right tabular-nums">{c.cerradaEn ? fechaHora.format(new Date(c.cerradaEn)) : "Sigue abierta"}</dd>
        <dt className="text-muted-foreground border-t pt-1">Monto inicial</dt>
        <dd className="border-t pt-1 text-right tabular-nums">{bs.format(Number(c.montoInicial))}</dd>
        <dt className="text-muted-foreground">Ventas en efectivo</dt>
        <dd className="text-right tabular-nums">{bs.format(Number(c.ventasEfectivo))}</dd>
        <dt className="text-muted-foreground">Ingresos extra</dt>
        <dd className="text-right text-emerald-600 tabular-nums">+ {bs.format(Number(c.otrosIngresos))}</dd>
        <dt className="text-muted-foreground">Egresos</dt>
        <dd className="text-destructive text-right tabular-nums">− {bs.format(Number(c.egresos))}</dd>
        <dt className="border-t pt-1 font-medium">Efectivo esperado</dt>
        <dd className="border-t pt-1 text-right font-semibold tabular-nums">{bs.format(Number(c.efectivoEsperado))}</dd>
        <dt className="text-muted-foreground">Efectivo contado</dt>
        <dd className="text-right tabular-nums">{c.montoContado === null ? "—" : bs.format(Number(c.montoContado))}</dd>
        <dt className="text-muted-foreground">Diferencia</dt>
        <dd className="text-right tabular-nums">
          {dif === null ? "—" : dif === 0 ? "Cuadró" : `${bs.format(dif)} (${dif > 0 ? "sobrante" : "faltante"})`}
        </dd>
        <dt className="text-muted-foreground border-t pt-1 text-xs">Transferencias/QR (no van al cajón)</dt>
        <dd className="text-muted-foreground border-t pt-1 text-right text-xs tabular-nums">
          {bs.format(Number(c.ventasTransferencia))}
        </dd>
      </dl>

      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground text-xs font-medium">Ingresos y egresos extra</p>
        {!detalle.data ? (
          <p className="text-muted-foreground text-xs">{detalle.error ?? "Cargando…"}</p>
        ) : movimientos.length === 0 ? (
          <p className="text-muted-foreground text-xs">Sin movimientos extra.</p>
        ) : (
          <ul className="divide-y">
            {movimientos.map((m) => {
              const egreso = m.tipo === "egreso";
              return (
                <li key={m.id} className="flex items-center gap-2 py-1.5">
                  <Wallet className={cn("size-3.5 shrink-0", egreso ? "text-destructive" : "text-emerald-600")} />
                  <span className="min-w-0 flex-1 truncate" title={m.motivo}>
                    {m.motivo}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {fechaHora.format(new Date(m.creadoEn))}
                  </span>
                  <span className={cn("w-24 text-right tabular-nums", egreso ? "text-destructive" : "text-emerald-600")}>
                    {egreso ? "−" : "+"} {bs.format(Number(m.monto))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {detalle.data?.notas && <p className="text-muted-foreground mt-2 text-xs">Notas: {detalle.data.notas}</p>}
      </div>
    </div>
  );
}
