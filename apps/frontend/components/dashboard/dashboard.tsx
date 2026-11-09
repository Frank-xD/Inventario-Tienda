"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { api, type Product, type StatsSummary } from "@/lib/api";
import { getInventorySocket, useSocketConnected } from "@/lib/socket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockChart } from "./stock-chart";

async function fetchDashboard() {
  const [products, stats] = await Promise.all([
    api<Product[]>("/products"),
    api<StatsSummary>("/stats/summary"),
  ]);
  return { products, stats };
}

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const connected = useSocketConnected();
  const [error, setError] = useState<string | null>(null);

  // Los setState ocurren en callbacks de la promesa (no síncronos en el efecto).
  const load = useCallback(() => {
    fetchDashboard()
      .then(({ products, stats }) => {
        setProducts(products);
        setStats(stats);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
    const socket = getInventorySocket();
    // "connect" también resincroniza tras una reconexión.
    const events = ["connect", "product:created", "product:updated", "product:deleted", "stock:changed"];
    events.forEach((e) => socket.on(e, load));
    return () => {
      events.forEach((e) => socket.off(e, load));
    };
  }, [load]);

  const move = (id: number, type: "IN" | "OUT") =>
    api(`/products/${id}/movements`, {
      method: "POST",
      body: JSON.stringify({ type, quantity: 1 }),
    }).catch((e) => setError(String(e)));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario Tienda</h1>
          <p className="text-muted-foreground text-sm">Productos y disponibilidad en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "secondary" : "outline"}>
            <span
              className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground"}`}
            />
            {connected ? "En vivo" : "Desconectado"}
          </Badge>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw /> Recargar
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Productos" value={stats?.totalProducts ?? "—"} />
        <Stat label="Unidades" value={stats?.totalUnits ?? "—"} />
        <Stat label="Valor del inventario" value={stats ? money.format(stats.inventoryValue) : "—"} />
        <Stat label="Stock bajo" value={stats?.lowStock ?? "—"} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Stock por categoría</CardTitle>
          <CardDescription>Unidades disponibles de productos activos</CardDescription>
        </CardHeader>
        <CardContent>{stats && <StockChart data={stats.byCategory} />}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">{money.format(Number(p.price))}</TableCell>
                  <TableCell className="text-right">
                    {p.stock <= p.minStock ? (
                      <Badge variant="destructive">{p.stock} · bajo</Badge>
                    ) : (
                      p.stock
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Restar una unidad"
                        disabled={p.stock === 0}
                        onClick={() => move(p.id, "OUT")}
                      >
                        <Minus />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Sumar una unidad"
                        onClick={() => move(p.id, "IN")}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 text-2xl font-semibold tabular-nums">{value}</CardContent>
    </Card>
  );
}
