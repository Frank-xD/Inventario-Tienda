import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { Publico } from './auth.guard.js';
import { AuthService } from './auth.service.js';

const login = z.object({ contrasena: z.string().min(1).max(200) });
const cambio = z.object({
  actual: z.string().min(1).max(200),
  nueva: z
    .string()
    .min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
    .max(100, 'La nueva contraseña es demasiado larga'),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  iniciarSesion(@Body({ schema: login }) body: z.infer<typeof login>) {
    return this.auth.iniciarSesion(body.contrasena);
  }

  /** Cambia la contraseña (pide la actual). Responde con un token nuevo. */
  @Post('contrasena')
  @HttpCode(200)
  cambiarContrasena(@Body({ schema: cambio }) body: z.infer<typeof cambio>) {
    return this.auth.cambiarContrasena(body.actual, body.nueva);
  }

  /** Sirve para comprobar si el token guardado sigue vigente (401 si no). */
  @Get('sesion')
  sesion() {
    return { ok: true };
  }
}
