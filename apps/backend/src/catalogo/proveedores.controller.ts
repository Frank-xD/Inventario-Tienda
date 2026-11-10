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
import { idParam, texto, textoOpcional } from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

const crearProveedor = z.object({
  nombre: texto,
  telefono: textoOpcional,
  notas: textoOpcional,
  activo: z.boolean().optional(),
});
const editarProveedor = crearProveedor.partial();

@Controller('proveedores')
export class ProveedoresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly avisos: AvisosService,
  ) {}

  /** Activos, o todos con ?todos=true. Incluye cuántos productos tiene cada uno. */
  @Get()
  listar(@Query('todos') todos?: string) {
    return this.prisma.proveedor.findMany({
      where: todos === 'true' ? {} : { activo: true },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productos: true } } },
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
  async crear(
    @Body({ schema: crearProveedor }) body: z.infer<typeof crearProveedor>,
  ) {
    const proveedor = await this.prisma.proveedor.create({ data: body });
    this.realtime.emit(Eventos.ProveedorActualizado, {
      proveedorId: proveedor.id,
    });
    await this.avisos.informar(`Se agregó el proveedor ${proveedor.nombre}.`);
    return proveedor;
  }

  @Patch(':id')
  async editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarProveedor }) body: z.infer<typeof editarProveedor>,
  ) {
    const proveedor = await this.prisma.proveedor.update({
      where: { id },
      data: body,
    });
    this.realtime.emit(Eventos.ProveedorActualizado, { proveedorId: id });
    return proveedor;
  }
}
