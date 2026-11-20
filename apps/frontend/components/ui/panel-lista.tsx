"use client";

import { useEffect, type ReactNode } from "react";
import { ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Ancho desde el que la lista va como columna a la derecha (breakpoint `lg`). */
const ESCRITORIO = "(min-width: 1024px)";

/**
 * Lista de una venta o compra (productos, total y botón de confirmar).
 *
 * - Escritorio (lg+): tarjeta fija a la derecha de los productos, como siempre.
 * - Celular/tablet: una barra fija abajo con la cantidad y el total; al tocarla,
 *   la misma lista sube como hoja inferior. Así se agregan productos y se cobra
 *   sin bajar hasta el final de la página.
 *
 * El contenido se renderiza una sola vez; solo cambia su presentación con CSS.
 */
export function PanelLista({
  abierto,
  onAbrir,
  onCerrar,
  etiqueta,
  resumen,
  total,
  textoBoton,
  vacio,
  aviso,
  children,
}: {
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  /** Nombre accesible de la hoja, p. ej. "Lista de la venta". */
  etiqueta: string;
  /** Texto chico de la barra, p. ej. "3 productos". */
  resumen: string;
  /** Total ya formateado. */
  total: string;
  textoBoton: string;
  /** Sin productos: la barra lo indica y el botón se desactiva. */
  vacio: boolean;
  /** Aviso corto en la barra (p. ej. "Caja cerrada"). */
  aviso?: string | null;
  children: ReactNode;
}) {
  // Hoja abierta en celular: bloquea el scroll de fondo y se cierra con Escape.
  useEffect(() => {
    if (!abierto || window.matchMedia(ESCRITORIO).matches) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", onKey);
    };
  }, [abierto, onCerrar]);

  return (
    <>
      {abierto && (
        <div className="animate-in fade-in-0 fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onCerrar} aria-hidden />
      )}

      <Card
        role="region"
        aria-label={etiqueta}
        className={cn(
          // Celular: hoja inferior a ancho completo.
          "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl rounded-b-none border-x-0 border-b-0 pt-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-[translate,visibility] duration-300 ease-out",
          abierto ? "visible translate-y-0" : "invisible translate-y-full",
          // Escritorio: columna derecha pegajosa, como antes.
          "lg:visible lg:sticky lg:inset-x-auto lg:top-6 lg:bottom-auto lg:z-auto lg:max-h-none lg:translate-y-0 lg:self-start lg:overflow-visible lg:rounded-xl lg:border lg:pt-6 lg:pb-6 lg:shadow-sm lg:transition-none",
        )}
      >
        <div className="bg-card sticky top-0 z-10 -mb-3 flex items-center justify-center pt-2.5 pb-1 lg:hidden">
          <span className="bg-muted-foreground/30 h-1.5 w-10 rounded-full" aria-hidden />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1.5 right-3"
            aria-label="Cerrar lista"
            onClick={onCerrar}
          >
            <X />
          </Button>
        </div>
        {children}
      </Card>

      {/* Barra fija inferior (solo celular/tablet). */}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgb(0_0_0/0.06)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={onAbrir}
            disabled={vacio}
            className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-100"
            aria-label={`${textoBoton}: ${resumen}, total ${total}`}
          >
            <span className="flex min-w-0 flex-col">
              <span className={cn("truncate text-xs", aviso ? "text-amber-600" : "text-muted-foreground")}>
                {aviso ?? resumen}
              </span>
              <span className="text-xl leading-tight font-semibold tabular-nums">{total}</span>
            </span>
            {!vacio && <ChevronUp className="text-muted-foreground size-4 shrink-0" aria-hidden />}
          </button>
          <Button size="lg" className="shrink-0" disabled={vacio} onClick={onAbrir}>
            {textoBoton}
          </Button>
        </div>
      </div>
    </>
  );
}
