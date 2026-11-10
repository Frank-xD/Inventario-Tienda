/** Formatos que acepta producto_fotos.tipo. */
export type TipoImagen = 'image/webp' | 'image/jpeg' | 'image/png';

/**
 * Detecta el formato por la firma de los primeros bytes. Devuelve null si
 * no es WebP, JPEG ni PNG (el Content-Type del cliente no es confiable).
 */
export function tipoDeImagen(b: Buffer): TipoImagen | null {
  if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return 'image/jpeg';
  if (
    b.length >= 8 &&
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  return null;
}

/**
 * Ruta (relativa a la API) de la foto. `v` cambia cuando se reemplaza la
 * foto, así el navegador puede guardarla en caché para siempre.
 */
export const urlFoto = (productoId: number, actualizadaEn: Date) =>
  `/api/productos/${productoId}/foto?v=${actualizadaEn.getTime()}`;
