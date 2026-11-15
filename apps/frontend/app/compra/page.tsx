import type { Metadata } from "next";
import { Compra } from "@/components/compra/compra";

export const metadata: Metadata = {
  title: "Compra · Mi Tiendita",
  description: "Ingreso de mercadería de un proveedor",
};

/** ?proveedor=ID llega desde el aviso "Hacer pedido". */
export default async function CompraPage({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const { proveedor } = await searchParams;
  return <Compra proveedorInicial={proveedor} />;
}
