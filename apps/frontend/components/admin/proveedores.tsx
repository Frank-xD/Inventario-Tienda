"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Proveedor } from "@/lib/modelos";
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
import { type DatosProveedor, useAdmin } from "./admin-store";
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

export function Proveedores() {
  const { proveedores, cargando, error, guardarProveedor } = useAdmin();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todos");
  const [editando, setEditando] = useState<Proveedor | "nuevo" | null>(null);

  const texto = q.trim().toLowerCase();
  const visibles = proveedores.filter(
    (p) =>
      pasaEstado(estado, p.activo) &&
      (!texto || `${p.nombre} ${p.telefono} ${p.notas}`.toLowerCase().includes(texto)),
  );

  return (
    <>
      <Titulo descripcion="Quién te abastece y cómo contactarlo">Proveedores</Titulo>

      <div className="flex flex-wrap items-center gap-3">
        <Buscador value={q} onChange={setQ} placeholder="Buscar por nombre, teléfono o notas" />
        <div className="w-44">
          <Select
            aria-label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </Select>
        </div>
        <Button onClick={() => setEditando("nuevo")}>
          <Plus /> Nuevo proveedor
        </Button>
      </div>

      <EstadoCarga cargando={cargando} error={error} />
      <Card className="py-2">
        <CardContent className="px-2">
          {visibles.length === 0 ? (
            <SinResultados>{cargando ? "…" : "No hay proveedores que coincidan."}</SinResultados>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="tabular-nums">{p.telefono || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate">
                      {p.notas || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.productos}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge activo={p.activo} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${p.nombre}`}
                        onClick={() => setEditando(p)}
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
        titulo={editando === "nuevo" ? "Nuevo proveedor" : "Editar proveedor"}
      >
        {editando !== null && (
          <FormProveedor
            key={editando === "nuevo" ? "nuevo" : editando.id}
            inicial={editando === "nuevo" ? null : editando}
            onGuardar={async (p) => {
              await guardarProveedor(p);
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function FormProveedor({
  inicial,
  onGuardar,
}: {
  inicial: Proveedor | null;
  onGuardar: (p: DatosProveedor) => Promise<void>;
}) {
  const { enviando, error, ejecutar } = useEnvio();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [activo, setActivo] = useState(inicial?.activo ?? true);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(() => onGuardar({ id: inicial?.id, nombre, telefono, notas, activo }));
      }}
    >
      <Campo label="Nombre" htmlFor="pv-nombre">
        <Input id="pv-nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo label="Teléfono" htmlFor="pv-tel">
        <Input id="pv-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </Campo>
      <Campo label="Notas" htmlFor="pv-notas">
        <Textarea
          id="pv-notas"
          placeholder="Días de visita, pedido mínimo, contacto…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </Campo>
      {inicial && (
        <label className="flex items-center justify-between gap-4 text-sm">
          Proveedor activo
          <Switch checked={activo} onCheckedChange={setActivo} />
        </label>
      )}
      <ErrorEnvio>{error}</ErrorEnvio>
      <Button type="submit" size="lg" disabled={!nombre.trim() || enviando}>
        {enviando ? "Guardando…" : "Guardar proveedor"}
      </Button>
    </form>
  );
}
