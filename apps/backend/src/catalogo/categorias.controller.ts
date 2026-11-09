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
import { idParam, texto } from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';

const crearCategoria = z.object({
  nombre: texto,
  activa: z.boolean().optional(),
});
const editarCategoria = crearCategoria.partial();

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar(@Query('todas') todas?: string) {
    return this.prisma.categoria.findMany({
      where: todas === 'true' ? {} : { activa: true },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productos: true } } },
    });
  }

  @Post()
  crear(
    @Body({ schema: crearCategoria }) body: z.infer<typeof crearCategoria>,
  ) {
    return this.prisma.categoria.create({ data: body });
  }

  @Patch(':id')
  editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarCategoria }) body: z.infer<typeof editarCategoria>,
  ) {
    return this.prisma.categoria.update({ where: { id }, data: body });
  }
}
