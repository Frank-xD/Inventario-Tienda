import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Duración de una sesión: una jornada de trabajo. */
const DURACION_MS = 12 * 60 * 60 * 1000;

/** Compara sin filtrar por tiempo cuántos caracteres coinciden. */
function iguales(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Acceso con una contraseña única (APP_PASSWORD, por defecto "adm1234").
 * El token es "<vence>.<firma HMAC>": no hace falta guardar sesiones.
 * La clave de firma sale de AUTH_SECRET o, si no existe, de la contraseña,
 * así que cambiar la contraseña cierra todas las sesiones abiertas.
 */
@Injectable()
export class AuthService {
  private get contrasena() {
    return process.env.APP_PASSWORD || 'adm1234';
  }

  private get clave() {
    return process.env.AUTH_SECRET || `tienda:${this.contrasena}`;
  }

  private firmar(vence: number) {
    return createHmac('sha256', this.clave).update(String(vence)).digest('base64url');
  }

  async iniciarSesion(contrasena: string) {
    if (!iguales(contrasena, this.contrasena)) {
      // Frena los intentos por fuerza bruta.
      await new Promise((r) => setTimeout(r, 600));
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    const vence = Date.now() + DURACION_MS;
    return { token: `${vence}.${this.firmar(vence)}`, vence: new Date(vence).toISOString() };
  }

  /** true si el token es auténtico y no venció. */
  valido(token: string | undefined): boolean {
    const [venceTxt, firma] = (token ?? '').split('.');
    const vence = Number(venceTxt);
    if (!firma || !Number.isFinite(vence) || vence < Date.now()) return false;
    return iguales(firma, this.firmar(vence));
  }
}
