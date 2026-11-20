"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bs, type VentaDiaria } from "@/lib/api";

const diaCorto = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", timeZone: "UTC" });
const diaLargo = new Intl.DateTimeFormat("es-BO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function SalesChart({ data }: { data: VentaDiaria[] }) {
  return (
    // Más bajo en celular para no ocupar toda la pantalla.
    <div className="h-44 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) => diaCorto.format(new Date(d))}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            minTickGap={16}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            // Miles abreviados ("Bs 1,2k") para que el eje no le quite ancho a las barras.
            tickFormatter={(v: number) =>
              v >= 1000 ? `Bs ${(v / 1000).toLocaleString("es-BO", { maximumFractionDigits: 1 })}k` : `Bs ${v}`
            }
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(d) => diaLargo.format(new Date(String(d)))}
            formatter={(value, _name, item) => [
              `${bs.format(Number(value))} · ${(item.payload as VentaDiaria).ventas} ventas`,
              "Total",
            ]}
          />
          <Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
