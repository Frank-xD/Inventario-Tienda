import type { Metadata } from "next";
import { Productos } from "@/components/admin/productos";

export const metadata: Metadata = { title: "Productos · Mi Tiendita" };

export default function Page() {
  return <Productos />;
}
