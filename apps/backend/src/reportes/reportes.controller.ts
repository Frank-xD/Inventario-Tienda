import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { TIENDA_TZ } from '../common/tienda.js';
import { PrismaService } from '../prisma/prisma.service.js';

const n = (v: unknown) => Number(v ?? 0);

@Controller('reportes')
export class ReportesController {
  constructor(private readonly prisma: PrismaService) {}

  /** KPIs del panel: ventas de hoy, alertas, vencimientos y valor del inventario. */
  @Get('resumen')
  async resumen() {
    const [hoy] = await this.prisma.$queryRaw<
      {
        total: unknown;
        ventas: unknown;
        efectivo: unknown;
        transferencia: unknown;
      }[]
    >`
      SELECT COALESCE(SUM(total), 0)                                              AS total,
             COUNT(*)                                                             AS ventas,
             COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'efectivo'), 0)      AS efectivo,
             COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'transferencia'), 0) AS transferencia
        FROM ventas
       WHERE estado = 'completada'
         AND (fecha AT TIME ZONE ${TIENDA_TZ})::date = (now() AT TIME ZONE ${TIENDA_TZ})::date`;

    const [inventario] = await this.prisma.$queryRaw<
      { productos: unknown; valor_costo: unknown; valor_venta: unknown }[]
    >`
      SELECT COUNT(*)                                          AS productos,
             COALESCE(SUM(GREATEST(s.stock, 0) * p.costo), 0)  AS valor_costo,
             COALESCE(SUM(GREATEST(s.stock, 0) * p.precio), 0) AS valor_venta
        FROM productos p
        JOIN v_stock s ON s.producto_id = p.id
       WHERE p.activo`;

    const [alertas, vencimientos, caja] = await Promise.all([
      this.prisma.vAlertaStock.groupBy({ by: ['nivel'], _count: true }),
      this.prisma.vPorVencer.groupBy({ by: ['nivel'], _count: true }),
      this.prisma.caja.findFirst({
        where: { cerradaEn: null },
        select: { id: true },
      }),
    ]);
    const contar = (
      filas: { nivel: string; _count: number }[],
      nivel: string,
    ) => filas.find((f) => f.nivel === nivel)?._count ?? 0;

    const ventasHoy = n(hoy.ventas);
    return {
      hoy: {
        total: n(hoy.total),
        ventas: ventasHoy,
        ticketPromedio: ventasHoy
          ? Math.round((n(hoy.total) / ventasHoy) * 100) / 100
          : 0,
        efectivo: n(hoy.efectivo),
        transferencia: n(hoy.transferencia),
      },
      inventario: {
        productosActivos: n(inventario.productos),
        valorCosto: n(inventario.valor_costo),
        valorVenta: n(inventario.valor_venta),
      },
      alertas: {
        agotados: contar(alertas, 'agotado'),
        bajos: contar(alertas, 'bajo'),
      },
      vencimientos: {
        vencidos: contar(vencimientos, 'vencido'),
        porVencer: contar(vencimientos, 'por_vencer'),
      },
      cajaAbiertaId: caja?.id ?? null,
    };
  }

  /** Ventas completadas por día (zona horaria de la tienda), con días en cero. */
  @Get('ventas-diarias')
  async ventasDiarias(
    @Query('dias', {
      schema: z.coerce.number().int().min(1).max(366).default(14),
    })
    dias: number,
  ) {
    const filas = await this.prisma.$queryRaw<
      {
        dia: Date;
        total: unknown;
        ventas: unknown;
        efectivo: unknown;
        transferencia: unknown;
      }[]
    >`
      WITH dias AS (
        SELECT generate_series(
                 (now() AT TIME ZONE ${TIENDA_TZ})::date - (${dias}::int - 1),
                 (now() AT TIME ZONE ${TIENDA_TZ})::date,
                 interval '1 day')::date AS dia
      )
      SELECT d.dia,
             COALESCE(SUM(v.total), 0)                                                AS total,
             COUNT(v.id)                                                              AS ventas,
             COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago = 'efectivo'), 0)      AS efectivo,
             COALESCE(SUM(v.total) FILTER (WHERE v.metodo_pago = 'transferencia'), 0) AS transferencia
        FROM dias d
        LEFT JOIN ventas v
               ON v.estado = 'completada'
              AND (v.fecha AT TIME ZONE ${TIENDA_TZ})::date = d.dia
       GROUP BY d.dia
       ORDER BY d.dia`;

    return filas.map((f) => ({
      dia: f.dia.toISOString().slice(0, 10),
      total: n(f.total),
      ventas: n(f.ventas),
      efectivo: n(f.efectivo),
      transferencia: n(f.transferencia),
    }));
  }

  /** Más vendidos y margen (vista v_ventas_por_producto). */
  @Get('ventas-por-producto')
  ventasPorProducto(
    @Query('orden', {
      schema: z.enum(['unidades', 'ingresos', 'margen']).default('unidades'),
    })
    orden: 'unidades' | 'ingresos' | 'margen',
    @Query('limite', {
      schema: z.coerce.number().int().min(1).max(100).default(10),
    })
    limite: number,
  ) {
    return this.prisma.vVentaPorProducto.findMany({
      orderBy: { [orden]: 'desc' },
      take: limite,
    });
  }
}
