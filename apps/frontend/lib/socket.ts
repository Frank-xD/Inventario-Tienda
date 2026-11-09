import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

let socket: Socket | null = null;

/** Socket compartido al namespace /inventory del backend. */
export function getInventorySocket(): Socket {
  socket ??= io(`${API_URL}/inventory`, { transports: ["websocket"] });
  return socket;
}

function subscribe(onChange: () => void) {
  const s = getInventorySocket();
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
    () => getInventorySocket().connected,
    () => false,
  );
}
