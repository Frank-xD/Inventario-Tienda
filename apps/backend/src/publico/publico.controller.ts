import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';

const filtros = z.object({
  q: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
});

/**
 * Portal público: solo lee vistas pensadas para clientes
 * (sin cifras exactas de stock ni costos).
 */
@Controller('publico')
export class PublicoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('catalogo')
  catalogo(@Query({ schema: filtros }) f: z.infer<typeof filtros>) {
    return this.prisma.vCatalogoPublico.findMany({
      where: {
        ...(f.q && { nombre: { contains: f.q, mode: 'insensitive' } }),
        ...(f.categoria && { categoria: f.categoria }),
      },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  }

  @Get('categorias')
  async categorias() {
    const filas = await this.prisma.vCatalogoPublico.findMany({
      distinct: ['categoria'],
      select: { categoria: true },
      orderBy: { categoria: 'asc' },
    });
    return filas.map((f) => f.categoria);
  }

  @Get('anuncios')
  anuncios() {
    return this.prisma.vAnuncioVigente.findMany({ orderBy: { id: 'desc' } });
  }
}
