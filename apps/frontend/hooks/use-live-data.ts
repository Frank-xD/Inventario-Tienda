"use client";

import { useCallback, useEffect, useState } from "react";
import { suscribir } from "@/lib/socket";

/**
 * Carga datos con `fetcher` y los vuelve a pedir cuando el backend emite
 * alguno de `eventos` por Socket.IO.
 */
export function useLiveData<T>(fetcher: () => Promise<T>, eventos: string[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clave = eventos.join("|");

  // Los setState ocurren en callbacks de la promesa (no síncronos en el efecto).
  const recargar = useCallback(() => {
    fetcher()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [fetcher]);

  useEffect(() => {
    recargar();
    return suscribir(clave.split("|"), recargar);
  }, [recargar, clave]);

  return { data, error, recargar };
}
