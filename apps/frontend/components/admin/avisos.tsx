"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCheck, Info, Truck, Check } from "lucide-react";
import type { TipoAviso } from "@/lib/modelos";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo descripcion={noLeidos ? `${noLeidos} sin leer` : "Estás al día"}>Avisos</Titulo>
        <Button variant="outline" size="sm" onClick={() => void marcarTodosLeidos()} disabled={!noLeidos}>
          <CheckCheck /> Marcar todo como leído
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar avisos">
        {FILTROS.map((f) => {
          const n = f.id === "todos" ? avisos.length : avisos.filter((a) => a.tipo === f.id).length;
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
            className={cn("flex-row items-center gap-4 px-4 py-4", (a.leido || a.resuelto) && "bg-muted/40 shadow-none")}
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
              <Button variant="ghost" size="sm" onClick={() => void marcarLeido(a.id)}>
                <span className="bg-primary size-2 rounded-full" aria-hidden />
                Marcar leído
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
