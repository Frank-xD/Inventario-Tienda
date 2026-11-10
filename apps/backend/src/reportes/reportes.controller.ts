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

    const [alertas, vencimientos, caja, proveedores] = await Promise.all([
      this.prisma.vAlertaStock.groupBy({ by: ['nivel'], _count: true }),
      this.prisma.vPorVencer.groupBy({ by: ['nivel'], _count: true }),
      this.prisma.caja.findFirst({
        where: { cerradaEn: null },
        select: { id: true },
      }),
      this.prisma.proveedor.groupBy({ by: ['activo'], _count: true }),
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
      proveedores: {
        activos: proveedores.find((p) => p.activo)?._count ?? 0,
        inactivos: proveedores.find((p) => !p.activo)?._count ?? 0,
      },
      cajaAbiertaId: caja?.id ?? null,
    };
  }

  /**
   * Últimos movimientos para el panel: ventas, compras y ajustes/mermas de
   * inventario en una sola lista, del más reciente al más antiguo.
   */
  @Get('movimientos-recientes')
  async movimientosRecientes(
    @Query('limite', {
      schema: z.coerce.number().int().min(1).max(100).default(10),
    })
    limite: number,
  ) {
    const filas = await this.prisma.$queryRaw<
      {
        tipo: 'venta' | 'compra' | 'ajuste' | 'merma';
        id: number;
        fecha: Date;
        detalle: string;
        total: unknown;
        estado: string;
      }[]
    >`
      (SELECT 'venta' AS tipo, v.id, v.fecha,
              COUNT(d.id) || CASE WHEN COUNT(d.id) = 1 THEN ' producto' ELSE ' productos' END
                || ' · ' || CASE v.metodo_pago WHEN 'efectivo' THEN 'efectivo' ELSE 'transferencia/QR' END AS detalle,
              v.total, v.estado
         FROM ventas v JOIN detalle_venta d ON d.venta_id = v.id
        GROUP BY v.id
        ORDER BY v.fecha DESC LIMIT ${limite})
      UNION ALL
      (SELECT 'compra', c.id, c.fecha,
              p.nombre || ' · ' || COUNT(d.id) || CASE WHEN COUNT(d.id) = 1 THEN ' producto' ELSE ' productos' END,
              c.total, 'completada'
         FROM compras c
         JOIN proveedores p ON p.id = c.proveedor_id
         JOIN detalle_compra d ON d.compra_id = c.id
        GROUP BY c.id, p.nombre
        ORDER BY c.fecha DESC LIMIT ${limite})
      UNION ALL
      (SELECT m.tipo, m.id::int, m.creado_en,
              p.nombre || ' ' || CASE WHEN m.cantidad > 0 THEN '+' ELSE '' END
                || fn_fmt_cantidad(m.cantidad, p.unidad_medida)
                || COALESCE(' · ' || m.motivo, ''),
              ROUND(ABS(m.cantidad) * p.costo, 2), 'completada'
         FROM movimientos_inventario m
         JOIN productos p ON p.id = m.producto_id
        WHERE m.tipo IN ('ajuste', 'merma')
        ORDER BY m.creado_en DESC LIMIT ${limite})
      ORDER BY fecha DESC
      LIMIT ${limite}`;
    return filas.map((f) => ({ ...f, total: n(f.total) }));
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
