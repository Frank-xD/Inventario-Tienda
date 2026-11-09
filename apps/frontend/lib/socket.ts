import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

let socket: Socket | null = null;

/** Socket compartido al namespace /tienda del backend. */
export function getSocket(): Socket {
  socket ??= io(`${API_URL}/tienda`, { transports: ["websocket"] });
  return socket;
}

function subscribe(onChange: () => void) {
  const s = getSocket();
  s.on("connect", onChange);
  s.on("disconnect", onChange);
  return () => {
    s.off("connect", onChange);
    s.off("disconnect", onChange);
  };
}

/** Estado de conexión del socket en tiempo real. */
export function useSocketConnected(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSocket().connected,
    () => false,
  );
}

/**
 * Llama a `onEvento` cuando llega cualquiera de los eventos indicados
 * (y al reconectar, para resincronizar).
 */
export function suscribir(eventos: string[], onEvento: () => void): () => void {
  const s = getSocket();
  const todos = ["connect", ...eventos];
  todos.forEach((e) => s.on(e, onEvento));
  return () => todos.forEach((e) => s.off(e, onEvento));
}
