import type { Metadata } from "next";
import { Configuracion } from "@/components/admin/configuracion";

export const metadata: Metadata = { title: "Configuración · Mi Tiendita" };

export default function Page() {
  return <Configuracion />;
}
