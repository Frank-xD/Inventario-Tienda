import Link from "next/link";
import { ArrowRight, LayoutDashboard, PackagePlus, ShoppingCart, Store } from "lucide-react";

const OPCIONES = [
  {
    href: "/venta",
    titulo: "Venta",
    descripcion: "Registrar una venta escaneando o buscando productos.",
    icon: ShoppingCart,
    destacado: true,
  },
  {
    href: "/compra",
    titulo: "Compra",
    descripcion: "Ingresar mercadería de un proveedor con su fecha de vencimiento.",
    icon: PackagePlus,
    destacado: false,
  },
] as const;

/**
 * Pantalla de entrada: acceso a Venta y Compra. El logo de la tienda del
 * centro lleva al panel administrativo (Home).
 */
export function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 p-4 sm:p-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <Link
          href="/panel"
          title="Panel administrativo"
          aria-label="Ir al panel administrativo"
          className="group bg-primary text-primary-foreground focus-visible:ring-ring/50 relative flex size-16 items-center justify-center rounded-2xl shadow-sm transition-all outline-none hover:scale-105 hover:shadow-md focus-visible:ring-[3px]"
        >
          <Store className="size-8" />
          <span className="bg-background text-foreground absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full border shadow-sm transition-transform group-hover:rotate-12">
            <LayoutDashboard className="size-3.5" />
          </span>
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mi Tiendita</h1>
          <p className="text-muted-foreground">¿Qué quieres hacer?</p>
        </div>
      </header>

      <nav className="grid gap-4 sm:grid-cols-2" aria-label="Secciones">
        {OPCIONES.map(({ href, titulo, descripcion, icon: Icon, destacado }) => (
          <Link
            key={href}
            href={href}
            className={`group focus-visible:ring-ring/50 flex flex-col gap-6 rounded-xl border p-6 shadow-sm transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] ${
              destacado
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-card hover:bg-accent"
            }`}
          >
            <div
              className={`flex size-12 items-center justify-center rounded-lg ${
                destacado ? "bg-primary-foreground/15" : "bg-secondary"
              }`}
            >
              <Icon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-xl font-semibold">
                {titulo}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </span>
              <span
                className={`text-sm ${destacado ? "text-primary-foreground/75" : "text-muted-foreground"}`}
              >
                {descripcion}
              </span>
            </div>
          </Link>
        ))}
      </nav>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/catalogo" className="underline-offset-4 hover:underline">
          Ver catálogo público
        </Link>
      </p>
    </main>
  );
}
