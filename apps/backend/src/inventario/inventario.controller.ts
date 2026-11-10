import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  cantidad,
  fecha,
  id,
  idParam,
  texto,
  textoOpcional,
} from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

const ajuste = z.object({
  productoId: id,
  /** Con signo: positivo suma, negativo resta. */
  cantidad: z.coerce
    .number()
    .multipleOf(0.001)
    .refine((n) => n !== 0, 'No puede ser 0'),
  motivo: texto,
});

const merma = z.object({
  productoId: id,
  /** Unidades perdidas (vencidas, rotas...). Se registra en negativo. */
  cantidad,
  motivo: textoOpcional,
});

const filtrosMovimientos = z.object({
  productoId: id.optional(),
  tipo: z
    .enum(['compra', 'venta', 'ajuste', 'merma', 'anulacion_venta'])
    .optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100),
});

const crearLote = z.object({
  productoId: id,
  fechaVencimiento: fecha,
  cantidadInicial: cantidad,
});

@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Stock de todos los productos (vista v_stock). */
  @Get('stock')
  stock() {
    return this.prisma.vStock.findMany({ orderBy: { nombre: 'asc' } });
  }

  /** Stock bajo y agotados (vista v_alertas_stock). */
  @Get('alertas')
  alertas() {
    return this.prisma.vAlertaStock.findMany({
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
    });
  }

  @Get('movimientos')
  movimientos(
    @Query({ schema: filtrosMovimientos })
    f: z.infer<typeof filtrosMovimientos>,
  ) {
    return this.prisma.movimientoInventario.findMany({
      where: { productoId: f.productoId, tipo: f.tipo },
      orderBy: { creadoEn: 'desc' },
      take: f.limite,
      include: { producto: { select: { id: true, nombre: true } } },
    });
  }

  @Post('ajustes')
  async ajustar(@Body({ schema: ajuste }) body: z.infer<typeof ajuste>) {
    const mov = await this.prisma.movimientoInventario.create({
      data: { ...body, tipo: 'ajuste' },
    });
    this.realtime.emit(Eventos.StockActualizado, {
      productoIds: [body.productoId],
    });
    return mov;
  }

  @Post('mermas')
  async mermar(@Body({ schema: merma }) body: z.infer<typeof merma>) {
    const mov = await this.prisma.movimientoInventario.create({
      data: {
        productoId: body.productoId,
        tipo: 'merma',
        cantidad: -body.cantidad,
        motivo: body.motivo ?? null,
      },
    });
    this.realtime.emit(Eventos.StockActualizado, {
      productoIds: [body.productoId],
    });
    return mov;
  }

  // ---------------- Lotes (fechas de vencimiento) ----------------

  /** Lotes vencidos o que vencen en los próximos 7 días (vista v_por_vencer). */
  @Get('lotes/por-vencer')
  porVencer() {
    return this.prisma.vPorVencer.findMany({
      orderBy: { fechaVencimiento: 'asc' },
    });
  }

  @Get('lotes')
  lotes(@Query('productoId', { schema: id.optional() }) productoId?: number) {
    return this.prisma.lote.findMany({
      where: { productoId },
      orderBy: { fechaVencimiento: 'asc' },
      include: { producto: { select: { id: true, nombre: true } } },
    });
  }

  /** Lote manual (p. ej. stock inicial). Los de compras se crean solos. */
  @Post('lotes')
  async crearLote(
    @Body({ schema: crearLote }) body: z.infer<typeof crearLote>,
  ) {
    const lote = await this.prisma.lote.create({
      data: { ...body, fechaVencimiento: new Date(body.fechaVencimiento) },
    });
    this.realtime.emit(Eventos.LotesActualizados);
    return lote;
  }

  /** Retirar un lote agotado o descartado (no toca el stock). */
  @Delete('lotes/:id')
  async borrarLote(@Param('id', { schema: idParam }) loteId: number) {
    await this.prisma.lote.delete({ where: { id: loteId } });
    this.realtime.emit(Eventos.LotesActualizados);
    return { id: loteId };
  }
}
