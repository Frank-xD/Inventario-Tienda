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
import { idParam, texto, textoOpcional } from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';

const crearProveedor = z.object({
  nombre: texto,
  telefono: textoOpcional,
  notas: textoOpcional,
  activo: z.boolean().optional(),
});
const editarProveedor = crearProveedor.partial();

@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar(@Query('todos') todos?: string) {
    return this.prisma.proveedor.findMany({
      where: todos === 'true' ? {} : { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  @Get(':id')
  detalle(@Param('id', { schema: idParam }) id: number) {
    return this.prisma.proveedor.findUniqueOrThrow({
      where: { id },
      include: {
        productos: { where: { activo: true }, orderBy: { nombre: 'asc' } },
        compras: { orderBy: { fecha: 'desc' }, take: 10 },
      },
    });
  }

  @Post()
  crear(
    @Body({ schema: crearProveedor }) body: z.infer<typeof crearProveedor>,
  ) {
    return this.prisma.proveedor.create({ data: body });
  }

  @Patch(':id')
  editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarProveedor }) body: z.infer<typeof editarProveedor>,
  ) {
    return this.prisma.proveedor.update({ where: { id }, data: body });
  }
}
