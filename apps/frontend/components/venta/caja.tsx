"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Lock, LockOpen, Wallet } from "lucide-react";
import { bs, enviar, type CajaActual, type MovimientoCajaApi } from "@/lib/api";
import { useCaja } from "@/hooks/use-datos";
import { Campo, ErrorEnvio, useEnvio } from "@/components/admin/comun";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const hora = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" });

type Vista = "resumen" | "abrir" | "cerrar";

const TITULO: Record<Vista, string> = {
  resumen: "Caja",
  abrir: "Abrir caja",
  cerrar: "Cerrar caja",
};
const DESCRIPCION: Partial<Record<Vista, string>> = {
  abrir: "¿Con cuánto efectivo empiezas el día (cambio)?",
  cerrar: "Cuenta el efectivo del cajón y anótalo.",
};

/**
 * Botón "Caja" del encabezado del panel (junto a las notificaciones). Abre un
 * modal con el interruptor para abrir/cerrar la caja, su resumen y el registro
 * de ingresos o egresos extra. Sin caja abierta el backend no registra ventas.
 */
export function CajaEncabezado() {
  const cajaQ = useCaja();
  const caja = cajaQ.data?.caja ?? null;
  const cargando = cajaQ.cargando;
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>("resumen");

  const cerrarModal = () => {
    setAbierto(false);
    setVista("resumen");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(!cargando && !caja && "border-amber-500/50 bg-amber-500/10")}
        aria-label={cargando ? "Caja" : caja ? "Caja abierta" : "Caja cerrada"}
        title={caja ? `Caja abierta desde las ${hora.format(new Date(caja.abiertaEn))}` : "Caja cerrada"}
        onClick={() => setAbierto(true)}
      >
        <Wallet />
        <span className="hidden sm:inline">Caja</span>
        {!cargando && (
          <span className={cn("size-2 rounded-full", caja ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
        )}
      </Button>

      <Modal
        open={abierto}
        onOpenChange={(o) => (o ? setAbierto(true) : cerrarModal())}
        titulo={TITULO[vista]}
        descripcion={DESCRIPCION[vista]}
        className="max-w-md"
      >
        {vista === "resumen" && (
          <ResumenCaja caja={caja} cargando={cargando} onCambiar={(v) => setVista(v ? "abrir" : "cerrar")} />
        )}
        {vista === "abrir" && (
          <div className="flex flex-col gap-3">
            <Volver onClick={() => setVista("resumen")} />
            <FormAbrir onListo={() => setVista("resumen")} />
          </div>
        )}
        {vista === "cerrar" && caja && (
          <div className="flex flex-col gap-3">
            <Volver onClick={() => setVista("resumen")} />
            <FormCerrar caja={caja} onListo={cerrarModal} />
          </div>
        )}
      </Modal>
    </>
  );
}

function Volver({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="self-start" onClick={onClick}>
      <ArrowLeft /> Volver
    </Button>
  );
}

function ResumenCaja({
  caja,
  cargando,
  onCambiar,
}: {
  caja: CajaActual | null;
  cargando: boolean;
  onCambiar: (abrir: boolean) => void;
}) {
  const r = caja?.resumen;
  const movimientos = caja?.movimientos ?? [];
  return (
    <div className="flex flex-col gap-5">
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3",
          !cargando && !caja && "border-amber-500/50 bg-amber-500/10",
        )}
      >
        {caja ? (
          <LockOpen className="size-5 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <Lock className="text-muted-foreground size-5 shrink-0" aria-hidden />
        )}
        <span className="flex-1">
          <span className="block text-sm font-medium">{caja ? "Caja abierta" : "Caja cerrada"}</span>
          <span className="text-muted-foreground block text-xs">
            {caja
              ? `Desde las ${hora.format(new Date(caja.abiertaEn))}`
              : "Ábrela con el efectivo inicial para vender y registrar movimientos."}
          </span>
        </span>
        <Switch
          checked={!!caja}
          disabled={cargando}
          aria-label={caja ? "Cerrar caja" : "Abrir caja"}
          onCheckedChange={onCambiar}
        />
      </label>

      {caja && r && (
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-muted-foreground">Monto inicial</dt>
          <dd className="text-right tabular-nums">{bs.format(Number(r.montoInicial))}</dd>
          <dt className="text-muted-foreground">Ventas en efectivo</dt>
          <dd className="text-right tabular-nums">{bs.format(Number(r.ventasEfectivo))}</dd>
          <dt className="text-muted-foreground">Ingresos extra</dt>
          <dd className="text-right text-emerald-600 tabular-nums">+ {bs.format(Number(r.otrosIngresos))}</dd>
          <dt className="text-muted-foreground">Egresos</dt>
          <dd className="text-destructive text-right tabular-nums">− {bs.format(Number(r.egresos))}</dd>
          <dt className="border-t pt-1 font-medium">Efectivo esperado</dt>
          <dd className="border-t pt-1 text-right font-semibold tabular-nums">
            {bs.format(Number(r.efectivoEsperado))}
          </dd>
          {Number(r.ventasTransferencia) > 0 && (
            <>
              <dt className="text-muted-foreground text-xs">Transferencias/QR (no van al cajón)</dt>
              <dd className="text-muted-foreground text-right text-xs tabular-nums">
                {bs.format(Number(r.ventasTransferencia))}
              </dd>
            </>
          )}
        </dl>
      )}

      {caja && <FormMovimiento cajaId={caja.id} />}

      {caja && movimientos.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs font-medium">Movimientos de esta caja</p>
          <ul className="divide-y text-sm">
            {movimientos.slice(0, 5).map((m) => (
              <FilaMovimiento key={m.id} m={m} />
            ))}
          </ul>
          {movimientos.length > 5 && (
            <p className="text-muted-foreground text-xs">Y {movimientos.length - 5} más en Registros.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FilaMovimiento({ m }: { m: MovimientoCajaApi }) {
  const ingreso = m.tipo === "ingreso";
  return (
    <li className="flex items-center gap-2 py-1.5">
      {ingreso ? (
        <ArrowDownLeft className="size-3.5 shrink-0 text-emerald-600" aria-label="Ingreso" />
      ) : (
        <ArrowUpRight className="text-destructive size-3.5 shrink-0" aria-label="Egreso" />
      )}
      <span className="min-w-0 flex-1 truncate" title={m.motivo}>
        {m.motivo}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{hora.format(new Date(m.creadoEn))}</span>
      <span className={cn("w-20 text-right tabular-nums", ingreso ? "text-emerald-600" : "text-destructive")}>
        {ingreso ? "+" : "−"} {bs.format(Number(m.monto))}
      </span>
    </li>
  );
}

/** Ingreso o egreso de efectivo que no es una venta (cambio, pago de un servicio…). */
function FormMovimiento({ cajaId }: { cajaId: number }) {
  const { enviando, error, ejecutar } = useEnvio();
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const valido = Number(monto) > 0 && motivo.trim() !== "";

  return (
    <form
      className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(async () => {
          await enviar("POST", `/cajas/${cajaId}/movimientos`, { tipo, monto: Number(monto), motivo: motivo.trim() });
          toast.exito(`${tipo === "ingreso" ? "Ingreso" : "Egreso"} de ${bs.format(Number(monto))} registrado.`);
          setMonto("");
          setMotivo("");
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Registrar movimiento</p>
        <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label="Tipo de movimiento">
          {(["egreso", "ingreso"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setTipo(t)}
              className={cn(
                "rounded px-2.5 py-0.5 text-xs font-medium",
                tipo === t
                  ? t === "egreso"
                    ? "bg-destructive text-white"
                    : "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "egreso" ? "Egreso" : "Ingreso"}
            </button>
          ))}
        </div>
      </div>
      <Campo label="Monto (Bs)" htmlFor="mov-monto">
        <Input
          id="mov-monto"
          type="number"
          min={0.01}
          step="0.01"
          inputMode="decimal"
          required
          className="tabular-nums"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </Campo>
      <Campo label="Detalle" htmlFor="mov-motivo">
        <Textarea
          id="mov-motivo"
          required
          rows={2}
          placeholder={
            tipo === "egreso" ? "Ej.: pago de luz, compra de bolsas, adelanto a…" : "Ej.: cambio que se agregó al cajón…"
          }
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>
      <ErrorEnvio>{error}</ErrorEnvio>
      <Button type="submit" variant={tipo === "egreso" ? "destructive" : "default"} disabled={enviando || !valido}>
        {enviando ? "Registrando…" : tipo === "egreso" ? "Registrar egreso" : "Registrar ingreso"}
      </Button>
    </form>
  );
}

function FormAbrir({ onListo }: { onListo: () => void }) {
  const { enviando, error, ejecutar } = useEnvio();
  const [monto, setMonto] = useState("0");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(async () => {
          await enviar("POST", "/cajas/abrir", { montoInicial: Number(monto) || 0 });
          toast.exito(`Caja abierta con ${bs.format(Number(monto) || 0)}.`);
          onListo();
        });
      }}
    >
      <Campo label="Monto inicial (Bs)" htmlFor="caja-inicial">
        <Input
          id="caja-inicial"
          type="number"
          min={0}
          step="0.5"
          inputMode="decimal"
          autoFocus
          className="tabular-nums"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </Campo>
      <ErrorEnvio>{error}</ErrorEnvio>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando ? "Abriendo…" : "Abrir caja"}
      </Button>
    </form>
  );
}

function FormCerrar({ caja, onListo }: { caja: CajaActual; onListo: () => void }) {
  const { enviando, error, ejecutar } = useEnvio();
  const [contado, setContado] = useState("");
  const esperado = Number(caja.resumen?.efectivoEsperado ?? 0);
  const diferencia = contado === "" ? null : Math.round((Number(contado) - esperado) * 100) / 100;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(async () => {
          await enviar("POST", `/cajas/${caja.id}/cerrar`, { montoContado: Number(contado) });
          if (diferencia === 0 || diferencia === null) toast.exito("Caja cerrada. El arqueo cuadró.");
          else
            // Con diferencia dura más, para que se alcance a leer.
            toast.info(
              `Caja cerrada. Arqueo con diferencia de ${bs.format(diferencia)} (${diferencia > 0 ? "sobrante" : "faltante"}).`,
              9000,
            );
          onListo();
        });
      }}
    >
      <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Monto inicial</dt>
        <dd className="text-right tabular-nums">{bs.format(Number(caja.resumen?.montoInicial ?? 0))}</dd>
        <dt className="text-muted-foreground">Ventas en efectivo</dt>
        <dd className="text-right tabular-nums">{bs.format(Number(caja.resumen?.ventasEfectivo ?? 0))}</dd>
        <dt className="text-muted-foreground">Otros ingresos − egresos</dt>
        <dd className="text-right tabular-nums">
          {bs.format(Number(caja.resumen?.otrosIngresos ?? 0) - Number(caja.resumen?.egresos ?? 0))}
        </dd>
        <dt className="border-t pt-1.5 font-medium">Efectivo esperado</dt>
        <dd className="border-t pt-1.5 text-right font-semibold tabular-nums">{bs.format(esperado)}</dd>
      </dl>
      <Campo label="Efectivo contado (Bs)" htmlFor="caja-contado">
        <Input
          id="caja-contado"
          type="number"
          min={0}
          step="0.5"
          inputMode="decimal"
          required
          autoFocus
          className="tabular-nums"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
        />
      </Campo>
      {diferencia !== null && (
        <p
          className={`text-sm font-medium ${diferencia === 0 ? "text-emerald-600" : diferencia > 0 ? "text-amber-600" : "text-destructive"}`}
        >
          {diferencia === 0
            ? "Cuadra exacto."
            : `${diferencia > 0 ? "Sobran" : "Faltan"} ${bs.format(Math.abs(diferencia))}`}
        </p>
      )}
      <ErrorEnvio>{error}</ErrorEnvio>
      <Button type="submit" size="lg" disabled={enviando || contado === ""}>
        {enviando ? "Cerrando…" : "Cerrar caja"}
      </Button>
    </form>
  );
}
