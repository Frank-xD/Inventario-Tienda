import type { Metadata } from "next";
import { Avisos } from "@/components/admin/avisos";

export const metadata: Metadata = { title: "Avisos · Mi Tiendita" };

export default function Page() {
  return <Avisos />;
}
