import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';

const PUBLICO = 'rutaPublica';

/** Marca una ruta o controlador que no pide contraseña. */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Exige "Authorization: Bearer <token>" en toda la API salvo las rutas @Publico(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [ctx.getHandler(), ctx.getClass()]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo === 'Bearer' && this.auth.valido(token)) return true;
    throw new UnauthorizedException('Inicia sesión para continuar');
  }
}
