"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Camera, CameraOff, ScanBarcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** API experimental de Chrome/Edge/Android; no viene en los tipos de TS. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

/** true si el dispositivo tiene al menos una cámara (null mientras se averigua). */
export function useHayCamara() {
  const [hay, setHay] = useState<boolean | null>(null);
  useEffect(() => {
    // mediaDevices no existe fuera de un contexto seguro (http que no sea localhost).
    const md = navigator.mediaDevices as MediaDevices | undefined;
    const dispositivos = md ? md.enumerateDevices() : Promise.resolve([]);
    dispositivos
      .then((ds) => setHay(ds.some((d) => d.kind === "videoinput")))
      .catch(() => setHay(false));
  }, []);
  return hay;
}

/**
 * Campo "Código manual" + botón de cámara para escanear el código de barras.
 * `onCodigo` devuelve un mensaje de error, o null si el código se aceptó.
 */
export function CodigoInput({ onCodigo }: { onCodigo: (codigo: string) => string | null }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enviar = (valor: string) => {
    if (!valor.trim()) return;
    const err = onCodigo(valor.trim());
    setError(err);
    if (!err) setCodigo("");
    else setCodigo(valor.trim());
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9 font-mono"
            placeholder="Código manual (Enter para agregar)"
            inputMode="numeric"
            value={codigo}
            aria-label="Código de barras"
            aria-invalid={!!error}
            onChange={(e) => {
              setCodigo(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                enviar(codigo);
              }
            }}
          />
        </div>
        <BotonCamara onDetectado={enviar} />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

/** Botón con el ícono de cámara que abre el escáner (desactivado si no hay cámara). */
export function BotonCamara({ onDetectado }: { onDetectado: (codigo: string) => void }) {
  const [escaneando, setEscaneando] = useState(false);
  const hayCamara = useHayCamara();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={hayCamara === false}
        title={hayCamara === false ? "No se detectó una cámara" : "Escanear con la cámara"}
        aria-label="Escanear con la cámara"
        onClick={() => setEscaneando(true)}
      >
        {hayCamara === false ? <CameraOff /> : <Camera />}
      </Button>
      <EscanerDialog
        open={escaneando}
        onOpenChange={setEscaneando}
        onDetectado={(valor) => {
          setEscaneando(false);
          onDetectado(valor);
        }}
      />
    </>
  );
}

function EscanerDialog({
  open,
  onOpenChange,
  onDetectado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDetectado: (codigo: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-semibold">Escanear código de barras</Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                Apunta la cámara al código del producto.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Cerrar">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          {open && <VistaCamara onDetectado={onDetectado} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function VistaCamara({ onDetectado }: { onDetectado: (codigo: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinDetector] = useState(() => !getBarcodeDetector());
  // El callback cambia en cada render del padre; no debe reiniciar la cámara.
  const onDetectadoRef = useRef(onDetectado);
  useEffect(() => {
    onDetectadoRef.current = onDetectado;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelado = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (cancelado) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play().catch(() => {});

        const Detector = getBarcodeDetector();
        if (!Detector) return;
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
        });
        timer = setInterval(async () => {
          if (video.readyState < 2) return;
          try {
            const [hit] = await detector.detect(video);
            if (hit?.rawValue && !cancelado) {
              cancelado = true;
              onDetectadoRef.current(hit.rawValue);
            }
          } catch {
            /* frame sin código */
          }
        }, 300);
      })
      .catch(() => setError("No se pudo acceder a la cámara. Revisa los permisos del navegador."));

    return () => {
      cancelado = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
      </div>
      {sinDetector && (
        <p className="text-muted-foreground text-xs">
          Este navegador no puede leer códigos automáticamente. Usa Chrome o Edge, o escribe el
          código manualmente.
        </p>
      )}
    </div>
  );
}
