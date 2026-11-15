import type { Metadata } from "next";
import { Productos } from "@/components/admin/productos";

export const metadata: Metadata = { title: "Productos · Mi Tiendita" };

/** ?producto=ID llega desde un aviso y abre ese producto. */
export default async function Page({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
  const { producto } = await searchParams;
  return <Productos productoInicial={Number(producto) || null} />;
}
