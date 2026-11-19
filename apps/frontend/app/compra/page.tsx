import type { Metadata } from "next";
import { Compra } from "@/components/compra/compra";

export const metadata: Metadata = {
  title: "Compra · Mi Tiendita",
  description: "Ingreso de mercadería de un proveedor",
};

export default function CompraPage() {
  return <Compra />;
}
