"use client";

import { useSyncExternalStore } from "react";

export type Tema = "claro" | "oscuro";

const CLAVE = "tema"; // misma clave que el script de app/layout.tsx


function suscribir(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

/** Tema actual (leído de la clase `dark` del <html>) y función para cambiarlo. */
export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore<Tema>(
    suscribir,
    () => (document.documentElement.classList.contains("dark") ? "oscuro" : "claro"),
    () => "claro",
  );
  const cambiar = (t: Tema) => {
    document.documentElement.classList.toggle("dark", t === "oscuro");
    try {
      localStorage.setItem(CLAVE, t);
    } catch {
      /* almacenamiento bloqueado: el cambio dura hasta recargar */
    }
  };
  return [tema, cambiar];
}
