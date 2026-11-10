"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Megaphone, Search, Package } from "lucide-react";
import { api, bs, urlApi, type Anuncio, type ProductoCatalogo, type Tienda } from "@/lib/api";
import { sufijoPrecio } from "@/lib/cantidad";
import { useLiveData } from "@/hooks/use-live-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fetchCatalogo = () => api<ProductoCatalogo[]>("/publico/catalogo");
const fetchAnuncios = () => api<Anuncio[]>("/publico/anuncios");
const fetchTienda = () => api<Tienda>("/publico/tienda");

const DISPONIBILIDAD = {
  disponible: { texto: "Disponible", variant: "secondary" },
  pocas_unidades: { texto: "Pocas unidades", variant: "outline" },
  agotado: { texto: "Agotado", variant: "destructive" },
} as const;

/** Portal público: precios y disponibilidad (sin cifras exactas de stock). */
export function Catalogo() {
  const catalogo = useLiveData(fetchCatalogo, ["stock:actualizado", "producto:actualizado", "categoria:actualizada"]);
  const anuncios = useLiveData(fetchAnuncios, ["anuncios:actualizados"]);
  const tienda = useLiveData(fetchTienda, ["configuracion:actualizada"]);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const categorias = useMemo(
    () => [...new Set(catalogo.data?.map((p) => p.categoria))],
    [catalogo.data],
  );
  const productos = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return (catalogo.data ?? []).filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (!texto || p.nombre.toLowerCase().includes(texto)),
    );
  }, [catalogo.data, q, categoria]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tienda.data?.nombreTienda ?? "Mi Tiendita"}</h1>
          <p className="text-muted-foreground text-sm">
            Precios y disponibilidad al momento
            {tienda.data?.telefono && <> · Tel. {tienda.data.telefono}</>}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/panel">
            <ArrowLeft /> Panel
          </Link>
        </Button>
      </header>

      {anuncios.data?.map((a) => (
        <Card key={a.id} className="bg-secondary flex-row items-center gap-3 px-4 py-3">
          <Megaphone className="size-4 shrink-0" aria-hidden />
          <p className="text-sm">{a.texto}</p>
        </Card>
      ))}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Buscar producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar producto"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={categoria === null ? "default" : "outline"}
            onClick={() => setCategoria(null)}
          >
            Todas
          </Button>
          {categorias.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={categoria === c ? "default" : "outline"}
              onClick={() => setCategoria(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {catalogo.error && <p className="text-destructive text-sm">{catalogo.error}</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((p) => {
          const d = DISPONIBILIDAD[p.disponibilidad];
          return (
            <Card key={p.id} className="gap-3 overflow-hidden pt-0 pb-4">
              <div className="bg-muted text-muted-foreground flex aspect-[4/3] items-center justify-center">
                {p.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen servida por la API
                  <img src={urlApi(p.fotoUrl)!} alt={p.nombre} loading="lazy" className="size-full object-cover" />
                ) : (
                  <Package className="size-8" aria-hidden />
                )}
              </div>
              <CardContent className="flex flex-col gap-2 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-muted-foreground text-xs">{p.categoria}</p>
                  </div>
                  <Badge variant={d.variant}>{d.texto}</Badge>
                </div>
                <p className="text-lg font-semibold tabular-nums">
                  {bs.format(Number(p.precio))}
                  <span className="text-muted-foreground text-sm font-normal">{sufijoPrecio(p.unidadMedida)}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
        {catalogo.data && productos.length === 0 && (
          <p className="text-muted-foreground col-span-full py-10 text-center text-sm">
            No encontramos productos con ese criterio.
          </p>
        )}
      </section>
    </div>
  );
}
