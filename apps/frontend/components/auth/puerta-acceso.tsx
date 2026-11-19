"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, LogOut, Store } from "lucide-react";
import { enviar } from "@/lib/api";
import { cerrarSesion, guardarSesion, useSesion } from "@/lib/sesion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Páginas que se ven sin contraseña (para clientes). */
const PUBLICAS = ["/catalogo"];

/**
 * Pide la contraseña antes de mostrar el sistema. La API también la exige,
 * así que esto no es solo visual: sin token el backend responde 401.
 */
export function PuertaAcceso({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sesion = useSesion();

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return children;
  // En el servidor (y en el primer pintado) todavía no se sabe si hay sesión.
  if (sesion === undefined) return <div className="flex-1" aria-busy />;
  if (!sesion) return <FormAcceso />;
  return children;
}

function FormAcceso() {
  const [contrasena, setContrasena] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const { token } = await enviar<{ token: string }>("POST", "/auth/login", { contrasena });
      guardarSesion(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
      setContrasena("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-muted/40 flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
              <Store className="size-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Mi Tiendita</h1>
              <p className="text-muted-foreground text-sm">Ingresa la contraseña para continuar</p>
            </div>
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (contrasena && !enviando) void entrar();
            }}
          >
            <div className="relative">
              <LockKeyhole className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                type={ver ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                aria-label="Contraseña"
                placeholder="Contraseña"
                className="pr-10 pl-9"
                aria-invalid={!!error}
                value={contrasena}
                onChange={(e) => {
                  setContrasena(e.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                onClick={() => setVer((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 p-1"
                aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={!contrasena || enviando}>
              {enviando ? "Verificando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Cierra la sesión en este navegador y vuelve a pedir la contraseña. */
export function BotonSalir() {
  return (
    <Button variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={cerrarSesion}>
      <LogOut />
    </Button>
  );
}
