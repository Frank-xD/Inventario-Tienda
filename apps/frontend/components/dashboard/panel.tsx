"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, RefreshCw, Store, Wallet } from "lucide-react";
import {
  api,
  bs,
  type AlertaStock,
  type CajaActual,
  type PorVencer,
  type Resumen,
  type VentaDiaria,
  type VentaPorProducto,
} from "@/lib/api";
import { useSocketConnected } from "@/lib/socket";
import { useLiveData } from "@/hooks/use-live-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesChart } from "./sales-chart";

const EV_VENTAS = ["venta:registrada", "venta:anulada", "caja:actualizada"];
const EV_STOCK = ["stock:actualizado", "producto:actualizado"];
const EV_LOTES = ["lotes:actualizados"];

// Fetchers estables (fuera del componente) para que useLiveData no se re-suscriba.
const fetchResumen = () => api<Resumen>("/reportes/resumen");
const fetchDiarias = () => api<VentaDiaria[]>("/reportes/ventas-diarias?dias=14");
const fetchAlertas = () => api<AlertaStock[]>("/inventario/alertas");
const fetchPorVencer = () => api<PorVencer[]>("/inventario/lotes/por-vencer");
const fetchTop = () => api<VentaPorProducto[]>("/reportes/ventas-por-producto?limite=5");
const fetchCaja = () => api<CajaActual | null>("/cajas/actual");

const fechaCorta = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", timeZone: "UTC" });
const hora = new Intl.DateTimeFormat("es-BO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/La_Paz",
});

export function Panel() {
  const connected = useSocketConnected();
  const resumen = useLiveData(fetchResumen, [...EV_VENTAS, ...EV_STOCK, ...EV_LOTES]);
  const diarias = useLiveData(fetchDiarias, EV_VENTAS);
  const alertas = useLiveData(fetchAlertas, EV_STOCK);
  const porVencer = useLiveData(fetchPorVencer, EV_LOTES);
  const top = useLiveData(fetchTop, EV_VENTAS);
  const caja = useLiveData(fetchCaja, EV_VENTAS);

  const recargarTodo = () =>
    [resumen, diarias, alertas, porVencer, top, caja].forEach((d) => d.recargar());
  const error = [resumen, diarias, alertas, porVencer, top, caja].find((d) => d.error)?.error;
  const r = resumen.data;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi Tiendita</h1>
          <p className="text-muted-foreground text-sm">Panel de la tienda</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "secondary" : "outline"}>
            <span
              className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground"}`}
            />
            {connected ? "En vivo" : "Desconectado"}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalogo">
              <Store /> Catálogo público
            </Link>
          </Button>
          <Button variant="outline" size="icon" aria-label="Recargar" onClick={recargarTodo}>
            <RefreshCw />
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-destructive/50 py-4">
          <CardContent className="text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <Stat
          label="Ventas de hoy"
          value={r ? bs.format(r.hoy.total) : "—"}
          hint={r ? `${r.hoy.ventas} ventas · ticket ${bs.format(r.hoy.ticketPromedio)}` : undefined}
        />
        <Stat
          label="Efectivo / transferencia"
          value={r ? bs.format(r.hoy.efectivo) : "—"}
          hint={r ? `${bs.format(r.hoy.transferencia)} por transferencia` : undefined}
        />
        <Stat
          label="Alertas de stock"
          value={r ? r.alertas.agotados + r.alertas.bajos : "—"}
          hint={r ? `${r.alertas.agotados} agotados · ${r.alertas.bajos} bajos` : undefined}
          warn={!!r && r.alertas.agotados + r.alertas.bajos > 0}
        />
        <Stat
          label="Vencimientos (7 días)"
          value={r ? r.vencimientos.vencidos + r.vencimientos.porVencer : "—"}
          hint={r ? `${r.vencimientos.vencidos} vencidos · ${r.vencimientos.porVencer} por vencer` : undefined}
          warn={!!r && r.vencimientos.vencidos > 0}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas de los últimos 14 días</CardTitle>
            <CardDescription>Total diario de ventas completadas</CardDescription>
          </CardHeader>
          <CardContent>{diarias.data && <SalesChart data={diarias.data} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4" /> Caja
            </CardTitle>
            <CardDescription>
              {caja.data
                ? `Abierta desde las ${hora.format(new Date(caja.data.abiertaEn))}`
                : "No hay una caja abierta"}
            </CardDescription>
          </CardHeader>
          {caja.data?.resumen && (
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                <Fila label="Monto inicial" value={caja.data.resumen.montoInicial} />
                <Fila label="Ventas en efectivo" value={caja.data.resumen.ventasEfectivo} />
                <Fila label="Otros ingresos" value={caja.data.resumen.otrosIngresos} />
                <Fila label="Egresos" value={caja.data.resumen.egresos} negativo />
                <dt className="border-t pt-2 font-medium">Efectivo esperado</dt>
                <dd className="border-t pt-2 text-right font-semibold tabular-nums">
                  {bs.format(Number(caja.data.resumen.efectivoEsperado))}
                </dd>
                <Fila label="Transferencias" value={caja.data.resumen.ventasTransferencia} muted />
              </dl>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" /> Stock bajo y agotados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertas.data?.length === 0 ? (
              <Vacio>Todo el stock está por encima del mínimo.</Vacio>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertas.data?.map((a) => (
                    <TableRow key={a.productoId}>
                      <TableCell>{a.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.stock}</TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {a.stockMinimo}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={a.nivel === "agotado" ? "destructive" : "outline"}>
                          {a.nivel === "agotado" ? "Agotado" : "Bajo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" /> Vencidos y por vencer
            </CardTitle>
            <CardDescription>Lotes que vencen en los próximos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            {porVencer.data?.length === 0 ? (
              <Vacio>No hay lotes por vencer esta semana.</Vacio>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porVencer.data?.map((l) => (
                    <TableRow key={l.loteId}>
                      <TableCell>{l.nombre}</TableCell>
                      <TableCell>{fechaCorta.format(new Date(l.fechaVencimiento))}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.cantidadInicial}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={l.nivel === "vencido" ? "destructive" : "outline"}>
                          {l.nivel === "vencido"
                            ? "Vencido"
                            : l.diasRestantes === 0
                              ? "Vence hoy"
                              : `${l.diasRestantes} días`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Más vendidos</CardTitle>
          <CardDescription>Ventas completadas desde el inicio</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.data?.map((p) => (
                <TableRow key={p.productoId}>
                  <TableCell>{p.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.unidades}</TableCell>
                  <TableCell className="text-right tabular-nums">{bs.format(Number(p.ingresos))}</TableCell>
                  <TableCell className="text-right tabular-nums">{bs.format(Number(p.margen))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-1.5">
          {warn && <AlertTriangle className="text-destructive size-3.5" aria-label="Requiere atención" />}
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Fila({
  label,
  value,
  negativo,
  muted,
}: {
  label: string;
  value: string;
  negativo?: boolean;
  muted?: boolean;
}) {
  const cls = muted ? "text-muted-foreground" : "";
  return (
    <>
      <dt className={cls || "text-muted-foreground"}>{label}</dt>
      <dd className={`text-right tabular-nums ${cls}`}>
        {negativo ? "− " : ""}
        {bs.format(Number(value))}
      </dd>
    </>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}
