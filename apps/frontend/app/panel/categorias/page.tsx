import type { Metadata } from "next";
import { Categorias } from "@/components/admin/categorias";

export const metadata: Metadata = { title: "Categorías · Mi Tiendita" };

export default function Page() {
  return <Categorias />;
}
