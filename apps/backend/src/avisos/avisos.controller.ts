import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { idParam } from '../common/schemas.js';
import {
  AvisosService,
  TIPOS_AVISO,
  type TipoAviso,
} from './avisos.service.js';

@Controller('avisos')
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  /** Avisos vigentes y recientes, más el total sin leer (para la campana). */
  @Get()
  listar(
    @Query('tipo', { schema: z.enum(TIPOS_AVISO).optional() })
    tipo?: TipoAviso,
    @Query('limite', {
      schema: z.coerce.number().int().min(1).max(500).default(100),
    })
    limite?: number,
  ) {
    return this.avisos.listar(tipo, limite);
  }

  @Post('leer-todos')
  leerTodos() {
    return this.avisos.marcarTodosLeidos();
  }

  @Post(':id/leer')
  async leer(@Param('id', { schema: idParam }) id: number) {
    await this.avisos.marcarLeido(id);
    return { ok: true };
  }
}
