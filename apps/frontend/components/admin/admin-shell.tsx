"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Popover } from "radix-ui";
import {
  BarChart3,
  Bell,
  CheckCheck,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  Tags,
  Truck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminStoreProvider, useAdmin } from "./admin-store";
import { IconoAviso } from "./avisos";

const NAV = [
  { href: "/panel", label: "Estadísticas generales", icon: BarChart3 },
  { href: "/panel/proveedores", label: "Proveedores", icon: Truck },
  { href: "/panel/categorias", label: "Categorías", icon: Tags },
  { href: "/panel/productos", label: "Productos", icon: Package },
  { href: "/panel/avisos", label: "Avisos", icon: Bell },
] as const;

const CONFIG = { href: "/panel/configuracion", label: "Configuración", icon: Settings } as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminStoreProvider>
      <Layout>{children}</Layout>
    </AdminStoreProvider>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [colapsado, setColapsado] = useState(false);
  const [movilAbierto, setMovilAbierto] = useState(false);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Escritorio: barra lateral fija, se puede plegar a solo íconos */}
      <aside
        className={cn(
          "bg-muted/40 sticky top-0 hidden h-dvh shrink-0 border-r transition-[width] duration-200 lg:block",
          colapsado ? "w-16" : "w-64",
        )}
      >
        <Sidebar colapsado={colapsado} />
      </aside>

      {/* Móvil / pantallas chicas: cajón deslizable */}
      {movilAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMovilAbierto(false)} />
          <aside className="bg-background animate-in slide-in-from-left absolute inset-y-0 left-0 w-64 border-r shadow-lg">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label="Cerrar menú"
              onClick={() => setMovilAbierto(false)}
            >
              <X />
            </Button>
            <Sidebar colapsado={false} onNavegar={() => setMovilAbierto(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setMovilAbierto(true)}
          >
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={colapsado ? "Expandir menú" : "Plegar menú"}
            title={colapsado ? "Expandir menú" : "Plegar menú"}
            onClick={() => setColapsado((c) => !c)}
          >
            {colapsado ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <Notificaciones />
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ colapsado, onNavegar }: { colapsado: boolean; onNavegar?: () => void }) {
  const pathname = usePathname();
  const { noLeidos } = useAdmin();

  const item = ({ href, label, icon: Icon }: (typeof NAV)[number] | typeof CONFIG) => {
    const activo = pathname === href;
    const badge = href === "/panel/avisos" && noLeidos > 0 ? noLeidos : null;
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavegar}
        title={colapsado ? label : undefined}
        aria-current={activo ? "page" : undefined}
        className={cn(
          "focus-visible:ring-ring/50 relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
          activo
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          colapsado && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!colapsado && <span className="flex-1 truncate">{label}</span>}
        {badge !== null &&
          (colapsado ? (
            <span className="bg-destructive absolute top-1.5 right-2.5 size-2 rounded-full" />
          ) : (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                activo ? "bg-primary-foreground/20" : "bg-destructive text-white",
              )}
            >
              {badge}
            </span>
          ))}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <Link
        href="/"
        onClick={onNavegar}
        title="Volver al inicio"
        className={cn(
          "focus-visible:ring-ring/50 flex items-center gap-3 rounded-md p-1 outline-none focus-visible:ring-[3px]",
          colapsado && "justify-center",
        )}
      >
        <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Store className="size-5" />
        </span>
        {!colapsado && <span className="text-lg font-semibold tracking-tight">Mi Tiendita</span>}
      </Link>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Panel administrativo">
        {NAV.map(item)}
      </nav>

      <div className="flex flex-col gap-1 border-t pt-3">{item(CONFIG)}</div>
    </div>
  );
}

/** Campana de la esquina superior derecha con los avisos sin leer. */
function Notificaciones() {
  const { avisos, noLeidos, marcarLeido, marcarTodosLeidos } = useAdmin();
  const [abierto, setAbierto] = useState(false);
  const recientes = avisos.filter((a) => !a.leido && !a.resuelto).slice(0, 5);

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative ml-auto"
          aria-label={noLeidos ? `Notificaciones (${noLeidos} sin leer)` : "Notificaciones"}
        >
          <Bell />
          {noLeidos > 0 && (
            <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums">
              {noLeidos > 9 ? "9+" : noLeidos}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 w-80 rounded-xl border shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {noLeidos > 0 && (
              <button
                type="button"
                onClick={() => void marcarTodosLeidos()}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
              >
                <CheckCheck className="size-3.5" /> Marcar todo como leído
              </button>
            )}
          </div>
          {recientes.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              No tienes notificaciones nuevas.
            </p>
          ) : (
            <ul className="divide-y">
              {recientes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => void marcarLeido(a.id)}
                    className="hover:bg-accent flex w-full items-start gap-3 px-4 py-3 text-left"
                    title="Marcar como leído"
                  >
                    <IconoAviso tipo={a.tipo} />
                    <span className="text-sm">
                      <span className="font-medium">{a.titulo}:</span> {a.texto}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" asChild>
              <Link href="/panel/avisos" onClick={() => setAbierto(false)}>
                Ver todos los avisos
              </Link>
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
