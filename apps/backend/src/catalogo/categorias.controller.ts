import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AvisosService } from '../avisos/avisos.service.js';
import { idParam, texto } from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

const crearCategoria = z.object({
  nombre: texto,
  activa: z.boolean().optional(),
});
const editarCategoria = crearCategoria.partial();

@Controller('categorias')
export class CategoriasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly avisos: AvisosService,
  ) {}

  @Get()
  listar(@Query('todas') todas?: string) {
    return this.prisma.categoria.findMany({
      where: todas === 'true' ? {} : { activa: true },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productos: true } } },
    });
  }

  @Post()
  async crear(
    @Body({ schema: crearCategoria }) body: z.infer<typeof crearCategoria>,
  ) {
    const categoria = await this.prisma.categoria.create({ data: body });
    // Ocultar/mostrar una categoría cambia el catálogo público.
    this.realtime.emit(Eventos.CategoriaActualizada, {
      categoriaId: categoria.id,
    });
    await this.avisos.informar(`Se creó la categoría ${categoria.nombre}.`);
    return categoria;
  }

  @Patch(':id')
  async editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarCategoria }) body: z.infer<typeof editarCategoria>,
  ) {
    const categoria = await this.prisma.categoria.update({
      where: { id },
      data: body,
    });
    this.realtime.emit(Eventos.CategoriaActualizada, { categoriaId: id });
    return categoria;
  }
}
