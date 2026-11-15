import type { Metadata } from "next";
import { Registros } from "@/components/admin/registros";

export const metadata: Metadata = { title: "Registros · Mi Tiendita" };

export default function Page() {
  return <Registros />;
}
