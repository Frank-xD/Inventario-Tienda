"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";

/**
 * Ventana que muestra la cámara y captura un cuadro como imagen (JPEG de
 * buena calidad; después se comprime con comprimirImagen).
 */
export function FotoCamara({
  open,
  onOpenChange,
  onCaptura,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCaptura: (foto: Blob) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} titulo="Tomar foto" className="max-w-lg">
      {open && <Visor onCaptura={onCaptura} />}
    </Modal>
  );
}

function Visor({ onCaptura }: { onCaptura: (foto: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  // Trasera por defecto (celular); en una laptop solo hay la frontal y se usa esa.
  const [frontal, setFrontal] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelado = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: frontal ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then(async (s) => {
        if (cancelado) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play().catch(() => {});
        setListo(true);
      })
      .catch(() => setError("No se pudo acceder a la cámara. Revisa los permisos del navegador."));
    return () => {
      cancelado = true;
      setListo(false);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [frontal]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((b) => b && onCaptura(b), "image/jpeg", 0.92);
  };

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} className="size-full object-contain" muted playsInline />
        {!listo && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            <RefreshCw className="mr-2 size-4 animate-spin" /> Encendiendo la cámara…
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setFrontal((f) => !f)} title="Cambiar de cámara">
          <SwitchCamera /> Cambiar
        </Button>
        <Button type="button" className="flex-1" disabled={!listo} onClick={capturar}>
          <Camera /> Tomar foto
        </Button>
      </div>
    </div>
  );
}
