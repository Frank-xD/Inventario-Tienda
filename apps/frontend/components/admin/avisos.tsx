"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCheck, Info, Package, ShoppingBag, Truck, Check } from "lucide-react";
import type { Aviso, TipoAviso } from "@/lib/modelos";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { HaceCuanto, useAdmin } from "./admin-store";
import { EstadoCarga, SinResultados, Titulo } from "./comun";

const ICONO: Record<TipoAviso, { icon: typeof Info; cls: string }> = {
  stock: { icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
  vencimiento: { icon: CalendarClock, cls: "bg-amber-500/15 text-amber-600" },
  proveedor: { icon: Truck, cls: "bg-sky-500/15 text-sky-600" },
  info: { icon: Info, cls: "bg-secondary text-muted-foreground" },
};

export function IconoAviso({ tipo }: { tipo: TipoAviso }) {
  const { icon: Icon, cls } = ICONO[tipo];
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", cls)}>
      <Icon className="size-4" />
    </span>
  );
}

const FILTROS: { id: "todos" | TipoAviso; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "stock", label: "Stock" },
  { id: "vencimiento", label: "Vencidos o por vencer" },
  { id: "proveedor", label: "Proveedores" },
  { id: "info", label: "Información" },
];

export function Avisos() {
  const { avisos, noLeidos, cargando, error, marcarLeido, marcarTodosLeidos } = useAdmin();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const visibles = avisos.filter((a) => filtro === "todos" || a.tipo === filtro);
  const contar = (id: (typeof FILTROS)[number]["id"]) =>
    id === "todos" ? avisos.length : avisos.filter((a) => a.tipo === id).length;

  return (
    <>
      <div className="flex items-end justify-between gap-3 sm:flex-wrap sm:gap-4">
        <Titulo descripcion={noLeidos ? `${noLeidos} sin leer` : "Estás al día"}>Avisos</Titulo>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label="Marcar todo como leído"
          onClick={() => void marcarTodosLeidos()}
          disabled={!noLeidos}
        >
          <CheckCheck /> <span className="sm:hidden">Leer todo</span>
          <span className="hidden sm:inline">Marcar todo como leído</span>
        </Button>
      </div>

      {/* Celular: un solo desplegable con el conteo de cada tipo. */}
      <div className="sm:hidden">
        <Select
          aria-label="Filtrar avisos"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as (typeof FILTROS)[number]["id"])}
        >
          {FILTROS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} ({contar(f.id)})
            </option>
          ))}
        </Select>
      </div>

      {/* Escritorio/tablet: botones a la vista. */}
      <div className="hidden flex-wrap gap-2 sm:flex" role="tablist" aria-label="Filtrar avisos">
        {FILTROS.map((f) => {
          const n = contar(f.id);
          return (
            <Button
              key={f.id}
              role="tab"
              aria-selected={filtro === f.id}
              size="sm"
              variant={filtro === f.id ? "default" : "outline"}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
              <span className="opacity-60 tabular-nums">{n}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {visibles.map((a) => (
          <Card
            key={a.id}
            className={cn(
              "flex-row items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4",
              (a.leido || a.resuelto) && "bg-muted/40 shadow-none",
            )}
          >
            <IconoAviso tipo={a.tipo} />
            <div className={cn("min-w-0 flex-1", a.resuelto && "opacity-70")}>
              <p className="text-sm">
                <span className="font-semibold">{a.titulo}:</span> {a.texto}
              </p>
              <p className="text-muted-foreground min-h-4 text-xs">
                <HaceCuanto iso={a.fecha} />
              </p>
            </div>
            {a.resuelto ? (
              <Badge variant="secondary" title="El problema ya se resolvió">
                <Check /> Resuelto
              </Badge>
            ) : a.leido ? (
              <span className="text-muted-foreground text-xs">Leído</span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                aria-label="Marcar leído"
                title="Marcar leído"
                onClick={() => void marcarLeido(a.id)}
              >
                <span className="bg-primary size-2 rounded-full" aria-hidden />
                {/* Celular: solo el ícono, para dejarle ancho al texto del aviso. */}
                <Check className="sm:hidden" />
                <span className="hidden sm:inline">Marcar leído</span>
              </Button>
            )}
          </Card>
        ))}
        <EstadoCarga cargando={cargando && avisos.length === 0} error={error} />
        {!cargando && visibles.length === 0 && <SinResultados>No hay avisos en esta categoría.</SinResultados>}
      </div>
    </>
  );
}

const ETIQUETA: Record<TipoAviso, string> = {
  stock: "Stock",
  vencimiento: "Vencimiento",
  proveedor: "Pedido a proveedor",
  info: "Información",
};

/** A dónde lleva cada aviso del sistema. */
function destinos(a: Aviso): { href: string; label: string; icon: typeof Info; principal?: boolean }[] {
  const producto = a.productoId ? `/panel/productos?producto=${a.productoId}` : null;
  switch (a.tipo) {
    case "stock":
      return [
        { href: "/compra", label: "Registrar compra", icon: ShoppingBag, principal: true },
        ...(producto ? [{ href: producto, label: "Ver producto", icon: Package }] : []),
      ];
    case "vencimiento":
      return producto ? [{ href: producto, label: "Ver producto", icon: Package, principal: true }] : [];
    case "proveedor":
      return a.proveedorId
        ? [
            { href: `/compra?proveedor=${a.proveedorId}`, label: "Hacer el pedido", icon: ShoppingBag, principal: true },
            { href: "/panel/proveedores", label: "Ver proveedores", icon: Truck },
          ]
        : [];
    case "info":
      return producto ? [{ href: producto, label: "Ver producto", icon: Package }] : [];
  }
}

/** Modal con el aviso completo y los accesos al asunto. */
export function DetalleAviso({ aviso, onCerrar }: { aviso: Aviso | null; onCerrar: () => void }) {
  return (
    <Modal open={aviso !== null} onOpenChange={(o) => !o && onCerrar()} titulo={aviso?.titulo ?? ""} className="max-w-md">
      {aviso && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <IconoAviso tipo={aviso.tipo} />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm leading-relaxed">{aviso.texto}</p>
              <p className="text-muted-foreground text-xs">
                {ETIQUETA[aviso.tipo]} · <HaceCuanto iso={aviso.fecha} />
                {aviso.resuelto && " · Ya se resolvió"}
              </p>
            </div>
          </div>
          {!aviso.resuelto && destinos(aviso).length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {destinos(aviso).map((d) => (
                <Button key={d.href} variant={d.principal ? "default" : "outline"} asChild>
                  <Link href={d.href} onClick={onCerrar}>
                    <d.icon /> {d.label}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
