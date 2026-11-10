"use client";

import { useState } from "react";
import { CheckCircle2, Moon, Sun } from "lucide-react";
import { enviar, type Configuracion as Config } from "@/lib/api";
import { useTema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { useConfiguracion } from "@/hooks/use-datos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Campo, ErrorEnvio, EstadoCarga, Titulo, useEnvio } from "./comun";

type IdNotif = "notifStock" | "notifVencimientos" | "notifProveedores" | "resumenSemanal";

const NOTIFICACIONES: { id: IdNotif; label: string; desc: string }[] = [
  { id: "notifStock", label: "Alertas de stock bajo", desc: "Cuando un producto llega a su stock mínimo o se agota." },
  { id: "notifVencimientos", label: "Avisos de vencimiento", desc: "Lotes vencidos o que vencen en los próximos 7 días." },
  { id: "notifProveedores", label: "Recordatorios de pedido", desc: "Qué pedir a cada proveedor según el stock bajo." },
  {
    id: "resumenSemanal",
    label: "Resumen semanal por correo",
    desc: "Se guarda la preferencia; el envío de correos todavía no está disponible.",
  },
];

export function Configuracion() {
  const cfg = useConfiguracion();
  return (
    <>
      <Titulo descripcion="Datos de la tienda, notificaciones y apariencia">Configuración</Titulo>
      <EstadoCarga cargando={cfg.cargando} error={cfg.error} />
      {/* key: si otro dispositivo guarda cambios, el formulario se reinicia con ellos. */}
      {cfg.data && <FormConfiguracion key={JSON.stringify(cfg.data)} inicial={cfg.data} />}
      <Apariencia />
    </>
  );
}

function FormConfiguracion({ inicial }: { inicial: Config }) {
  const { enviando, error, ejecutar } = useEnvio();
  const [nombre, setNombre] = useState(inicial.nombreTienda);
  const [correo, setCorreo] = useState(inicial.correo ?? "");
  const [telefono, setTelefono] = useState(inicial.telefono ?? "");
  const [notif, setNotif] = useState<Record<IdNotif, boolean>>({
    notifStock: inicial.notifStock,
    notifVencimientos: inicial.notifVencimientos,
    notifProveedores: inicial.notifProveedores,
    resumenSemanal: inicial.resumenSemanal,
  });
  const [guardado, setGuardado] = useState(false);

  return (
    <form
      className="flex flex-col gap-6"
      onChange={() => setGuardado(false)}
      onSubmit={(e) => {
        e.preventDefault();
        void ejecutar(async () => {
          await enviar("PATCH", "/configuracion", { nombreTienda: nombre, correo, telefono, ...notif });
          setGuardado(true);
        });
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la tienda</CardTitle>
            <CardDescription>Se muestran en el catálogo público.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo label="Nombre de la tienda" htmlFor="cf-nombre">
              <Input id="cf-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Campo>
            <Campo label="Correo de contacto" htmlFor="cf-correo">
              <Input
                id="cf-correo"
                type="email"
                placeholder="tienda@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </Campo>
            <Campo label="Número de contacto" htmlFor="cf-tel">
              <Input
                id="cf-tel"
                type="tel"
                placeholder="591 7…"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificaciones</CardTitle>
            <CardDescription>Qué avisos aparecen en la campana.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {NOTIFICACIONES.map((n) => (
              <label key={n.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span>
                  <span className="block text-sm font-medium">{n.label}</span>
                  <span className="text-muted-foreground block text-xs">{n.desc}</span>
                </span>
                <Switch
                  checked={notif[n.id]}
                  onCheckedChange={(v: boolean) => {
                    setNotif((prev) => ({ ...prev, [n.id]: v }));
                    setGuardado(false);
                  }}
                />
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <ErrorEnvio>{error}</ErrorEnvio>
        {guardado && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" /> Cambios guardados
          </span>
        )}
        <Button type="submit" size="lg" disabled={enviando || !nombre.trim()}>
          {enviando ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

/** Tema claro/oscuro: es de este dispositivo, no se guarda en el servidor. */
function Apariencia() {
  const [tema, setTema] = useTema();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>Se aplica al instante y solo en este dispositivo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-md grid-cols-2 gap-3" role="radiogroup" aria-label="Tema">
          {(
            [
              { id: "claro", label: "Claro", icon: Sun },
              { id: "oscuro", label: "Oscuro", icon: Moon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={tema === id}
              onClick={() => setTema(id)}
              className={cn(
                "focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
                tema === id ? "border-primary ring-primary ring-1" : "hover:bg-accent",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
