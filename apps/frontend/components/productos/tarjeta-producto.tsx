"use client";

import { Package, Scale } from "lucide-react";
import { bs } from "@/lib/api";
import { formatCantidad, sufijoPrecio } from "@/lib/cantidad";
import type { Producto } from "@/lib/modelos";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Imagen del producto en un recuadro de tamaño fijo: la foto se ajusta
 * dentro (object-contain) sin recortarse ni deformarse, sea cual sea su
 * proporción. Sin foto, un ícono.
 */
export function ImagenProducto({
  producto,
  className,
}: {
  producto: Pick<Producto, "nombre" | "fotoUrl">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted/60 text-muted-foreground relative flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        className,
      )}
    >
      {producto.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen servida por la API (ya comprimida)
        <img
          src={producto.fotoUrl}
          alt={producto.nombre}
          loading="lazy"
          decoding="async"
          // Superpuesta: el tamaño natural de la foto nunca agranda el recuadro.
          className="absolute inset-0 size-full object-contain"
        />
      ) : (
        <Package className="size-1/3 max-h-8 max-w-8 opacity-60" aria-hidden />
      )}
    </span>
  );
}

/**
 * Tarjeta para elegir un producto en Venta y Compra.
 * - venta: muestra precio y stock disponible.
 * - compra: muestra el último costo y el stock actual.
 */
export function TarjetaProducto({
  producto: p,
  categoria,
  enLista,
  modo,
  disabled,
  onClick,
}: {
  producto: Producto;
  categoria: string;
  /** Cantidad ya agregada a la lista (0 si no está). */
  enLista: number;
  modo: "venta" | "compra";
  disabled?: boolean;
  onClick: () => void;
}) {
  const agotado = p.stock <= 0;
  const bajo = !agotado && p.stock <= p.stockMinimo;
  const monto = modo === "venta" ? p.precio : p.costo;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="bg-card hover:bg-accent focus-visible:ring-ring/50 relative flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <ImagenProducto producto={p} className="h-24 w-full" />
      {enLista > 0 && (
        <Badge className="absolute top-3 right-3 tabular-nums shadow-sm">{formatCantidad(enLista, p.unidadMedida)}</Badge>
      )}
      <div className="flex flex-1 flex-col gap-1 px-1">
        <span className="line-clamp-2 text-sm leading-tight font-medium">{p.nombre}</span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          {p.unidadMedida === "kg" && <Scale className="size-3" aria-label="Se vende por peso" />}
          {categoria}
        </span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-1">
          <span className="font-semibold tabular-nums">
            {modo === "compra" && <span className="text-muted-foreground text-xs font-normal">Costo </span>}
            {bs.format(monto)}
            <span className="text-muted-foreground text-xs font-normal">{sufijoPrecio(p.unidadMedida)}</span>
          </span>
          <span
            className={cn(
              "text-xs tabular-nums",
              agotado ? "text-destructive" : bajo ? "text-amber-600" : "text-muted-foreground",
            )}
          >
            {agotado ? (modo === "venta" ? "Agotado" : "Sin stock") : `${formatCantidad(p.stock, p.unidadMedida)}${modo === "venta" ? " disp." : " en stock"}`}
          </span>
        </span>
      </div>
    </button>
  );
}
