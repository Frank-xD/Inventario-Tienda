"use client";

import { useSyncExternalStore } from "react";

const suscribir = (aviso: () => void) => {
  window.addEventListener("popstate", aviso);
  return () => window.removeEventListener("popstate", aviso);
};

/**
 * Lee un parámetro de la URL (?proveedor=3) en el navegador. En el servidor
 * devuelve null, así la página se sigue prerenderizando como estática
 * (cacheComponents) en vez de esperar a cada petición.
 */
export function useParametroUrl(nombre: string): string | null {
  return useSyncExternalStore(
    suscribir,
    () => new URLSearchParams(window.location.search).get(nombre),
    () => null,
  );
}
