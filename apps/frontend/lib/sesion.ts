import { useSyncExternalStore } from "react";

/**
 * Sesión del sistema: el token que entrega POST /auth/login ("<vence>.<firma>")
 * guardado en este navegador. Dura 12 horas; al vencer o al recibir un 401 se
 * borra y vuelve a aparecer la ventana de contraseña.
 */
const CLAVE = "sesion";
const avisos = new Set<() => void>();
const notificar = () => avisos.forEach((f) => f());

function leer(): string | null {
  try {
    const token = localStorage.getItem(CLAVE);
    if (!token) return null;
    if (Number(token.split(".")[0]) < Date.now()) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export const tokenSesion = leer;

export function guardarSesion(token: string) {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    // Sin almacenamiento (modo privado estricto): la sesión dura lo que la pestaña.
  }
  memoria = token;
  notificar();
}

export function cerrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {}
  memoria = null;
  notificar();
}

// Respaldo por si localStorage no está disponible.
let memoria: string | null = null;
const actual = () => leer() ?? memoria;

function suscribir(aviso: () => void) {
  avisos.add(aviso);
  // Otra pestaña inició o cerró sesión.
  const alCambiar = (e: StorageEvent) => e.key === CLAVE && aviso();
  window.addEventListener("storage", alCambiar);
  return () => {
    avisos.delete(aviso);
    window.removeEventListener("storage", alCambiar);
  };
}

/**
 * Token actual: string, null (sin sesión) o undefined en el servidor, donde
 * todavía no se sabe (así la página se sigue prerenderizando como estática).
 */
export function useSesion(): string | null | undefined {
  return useSyncExternalStore(suscribir, actual, () => undefined);
}

export { actual as tokenActual };
