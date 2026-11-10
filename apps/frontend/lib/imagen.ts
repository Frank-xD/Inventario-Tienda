/**
 * Compresión de fotos de productos antes de subirlas a la BD.
 *
 * Algoritmo: se redimensiona para que el lado mayor mida como máximo
 * LADO_MAX px y se codifica en WebP (JPEG si el navegador no sabe hacer
 * WebP), bajando la calidad hasta que pese menos de OBJETIVO_BYTES. Si con
 * la calidad mínima todavía pesa más, se achica la imagen un 25 % y se
 * repite. El backend rechaza más de 512 KB; el objetivo deja margen.
 */
const LADO_MAX = 1024;
const OBJETIVO_BYTES = 200 * 1024;
const CALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45];
const LADO_MIN = 256;

export interface ImagenComprimida {
  blob: Blob;
  ancho: number;
  alto: number;
  /** Bytes antes de comprimir. */
  original: number;
}

const aBlob = (canvas: HTMLCanvasElement, tipo: string, calidad: number) =>
  new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, calidad));

export async function comprimirImagen(archivo: Blob): Promise<ImagenComprimida> {
  // imageOrientation: respeta la rotación EXIF de las fotos del celular.
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("No se pudo leer la imagen. Prueba con una foto JPEG, PNG o WebP.");
  });

  let escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  let tipo = "image/webp";
  try {
    for (;;) {
      const ancho = Math.max(1, Math.round(bitmap.width * escala));
      const alto = Math.max(1, Math.round(bitmap.height * escala));
      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("El navegador no permite procesar imágenes.");
      // Fondo blanco: los PNG con transparencia no quedan negros en JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.drawImage(bitmap, 0, 0, ancho, alto);

      let ultimo: Blob | null = null;
      for (const calidad of CALIDADES) {
        const blob = await aBlob(canvas, tipo, calidad);
        if (!blob) break;
        // Safari antiguo devuelve PNG cuando no sabe WebP: se pasa a JPEG.
        if (blob.type !== tipo) {
          tipo = "image/jpeg";
          ultimo = await aBlob(canvas, tipo, calidad);
          if (!ultimo) break;
        } else ultimo = blob;
        if (ultimo.size <= OBJETIVO_BYTES) return { blob: ultimo, ancho, alto, original: archivo.size };
      }
      if (Math.max(ancho, alto) <= LADO_MIN) {
        if (ultimo) return { blob: ultimo, ancho, alto, original: archivo.size };
        throw new Error("No se pudo comprimir la imagen.");
      }
      escala *= 0.75;
    }
  } finally {
    bitmap.close();
  }
}

export const formatoBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
