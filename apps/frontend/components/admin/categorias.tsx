"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Categoria } from "@/lib/modelos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type DatosCategoria, useAdmin } from "./admin-store";
import {
  Buscador,
  Campo,
  ErrorEnvio,
  EstadoBadge,
  EstadoCarga,
  pasaEstado,
  SinResultados,
  Titulo,
  type FiltroEstado,
  useEnvio,
} from "./comun";

export function Categorias() {
  const { categorias, cargando, error, guardarCategoria } = useAdmin();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todos");
  const [editando, setEditando] = useState<Categoria | "nuevo" | null>(null);

  const texto = q.trim().toLowerCase();
  const visibles = categorias.filter(
    (c) => pasaEstado(estado, c.activa) && (!texto || c.nombre.toLowerCase().includes(texto)),
  );

  return (
    <>
      <Titulo descripcion="Agrupa los productos; las ocultas no salen en el catálogo público">
        Categorías
      </Titulo>

      <div className="flex flex-wrap items-center gap-3">
        <Buscador value={q} onChange={setQ} placeholder="Buscar categoría por nombre" />
        <div className="w-44">
          <Select
            aria-label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activos">Activas</option>
            <option value="inactivos">Ocultas</option>
          </Select>
        </div>
        <Button onClick={() => setEditando("nuevo")}>
          <Plus /> Nueva categoría
        </Button>
      </div>

      <EstadoCarga cargando={cargando} error={error} />
      <Card className="py-2">
        <CardContent className="px-2">
          {visibles.length === 0 ? (
            <SinResultados>{cargando ? "…" : "No hay categorías que coincidan."}</SinResultados>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.productos}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge activo={c.activa} textoActivo="Activa" textoInactivo="Oculta" />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${c.nombre}`}
                        onClick={() => setEditando(c)}
                      >
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
        titulo={editando === "nuevo" ? "Nueva categoría" : "Editar categoría"}
        className="max-w-sm"
      >
        {editando !== null && (
          <FormCategoria
            key={editando === "nuevo" ? "nuevo" : editando.id}
            inicial={editando === "nuevo" ? null : editando}
            existentes={categorias}
            onGuardar={async (c) => {
              await guardarCategoria(c);
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function FormCategoria({
  inicial,
  existentes,
  onGuardar,
}: {
  inicial: Categoria | null;
  existentes: Categoria[];
  onGuardar: (c: DatosCategoria) => Promise<void>;
}) {
  const { enviando, error, ejecutar } = useEnvio();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [activa, setActiva] = useState(inicial?.activa ?? true);
  // En la BD el nombre es único.
  const repetida = existentes.some(
    (c) => c.id !== inicial?.id && c.nombre.toLowerCase() === nombre.trim().toLowerCase(),
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(() => onGuardar({ id: inicial?.id, nombre, activa }));
      }}
    >
      <Campo label="Nombre" htmlFor="cat-nombre">
        <Input
          id="cat-nombre"
          required
          autoFocus
          value={nombre}
          aria-invalid={repetida}
          onChange={(e) => setNombre(e.target.value)}
        />
        {repetida && <p className="text-destructive text-xs">Ya existe una categoría con ese nombre.</p>}
      </Campo>
      <label className="flex items-center justify-between gap-4 text-sm">
        Visible en el catálogo
        <Switch checked={activa} onCheckedChange={setActiva} />
      </label>
      <ErrorEnvio>{error}</ErrorEnvio>
      <Button type="submit" size="lg" disabled={!nombre.trim() || repetida || enviando}>
        {enviando ? "Guardando…" : "Guardar categoría"}
      </Button>
    </form>
  );
}
