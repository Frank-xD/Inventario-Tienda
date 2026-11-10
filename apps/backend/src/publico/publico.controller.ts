import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { urlFoto } from '../catalogo/fotos.js';
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
  async catalogo(@Query({ schema: filtros }) f: z.infer<typeof filtros>) {
    const filas = await this.prisma.vCatalogoPublico.findMany({
      where: {
        ...(f.q && { nombre: { contains: f.q, mode: 'insensitive' } }),
        ...(f.categoria && { categoria: f.categoria }),
      },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
    return filas.map(({ fotoActualizadaEn, ...p }) => ({
      ...p,
      fotoUrl: fotoActualizadaEn ? urlFoto(p.id, fotoActualizadaEn) : null,
    }));
  }

  /** Nombre y contacto de la tienda (configuración), sin las preferencias internas. */
  @Get('tienda')
  tienda() {
    return this.prisma.configuracion.findUniqueOrThrow({
      where: { id: 1 },
      select: { nombreTienda: true, correo: true, telefono: true },
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
