"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Titulo({ children, descripcion }: { children: React.ReactNode; descripcion?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {descripcion && <p className="text-muted-foreground text-sm">{descripcion}</p>}
    </div>
  );
}

export function Buscador({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function EstadoBadge({ activo, textoInactivo = "Inactivo", textoActivo = "Activo" }: {
  activo: boolean;
  textoActivo?: string;
  textoInactivo?: string;
}) {
  return (
    <Badge variant={activo ? "secondary" : "outline"} className={activo ? "" : "text-muted-foreground"}>
      <span className={`size-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-muted-foreground"}`} />
      {activo ? textoActivo : textoInactivo}
    </Badge>
  );
}

export function Campo({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function SinResultados({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-10 text-center text-sm">{children}</p>;
}

/**
 * Envío de un formulario a la API: evita doble clic mientras espera y
 * guarda el mensaje de error del backend para mostrarlo.
 */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ejecutar = async (fn: () => Promise<void>) => {
    if (enviando) return false;
    setEnviando(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setEnviando(false);
    }
  };
  return { enviando, error, setError, ejecutar };
}

export function ErrorEnvio({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
      {children}
    </p>
  );
}

/** Aviso de carga o error al pedir los datos de una sección. */
export function EstadoCarga({ cargando, error }: { cargando: boolean; error: string | null }) {
  if (error)
    return (
      <ErrorEnvio>
        No se pudo conectar con el servidor: {error}. Revisa que el backend esté encendido.
      </ErrorEnvio>
    );
  if (cargando) return <p className="text-muted-foreground py-10 text-center text-sm">Cargando…</p>;
  return null;
}

export type FiltroEstado = "todos" | "activos" | "inactivos";

export const pasaEstado = (filtro: FiltroEstado, activo: boolean) =>
  filtro === "todos" || (filtro === "activos") === activo;
