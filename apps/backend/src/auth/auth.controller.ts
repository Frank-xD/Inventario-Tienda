import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { Publico } from './auth.guard.js';
import { AuthService } from './auth.service.js';

const login = z.object({ contrasena: z.string().min(1).max(200) });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  iniciarSesion(@Body({ schema: login }) body: z.infer<typeof login>) {
    return this.auth.iniciarSesion(body.contrasena);
  }

  /** Sirve para comprobar si el token guardado sigue vigente (401 si no). */
  @Get('sesion')
  sesion() {
    return { ok: true };
  }
}
