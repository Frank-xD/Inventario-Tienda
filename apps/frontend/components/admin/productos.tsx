"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, Loader2, Package, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { bs } from "@/lib/api";
import { errorCantidad, formatCantidad, pasoCantidad } from "@/lib/cantidad";
import { comprimirImagen, formatoBytes } from "@/lib/imagen";
import { nombreDe, type Producto, type UnidadMedida } from "@/lib/modelos";
import { BotonCamara, useHayCamara } from "@/components/scanner/codigo-input";
import { FotoCamara } from "@/components/scanner/foto-camara";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type CambioFoto, type DatosProducto, useAdmin } from "./admin-store";
import {
  Buscador,
  Campo,
  ErrorEnvio,
  EstadoCarga,
  type FiltroEstado,
  pasaEstado,
  SinResultados,
  Titulo,
  useEnvio,
} from "./comun";

export function Productos() {
  const { productos, categorias, proveedores, cargando, error, guardarProducto } = useAdmin();
  const [q, setQ] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("activos");
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);

  const texto = q.trim().toLowerCase();
  const visibles = productos.filter(
    (p) =>
      pasaEstado(estado, p.activo) &&
      (!categoriaId || p.categoriaId === Number(categoriaId)) &&
      (!proveedorId || p.proveedorId === Number(proveedorId)) &&
      (!texto || p.nombre.toLowerCase().includes(texto) || p.codigoBarras.includes(texto)),
  );
  const activos = productos.filter((p) => p.activo).length;

  return (
    <>
      <Titulo descripcion={cargando ? "Cargando…" : `${activos} productos activos`}>Productos</Titulo>

      <div className="flex flex-wrap items-center gap-3">
        <Buscador value={q} onChange={setQ} placeholder="Buscar por nombre o código de barras" />
        <div className="w-44">
          <Select aria-label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Categoría: Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select aria-label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Proveedor: Todos</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </Select>
        </div>
        <Button onClick={() => setEditando("nuevo")}>
          <Plus /> Nuevo producto
        </Button>
      </div>

      <EstadoCarga cargando={cargando} error={error} />
      <Card className="py-2">
        <CardContent className="px-2">
          {visibles.length === 0 ? (
            <SinResultados>{cargando ? "…" : "No hay productos que coincidan."}</SinResultados>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((p) => (
                  <TableRow key={p.id} className={p.activo ? "" : "text-muted-foreground"}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Miniatura url={p.fotoUrl} />
                        <span className="font-medium">{p.nombre}</span>
                        {!p.activo && <Badge variant="outline">Inactivo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{p.codigoBarras || "—"}</TableCell>
                    <TableCell>{nombreDe(categorias, p.categoriaId)}</TableCell>
                    <TableCell>{nombreDe(proveedores, p.proveedorId)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {bs.format(p.precio)}
                      <span className="text-muted-foreground text-xs"> /{p.unidadMedida === "kg" ? "kg" : "u"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.stock <= 0 ? (
                        <Badge variant="destructive">Agotado</Badge>
                      ) : p.stock <= p.stockMinimo ? (
                        <Badge variant="outline" className="tabular-nums text-amber-600">
                          {formatCantidad(p.stock, p.unidadMedida)} · bajo
                        </Badge>
                      ) : (
                        <span className="tabular-nums">{formatCantidad(p.stock, p.unidadMedida)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Editar ${p.nombre}`} onClick={() => setEditando(p)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={editando !== null}
        onOpenChange={(o) => !o && setEditando(null)}
        titulo={editando === "nuevo" ? "Nuevo producto" : "Editar producto"}
        descripcion={
          editando === "nuevo"
            ? "El stock se suma registrando una compra (o con un ajuste de inventario)."
            : undefined
        }
        className="max-w-3xl"
      >
        {editando !== null && (
          <FormProducto
            key={editando === "nuevo" ? "nuevo" : editando.id}
            inicial={editando === "nuevo" ? null : editando}
            onGuardar={async (p, foto) => {
              await guardarProducto(p, foto);
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function Miniatura({ url }: { url: string | null }) {
  return (
    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen servida por la API
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <Package className="size-4" />
      )}
    </span>
  );
}

function FormProducto({
  inicial,
  onGuardar,
}: {
  inicial: Producto | null;
  onGuardar: (p: DatosProducto, foto: CambioFoto) => Promise<void>;
}) {
  const { categorias, proveedores, productos } = useAdmin();
  const { enviando, error, ejecutar } = useEnvio();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [codigo, setCodigo] = useState(inicial?.codigoBarras ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [categoriaId, setCategoriaId] = useState(inicial ? String(inicial.categoriaId) : "");
  const [proveedorId, setProveedorId] = useState(inicial?.proveedorId ? String(inicial.proveedorId) : "");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precio) : "");
  const [unidad, setUnidad] = useState<UnidadMedida>(inicial?.unidadMedida ?? "unidad");
  const [stockMinimo, setStockMinimo] = useState(String(inicial?.stockMinimo ?? 0));
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [foto, setFoto] = useState<CambioFoto>({ tipo: "mantener" });

  // En la BD el código de barras es único.
  const codigoRepetido =
    !!codigo.trim() && productos.find((p) => p.codigoBarras === codigo.trim() && p.id !== inicial?.id);

  // Mismas reglas que la BD (trg_validar_unidad_producto).
  const errorMinimo =
    stockMinimo !== "" && Number(stockMinimo) !== 0 ? errorCantidad(Number(stockMinimo), unidad) : null;
  const errorUnidad =
    unidad === "unidad" && inicial && !Number.isInteger(inicial.stock)
      ? `Tiene ${formatCantidad(inicial.stock, "kg")} en stock: no puede pasar a venderse por unidad.`
      : null;

  const valido =
    nombre.trim() &&
    categoriaId &&
    proveedorId &&
    precio !== "" &&
    Number(precio) > 0 &&
    !codigoRepetido &&
    !errorMinimo &&
    !errorUnidad;

  return (
    <form
      className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valido) return;
        void ejecutar(() =>
          onGuardar(
            {
              id: inicial?.id,
              nombre,
              codigoBarras: codigo,
              descripcion,
              categoriaId: Number(categoriaId),
              proveedorId: Number(proveedorId),
              precio: Number(precio),
              unidadMedida: unidad,
              stockMinimo: Number(stockMinimo) || 0,
              activo,
            },
            foto,
          ),
        );
      }}
    >
      <div className="flex flex-col gap-4">
        <Campo label="Nombre" htmlFor="pr-nombre">
          <Input id="pr-nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo label="Código de barras" htmlFor="pr-codigo">
          <div className="flex gap-2">
            <Input
              id="pr-codigo"
              inputMode="numeric"
              className="font-mono"
              placeholder="Opcional (granel, pan…)"
              value={codigo}
              aria-invalid={!!codigoRepetido}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <BotonCamara onDetectado={setCodigo} />
          </div>
          {codigoRepetido && <p className="text-destructive text-xs">Ese código ya es de {codigoRepetido.nombre}.</p>}
        </Campo>
        <Campo label="Descripción" htmlFor="pr-desc">
          <Textarea id="pr-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Categoría" htmlFor="pr-cat">
            <Select id="pr-cat" required value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Elegir…</option>
              {categorias
                .filter((c) => c.activa || String(c.id) === categoriaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Select>
          </Campo>
          <Campo label="Proveedor" htmlFor="pr-prov">
            <Select id="pr-prov" required value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Elegir…</option>
              {proveedores
                .filter((p) => p.activo || String(p.id) === proveedorId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </Select>
          </Campo>
        </div>
        {inicial && (
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              Producto activo
              <span className="text-muted-foreground block text-xs">Los inactivos no se venden ni salen en el catálogo.</span>
            </span>
            <Switch checked={activo} onCheckedChange={setActivo} />
          </label>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Campo label="Foto">
          <SelectorFoto actual={inicial?.fotoUrl ?? null} cambio={foto} onCambio={setFoto} />
        </Campo>
        <Campo label="Precio de venta" htmlFor="pr-precio">
          <div className="flex items-center gap-2">
            <Input
              id="pr-precio"
              type="number"
              min={0}
              step="0.01"
              required
              placeholder="Bs"
              className="tabular-nums"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">por</span>
            <div className="w-28 shrink-0">
              <Select aria-label="Unidad de venta" value={unidad} onChange={(e) => setUnidad(e.target.value as UnidadMedida)}>
                <option value="unidad">Unidad</option>
                <option value="kg">Kg</option>
              </Select>
            </div>
          </div>
        </Campo>
        {errorUnidad && <p className="text-destructive -mt-2 text-xs">{errorUnidad}</p>}
        <Campo label={unidad === "kg" ? "Stock mínimo en kg (para alertas)" : "Stock mínimo (para alertas)"} htmlFor="pr-min">
          <Input
            id="pr-min"
            type="number"
            {...pasoCantidad(unidad)}
            min={0}
            className="tabular-nums"
            value={stockMinimo}
            aria-invalid={!!errorMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
          />
          {errorMinimo && <p className="text-destructive text-xs">{errorMinimo}</p>}
        </Campo>
        <ErrorEnvio>{error}</ErrorEnvio>
        <Button type="submit" size="lg" className="mt-auto" disabled={!valido || enviando}>
          {enviando ? "Guardando…" : "Guardar producto"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Foto del producto: desde un archivo del equipo o con la cámara. Se
 * comprime en el navegador (WebP, ≤ 1024 px, ~200 KB) antes de subirla.
 */
function SelectorFoto({
  actual,
  cambio,
  onCambio,
}: {
  actual: string | null;
  cambio: CambioFoto;
  onCambio: (c: CambioFoto) => void;
}) {
  const hayCamara = useHayCamara();
  const [camara, setCamara] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // URL temporal para la vista previa de la foto nueva; se libera al cambiar.
  const vistaPrevia = useMemo(() => (cambio.tipo === "subir" ? URL.createObjectURL(cambio.blob) : null), [cambio]);
  useEffect(() => () => void (vistaPrevia && URL.revokeObjectURL(vistaPrevia)), [vistaPrevia]);

  const procesar = async (original: Blob) => {
    setProcesando(true);
    setError(null);
    try {
      const r = await comprimirImagen(original);
      onCambio({ tipo: "subir", blob: r.blob });
      setInfo(`${r.ancho}×${r.alto} · ${formatoBytes(r.original)} → ${formatoBytes(r.blob.size)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcesando(false);
    }
  };

  const url = cambio.tipo === "subir" ? vistaPrevia : cambio.tipo === "quitar" ? null : actual;

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted/40 relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border">
        {procesando ? (
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Comprimiendo…
          </span>
        ) : url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local o imagen de la API */}
            <img src={url} alt="Foto del producto" className="size-full object-cover" />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              aria-label="Quitar foto"
              onClick={() => {
                onCambio(actual ? { tipo: "quitar" } : { tipo: "mantener" });
                setInfo(null);
              }}
            >
              <Trash2 />
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
            <ImagePlus className="size-8" /> Sin foto
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            <Upload /> Archivo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ""; // permite volver a elegir el mismo archivo
                if (f) void procesar(f);
              }}
            />
          </label>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={hayCamara === false}
          title={hayCamara === false ? "No se detectó una cámara" : undefined}
          onClick={() => setCamara(true)}
        >
          <Camera /> Cámara
        </Button>
      </div>
      {info && <p className="text-muted-foreground text-xs tabular-nums">{info}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
      <FotoCamara
        open={camara}
        onOpenChange={setCamara}
        onCaptura={(blob) => {
          setCamara(false);
          void procesar(blob);
        }}
      />
    </div>
  );
}
