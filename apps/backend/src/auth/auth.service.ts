import {
  BadRequestException,
  Injectable,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service.js';

const scrypt = promisify(scryptCb) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;

/** Duración de una sesión: una jornada de trabajo. */
const DURACION_MS = 12 * 60 * 60 * 1000;

/** Compara sin filtrar por tiempo cuántos caracteres coinciden. */
function iguales(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** "scrypt$<sal>$<hash>" en base64url. */
async function cifrar(contrasena: string) {
  const sal = randomBytes(16);
  const hash = await scrypt(contrasena, sal, 32);
  return `scrypt$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

async function coincide(contrasena: string, guardado: string) {
  const [, salTxt, hashTxt] = guardado.split('$');
  if (!salTxt || !hashTxt) return false;
  const esperado = Buffer.from(hashTxt, 'base64url');
  const hash = await scrypt(contrasena, Buffer.from(salTxt, 'base64url'), esperado.length);
  return timingSafeEqual(hash, esperado);
}

/**
 * Acceso con una contraseña única. Si se cambió desde Ajustes, su hash está
 * en la tabla `acceso`; si no, vale APP_PASSWORD (por defecto "adm1234").
 * El token es "<vence>.<firma HMAC>": no hace falta guardar sesiones. La
 * clave de firma depende de la contraseña vigente, así que cambiarla cierra
 * todas las sesiones abiertas.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  /** Hash guardado en la BD, o null si se usa APP_PASSWORD. */
  private hash: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const fila = await this.prisma.acceso.findUnique({ where: { id: 1 } });
    this.hash = fila?.contrasenaHash ?? null;
  }

  private get contrasenaInicial() {
    return process.env.APP_PASSWORD || 'adm1234';
  }

  private get clave() {
    return process.env.AUTH_SECRET || `tienda:${this.hash ?? this.contrasenaInicial}`;
  }

  private firmar(vence: number) {
    return createHmac('sha256', this.clave).update(String(vence)).digest('base64url');
  }

  private nuevoToken() {
    const vence = Date.now() + DURACION_MS;
    return { token: `${vence}.${this.firmar(vence)}`, vence: new Date(vence).toISOString() };
  }

  private async verificar(contrasena: string) {
    const ok = this.hash ? await coincide(contrasena, this.hash) : iguales(contrasena, this.contrasenaInicial);
    if (!ok) {
      // Frena los intentos por fuerza bruta.
      await new Promise((r) => setTimeout(r, 600));
    }
    return ok;
  }

  async iniciarSesion(contrasena: string) {
    if (!(await this.verificar(contrasena))) throw new UnauthorizedException('Contraseña incorrecta');
    return this.nuevoToken();
  }

  /** Cambia la contraseña y devuelve un token nuevo (las demás sesiones se cierran). */
  async cambiarContrasena(actual: string, nueva: string) {
    // 400 y no 401: el frontend no debe cerrar la sesión por un error de tipeo.
    if (!(await this.verificar(actual))) throw new BadRequestException('La contraseña actual no es correcta');
    if (actual === nueva) throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    const hash = await cifrar(nueva);
    await this.prisma.acceso.upsert({
      where: { id: 1 },
      create: { id: 1, contrasenaHash: hash },
      update: { contrasenaHash: hash, actualizadoEn: new Date() },
    });
    this.hash = hash;
    return this.nuevoToken();
  }

  /** true si el token es auténtico y no venció. */
  valido(token: string | undefined): boolean {
    const [venceTxt, firma] = (token ?? '').split('.');
    const vence = Number(venceTxt);
    if (!firma || !Number.isFinite(vence) || vence < Date.now()) return false;
    return iguales(firma, this.firmar(vence));
  }
}
