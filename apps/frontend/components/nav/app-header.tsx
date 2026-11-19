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
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg"
          aria-label="Ir al inicio"
          title="Inicio"
        >
          <Store className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="text-muted-foreground text-sm">{subtitulo}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex items-center gap-1" aria-label="Secciones">
          {SECCIONES.map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              variant={pathname === href ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <Link href={href} aria-current={pathname === href ? "page" : undefined}>
                <Icon /> {label}
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
