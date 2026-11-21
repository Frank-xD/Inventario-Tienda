import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

/** Prisma falso: solo la tabla `acceso`, en memoria. */
function prismaFalso() {
  let fila: { contrasenaHash: string } | null = null;
  return {
    acceso: {
      findUnique: vi.fn(async () => fila),
      upsert: vi.fn(async ({ create }: { create: { contrasenaHash: string } }) => {
        fila = { contrasenaHash: create.contrasenaHash };
        return fila;
      }),
    },
  } as unknown as PrismaService;
}

async function servicio() {
  const auth = new AuthService(prismaFalso());
  await auth.onModuleInit();
  return auth;
}

describe.each([
  ['sin AUTH_SECRET', undefined],
  ['con AUTH_SECRET', 'secreto-de-prueba'],
])('AuthService %s', (_nombre, secreto) => {
  beforeEach(() => {
    vi.stubEnv('APP_PASSWORD', 'inicial123');
    vi.stubEnv('AUTH_SECRET', secreto ?? '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('acepta el token emitido al iniciar sesión', async () => {
    const auth = await servicio();
    const { token } = await auth.iniciarSesion('inicial123');
    expect(auth.valido(token)).toBe(true);
  });

  it('cambiar la contraseña invalida las sesiones anteriores', async () => {
    const auth = await servicio();
    const { token: viejo } = await auth.iniciarSesion('inicial123');
    const { token: nuevo } = await auth.cambiarContrasena('inicial123', 'nueva4567');
    expect(auth.valido(viejo)).toBe(false);
    expect(auth.valido(nuevo)).toBe(true);
  });
});

describe('AuthService: AUTH_SECRET', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('un token firmado con otro secreto no es válido', async () => {
    vi.stubEnv('APP_PASSWORD', 'inicial123');
    vi.stubEnv('AUTH_SECRET', 'secreto-a');
    const { token } = await (await servicio()).iniciarSesion('inicial123');

    vi.stubEnv('AUTH_SECRET', 'secreto-b');
    expect((await servicio()).valido(token)).toBe(false);
  });
});
