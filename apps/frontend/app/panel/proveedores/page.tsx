import type { Metadata } from "next";
import { Proveedores } from "@/components/admin/proveedores";

export const metadata: Metadata = { title: "Proveedores · Mi Tiendita" };

export default function Page() {
  return <Proveedores />;
}
