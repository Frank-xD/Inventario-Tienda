import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { fecha, idParam, texto } from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

const base = z.object({
  texto,
  desde: fecha,
  hasta: fecha,
  visible: z.boolean().optional(),
});
const crearAnuncio = base.refine((a) => a.hasta >= a.desde, {
  message: '"hasta" debe ser igual o posterior a "desde"',
  path: ['hasta'],
});
const editarAnuncio = base.partial();

const aFechas = <T extends { desde?: string; hasta?: string }>(a: T) => ({
  ...a,
  ...(a.desde && { desde: new Date(a.desde) }),
  ...(a.hasta && { hasta: new Date(a.hasta) }),
});

@Controller('anuncios')
export class AnunciosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  listar() {
    return this.prisma.anuncio.findMany({ orderBy: { desde: 'desc' } });
  }

  @Post()
  async crear(
    @Body({ schema: crearAnuncio }) body: z.infer<typeof crearAnuncio>,
  ) {
    const anuncio = await this.prisma.anuncio.create({
      data: aFechas(body) as { texto: string; desde: Date; hasta: Date },
    });
    this.realtime.emit(Eventos.AnunciosActualizados);
    return anuncio;
  }

  @Patch(':id')
  async editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarAnuncio }) body: z.infer<typeof editarAnuncio>,
  ) {
    // El CHECK (hasta >= desde) de la tabla valida la combinación final.
    const anuncio = await this.prisma.anuncio.update({
      where: { id },
      data: aFechas(body),
    });
    this.realtime.emit(Eventos.AnunciosActualizados);
    return anuncio;
  }

  @Delete(':id')
  async borrar(@Param('id', { schema: idParam }) id: number) {
    await this.prisma.anuncio.delete({ where: { id } });
    this.realtime.emit(Eventos.AnunciosActualizados);
    return { id };
  }
}
