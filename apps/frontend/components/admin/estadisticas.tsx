"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Package,
  Receipt,
  Search,
  Trash,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import {
  api,
  bs,
  type MovimientoReciente,
  type Resumen,
  type VentaDiaria,
  type VentaPorProducto,
} from "@/lib/api";
import { formatCantidad } from "@/lib/cantidad";
import { useLiveData } from "@/hooks/use-live-data";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HaceCuanto } from "./admin-store";
import { EstadoCarga, SinResultados, Titulo } from "./comun";

const DIAS = 14;

const EV_VENTAS = ["venta:registrada", "venta:anulada"];
const EV_TODO = [
  ...EV_VENTAS,
  "compra:registrada",
  "stock:actualizado",
  "producto:actualizado",
  "proveedor:actualizado",
  "lotes:actualizados",
  "caja:actualizada",
];

const fetchResumen = () => api<Resumen>("/reportes/resumen");
const fetchDiarias = () => api<VentaDiaria[]>(`/reportes/ventas-diarias?dias=${DIAS}`);
const fetchTop = () => api<VentaPorProducto[]>("/reportes/ventas-por-producto?limite=5");
const fetchMovimientos = () => api<MovimientoReciente[]>("/reportes/movimientos-recientes?limite=15");

const TIPO_MOV: Record<MovimientoReciente["tipo"], { label: string; icon: typeof Receipt }> = {
  venta: { label: "Venta", icon: ArrowUpRight },
  compra: { label: "Compra", icon: ArrowDownLeft },
  ajuste: { label: "Ajuste", icon: Wrench },
  merma: { label: "Merma", icon: Trash },
};

const ESTADO_MOV: Record<MovimientoReciente["estado"], { label: string; variant: "secondary" | "destructive" }> = {
  completada: { label: "Completada", variant: "secondary" },
  anulada: { label: "Anulada", variant: "destructive" },
};

export function Estadisticas() {
  const resumen = useLiveData(fetchResumen, EV_TODO);
  const diarias = useLiveData(fetchDiarias, EV_VENTAS);
  const top = useLiveData(fetchTop, EV_VENTAS);
  const movimientos = useLiveData(fetchMovimientos, EV_TODO);
  const [q, setQ] = useState("");

  const r = resumen.data;
  const error = [resumen, diarias, top, movimientos].find((d) => d.error)?.error ?? null;

  const ventasPeriodo = diarias.data?.reduce((s, d) => s + d.total, 0) ?? 0;
  const nVentas = diarias.data?.reduce((s, d) => s + d.ventas, 0) ?? 0;
  const stockBajo = r ? r.alertas.agotados + r.alertas.bajos : 0;
  const maxUnidades = Math.max(1, ...(top.data ?? []).map((p) => Number(p.unidades)));

  const texto = q.trim().toLowerCase();
  const movs = (movimientos.data ?? []).filter(
    (m) =>
      !texto ||
      `#${m.id} ${m.detalle} ${TIPO_MOV[m.tipo].label} ${ESTADO_MOV[m.estado].label}`.toLowerCase().includes(texto),
  );

  return (
    <>
      <Titulo descripcion={`Resumen de los últimos ${DIAS} días`}>Estadísticas generales</Titulo>
      <EstadoCarga cargando={false} error={error} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <Stat
          icon={Wallet}
          label={`Ventas (${DIAS} días)`}
          value={diarias.data ? bs.format(ventasPeriodo) : "—"}
          hint={
            r
              ? `Hoy ${bs.format(r.hoy.total)} · ticket ${bs.format(nVentas ? ventasPeriodo / nVentas : 0)}`
              : undefined
          }
        />
        <Stat
          icon={Receipt}
          label="Ventas registradas"
          value={diarias.data ? nVentas.toLocaleString("es-BO") : "—"}
          hint={r ? `${r.hoy.ventas} hoy · ${Math.round(nVentas / DIAS)} por día en promedio` : undefined}
        />
        <Stat
          icon={Package}
          label="Productos activos"
          value={r ? r.inventario.productosActivos : "—"}
          hint={r ? `${stockBajo} con stock bajo o agotados` : undefined}
          warn={stockBajo > 0}
        />
        <Stat
          icon={Truck}
          label="Proveedores"
          value={r ? r.proveedores.activos : "—"}
          hint={r ? `${r.proveedores.inactivos} inactivos` : undefined}
        />
      </section>

      {r && r.vencimientos.vencidos + r.vencimientos.porVencer > 0 && (
        <Card className="flex-row items-center gap-3 border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <CalendarClock className="size-4 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm">
            {r.vencimientos.vencidos > 0 && `${r.vencimientos.vencidos} lote(s) vencido(s). `}
            {r.vencimientos.porVencer > 0 && `${r.vencimientos.porVencer} lote(s) vencen en los próximos 7 días.`}{" "}
            Revisa la sección Avisos.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas de los últimos {DIAS} días</CardTitle>
            <CardDescription>Total diario de ventas completadas</CardDescription>
          </CardHeader>
          <CardContent>{diarias.data ? <SalesChart data={diarias.data} /> : <div className="h-64" />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Por cantidad vendida (piezas o kg)</CardDescription>
          </CardHeader>
          <CardContent>
            {top.data?.length === 0 ? (
              <SinResultados>Todavía no hay ventas.</SinResultados>
            ) : (
              <ol className="flex flex-col gap-4">
                {top.data?.map((p, i) => (
                  <li key={p.productoId} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                        {p.nombre}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {formatCantidad(p.unidades, p.unidadMedida)} · {bs.format(Number(p.ingresos))}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-[var(--chart-2)]"
                        style={{ width: `${(Number(p.unidades) / maxUnidades) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Últimos movimientos</CardTitle>
            <CardDescription>Ventas, compras, ajustes y mermas de inventario</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Buscar movimiento…"
              aria-label="Buscar movimiento"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {movimientos.data && movs.length === 0 ? (
            <SinResultados>No hay movimientos que coincidan.</SinResultados>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Cuándo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.map((m) => {
                  const { label, icon: Icon } = TIPO_MOV[m.tipo];
                  const e = ESTADO_MOV[m.estado];
                  return (
                    <TableRow key={`${m.tipo}-${m.id}`}>
                      <TableCell className="text-muted-foreground tabular-nums">#{m.id}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <Icon className="text-muted-foreground size-3.5" /> {label}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-72 truncate">{m.detalle}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <HaceCuanto iso={m.fecha} />
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${m.estado === "anulada" ? "text-muted-foreground line-through" : ""}`}
                      >
                        {bs.format(m.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={e.variant}>{e.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: typeof Wallet;
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription className="flex items-center justify-between gap-1.5">
          {label}
          <Icon className="size-4" aria-hidden />
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${warn ? "text-destructive" : "text-muted-foreground"}`}>
            {warn && <AlertTriangle className="size-3" aria-hidden />}
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
