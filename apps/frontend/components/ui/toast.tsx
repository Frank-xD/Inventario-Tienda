"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Avisos flotantes ("toasts"): confirmaciones como "Venta registrada" que
 * aparecen encima de la página sin mover su contenido y se van solos.
 *
 *   toast.exito("Venta #12 registrada")
 *   toast.error("No se pudo registrar la venta")
 *
 * <Toaster /> va una sola vez en el layout raíz.
 */

type Tipo = "exito" | "error" | "info";

interface Aviso {
  id: number;
  tipo: Tipo;
  mensaje: string;
  duracion: number;
}

const DURACION: Record<Tipo, number> = { exito: 4500, info: 4500, error: 7000 };
const MAX_VISIBLES = 4;

let avisos: Aviso[] = [];
let siguienteId = 1;
const oyentes = new Set<() => void>();

const emitir = () => oyentes.forEach((o) => o());

function agregar(tipo: Tipo, mensaje: string, duracion = DURACION[tipo]) {
  const id = siguienteId++;
  avisos = [...avisos, { id, tipo, mensaje, duracion }].slice(-MAX_VISIBLES);
  emitir();
  return id;
}

function quitar(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

export const toast = {
  exito: (mensaje: string, duracion?: number) => agregar("exito", mensaje, duracion),
  error: (mensaje: string, duracion?: number) => agregar("error", mensaje, duracion),
  info: (mensaje: string, duracion?: number) => agregar("info", mensaje, duracion),
  cerrar: quitar,
};

const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => oyentes.delete(o);
};
const SIN_AVISOS: Aviso[] = [];

const ESTILO: Record<Tipo, { icon: typeof Info; cls: string; barra: string }> = {
  exito: { icon: CheckCircle2, cls: "text-emerald-600", barra: "bg-emerald-600" },
  error: { icon: AlertCircle, cls: "text-destructive", barra: "bg-destructive" },
  info: { icon: Info, cls: "text-sky-600", barra: "bg-sky-600" },
};

/**
 * Pila de avisos arriba al centro: queda a la vista sin tapar la lista de la
 * venta/compra ni sus botones. Solo el aviso recibe clics; el espacio vacío
 * alrededor deja pasar los clics a la página.
 */
export function Toaster() {
  const lista = useSyncExternalStore(suscribir, () => avisos, () => SIN_AVISOS);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-4"
    >
      {lista.map((a) => (
        <ItemToast key={a.id} aviso={a} />
      ))}
    </div>
  );
}

function ItemToast({ aviso }: { aviso: Aviso }) {
  const { icon: Icon, cls, barra } = ESTILO[aviso.tipo];
  const [pausado, setPausado] = useState(false);
  // Tiempo que le queda; se descuenta solo mientras no está pausado.
  const restante = useRef(aviso.duracion);

  useEffect(() => {
    if (pausado) return;
    const inicio = Date.now();
    const t = setTimeout(() => quitar(aviso.id), restante.current);
    return () => {
      clearTimeout(t);
      restante.current -= Date.now() - inicio;
    };
  }, [pausado, aviso.id]);

  return (
    <div
      role={aviso.tipo === "error" ? "alert" : "status"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      className="bg-background animate-in fade-in-0 slide-in-from-top-2 pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-lg border py-3 pr-2 pl-4 shadow-lg"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", cls)} aria-hidden />
      <p className="flex-1 text-sm">{aviso.mensaje}</p>
      <button
        type="button"
        onClick={() => quitar(aviso.id)}
        aria-label="Cerrar aviso"
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -my-1 rounded-md p-1.5 outline-none focus-visible:ring-[3px]"
      >
        <X className="size-3.5" />
      </button>
      {/* Barra que muestra el tiempo que le queda; se detiene al pasar el mouse. */}
      <span
        aria-hidden
        className={cn("absolute bottom-0 left-0 h-0.5 w-full origin-left opacity-60", barra)}
        style={{
          animation: `toast-tiempo ${aviso.duracion}ms linear forwards`,
          animationPlayState: pausado ? "paused" : "running",
        }}
      />
    </div>
  );
}
