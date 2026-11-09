import type { Metadata } from "next";
import { Catalogo } from "@/components/catalogo/catalogo";

export const metadata: Metadata = {
  title: "Catálogo · Mi Tiendita",
  description: "Precios y disponibilidad de productos",
};

export default function CatalogoPage() {
  return <Catalogo />;
}
