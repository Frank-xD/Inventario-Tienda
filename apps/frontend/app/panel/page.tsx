import type { Metadata } from "next";
import { Estadisticas } from "@/components/admin/estadisticas";

export const metadata: Metadata = { title: "Estadísticas generales · Mi Tiendita" };

export default function Page() {
  return <Estadisticas />;
}
