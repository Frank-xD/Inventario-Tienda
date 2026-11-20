"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PackagePlus, ShoppingCart, Store } from "lucide-react";
import { BotonSalir } from "@/components/auth/puerta-acceso";
import { Button } from "@/components/ui/button";

export const SECCIONES = [
  { href: "/compra", label: "Compra", icon: PackagePlus },
  { href: "/venta", label: "Venta", icon: ShoppingCart },
  { href: "/panel", label: "Home", icon: LayoutDashboard },
] as const;

/**
 * Encabezado común: nombre de la tienda (vuelve al inicio) + accesos a las
 * secciones. `acciones` se muestra a la derecha (p. ej. el interruptor de caja).
 */
export function AppHeader({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  const pathname = usePathname();
  // En celular todo va en una sola fila: sin subtítulo y secciones solo con ícono.
  return (
    <header className="flex items-center justify-between gap-2 sm:flex-wrap sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10"
          aria-label="Ir al inicio"
          title="Inicio"
        >
          <Store className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
          {subtitulo && <p className="text-muted-foreground hidden text-sm sm:block">{subtitulo}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:flex-wrap sm:gap-3">
        <nav className="flex items-center gap-1" aria-label="Secciones">
          {SECCIONES.map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              variant={pathname === href ? "secondary" : "ghost"}
              size="sm"
              className="size-9 sm:size-auto"
              asChild
            >
              <Link
                href={href}
                aria-label={label}
                title={label}
                aria-current={pathname === href ? "page" : undefined}
              >
                <Icon /> <span className="hidden sm:inline">{label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        {acciones}
        <BotonSalir />
      </div>
    </header>
  );
}
