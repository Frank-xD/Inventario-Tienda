import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  cantidad,
  dinero,
  fecha,
  id,
  idParam,
  textoOpcional,
} from '../common/schemas.js';
import { finDia, inicioDia } from '../common/tienda.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

const crearCompra = z.object({
  proveedorId: id,
  notas: textoOpcional,
  /**
   * Una línea por producto y fecha de vencimiento. Si llegan dos fechas
   * distintas del mismo producto, van en dos líneas (se crean dos lotes).
   */
  detalles: z
    .array(
      z.object({
        productoId: id,
        cantidad,
        costoUnit: dinero,
        fechaVencimiento: fecha.optional(),
      }),
    )
    .min(1),
});

const filtros = z.object({
  proveedorId: id.optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

const include = {
  proveedor: { select: { id: true, nombre: true } },
  detalles: { include: { producto: { select: { id: true, nombre: true } } } },
} as const;

@Controller('compras')
export class ComprasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  listar(@Query({ schema: filtros }) f: z.infer<typeof filtros>) {
    return this.prisma.compra.findMany({
      where: {
        proveedorId: f.proveedorId,
        fecha: {
          ...(f.desde && { gte: inicioDia(f.desde) }),
          ...(f.hasta && { lte: finDia(f.hasta) }),
        },
      },
      orderBy: { fecha: 'desc' },
      include: { proveedor: { select: { id: true, nombre: true } } },
    });
  }

  @Get(':id')
  detalle(@Param('id', { schema: idParam }) compraId: number) {
    return this.prisma.compra.findUniqueOrThrow({
      where: { id: compraId },
      include,
    });
  }

  /**
   * Registra la compra. Los triggers de la base de datos suman el stock,
   * actualizan el costo de cada producto, calculan el total y crean lotes.
   */
  @Post()
  async crear(
    @Body({ schema: crearCompra }) body: z.infer<typeof crearCompra>,
  ) {
    const compraId = await this.prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: { proveedorId: body.proveedorId, notas: body.notas ?? null },
      });
      await tx.detalleCompra.createMany({
        data: body.detalles.map((d) => ({
          compraId: compra.id,
          productoId: d.productoId,
          cantidad: d.cantidad,
          costoUnit: d.costoUnit,
          fechaVencimiento: d.fechaVencimiento
            ? new Date(d.fechaVencimiento)
            : null,
        })),
      });
      return compra.id;
    });

    const productoIds = [...new Set(body.detalles.map((d) => d.productoId))];
    this.realtime.emit(Eventos.CompraRegistrada, { compraId });
    this.realtime.emit(Eventos.StockActualizado, { productoIds });
    if (body.detalles.some((d) => d.fechaVencimiento)) {
      this.realtime.emit(Eventos.LotesActualizados);
    }
    return this.detalle(compraId);
  }
}
