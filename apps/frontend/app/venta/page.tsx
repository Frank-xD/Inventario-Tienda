import type { Metadata } from "next";
import { Venta } from "@/components/venta/venta";

export const metadata: Metadata = {
  title: "Venta · Mi Tiendita",
  description: "Registrar una venta",
};

export default function VentaPage() {
  return <Venta />;
}
