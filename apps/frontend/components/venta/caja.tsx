"use client";

import { useState } from "react";
import { Lock, LockOpen, Wallet } from "lucide-react";
import { bs, enviar, type CajaActual } from "@/lib/api";
import { Campo, ErrorEnvio, useEnvio } from "@/components/admin/comun";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const hora = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" });

/**
 * Estado de la caja en la pantalla de Venta. Sin caja abierta el backend no
 * registra ventas, así que se ofrece abrirla; al cerrar se hace el arqueo.
 */
export function BarraCaja({ caja, cargando }: { caja: CajaActual | null; cargando: boolean }) {
  const [dialogo, setDialogo] = useState<"abrir" | "cerrar" | null>(null);
  const [cierre, setCierre] = useState<string | null>(null);

  if (cargando) return null;

  const r = caja?.resumen;
  return (
    <>
      {caja ? (
        <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <LockOpen className="size-4 text-emerald-600" /> Caja abierta desde las {hora.format(new Date(caja.abiertaEn))}
          </span>
          {r && (
            <span className="text-muted-foreground text-sm">
              Efectivo esperado <strong className="text-foreground tabular-nums">{bs.format(Number(r.efectivoEsperado))}</strong>
              {Number(r.ventasTransferencia) > 0 && <> · Transferencias {bs.format(Number(r.ventasTransferencia))}</>}
            </span>
          )}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setDialogo("cerrar")}>
            <Lock /> Cerrar caja
          </Button>
        </Card>
      ) : (
        <Card className="flex-row flex-wrap items-center gap-3 border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <Wallet className="size-4 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">La caja está cerrada.</span>{" "}
            {cierre ?? "Ábrela con el efectivo inicial para empezar a vender."}
          </p>
          <Button size="sm" className="ml-auto" onClick={() => setDialogo("abrir")}>
            <LockOpen /> Abrir caja
          </Button>
        </Card>
      )}

      <Modal
        open={dialogo === "abrir"}
        onOpenChange={(o) => !o && setDialogo(null)}
        titulo="Abrir caja"
        descripcion="¿Con cuánto efectivo empiezas el día (cambio)?"
        className="max-w-sm"
      >
        {dialogo === "abrir" && (
          <FormAbrir
            onListo={() => {
              setCierre(null);
              setDialogo(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={dialogo === "cerrar" && !!caja}
        onOpenChange={(o) => !o && setDialogo(null)}
        titulo="Cerrar caja"
        descripcion="Cuenta el efectivo del cajón y anótalo."
        className="max-w-sm"
      >
        {dialogo === "cerrar" && caja && (
          <FormCerrar
            caja={caja}
            onListo={(mensaje) => {
              setCierre(mensaje);
              setDialogo(null);
            }}
          />
        )}
      </Modal>
    </>
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

function FormCerrar({ caja, onListo }: { caja: CajaActual; onListo: (mensaje: string) => void }) {
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
          onListo(
            diferencia === 0 || diferencia === null
              ? "El arqueo cuadró."
              : `Arqueo con diferencia de ${bs.format(diferencia)} (${diferencia > 0 ? "sobrante" : "faltante"}).`,
          );
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
