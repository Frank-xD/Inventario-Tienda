import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { finDia, inicioDia } from '../common/tienda.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';
import type { CrearVenta, FiltrosVentas } from './ventas.schemas.js';

const { Decimal } = Prisma;

const include = {
  detalles: { include: { producto: { select: { id: true, nombre: true } } } },
} as const;

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  listar(f: FiltrosVentas) {
    return this.prisma.venta.findMany({
      where: {
        cajaId: f.cajaId,
        estado: f.estado,
        fecha: {
          ...(f.desde && { gte: inicioDia(f.desde) }),
          ...(f.hasta && { lte: finDia(f.hasta) }),
        },
      },
      orderBy: { fecha: 'desc' },
      take: f.limite,
      include,
    });
  }

  detalle(id: number) {
    return this.prisma.venta.findUniqueOrThrow({ where: { id }, include });
  }

  /**
   * Registra una venta en la caja abierta. El precio y el costo se copian del
   * producto en ese momento. El trigger trg_venta_a_inventario descuenta el stock.
   */
  async crear(input: CrearVenta) {
    const productoIds = [...new Set(input.items.map((i) => i.productoId))];

    const venta = await this.prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findFirst({ where: { cerradaEn: null } });
      if (!caja) throw new ConflictException('Abre la caja antes de vender');

      // Bloquea las filas de los productos para que dos ventas simultáneas
      // no vendan el mismo stock.
      await tx.$queryRaw`SELECT id FROM productos WHERE id = ANY(${productoIds}::int[]) FOR UPDATE`;

      const productos = await tx.producto.findMany({
        where: { id: { in: productoIds } },
      });
      const porId = new Map(productos.map((p) => [p.id, p]));
      const stock = new Map(
        (
          await tx.vStock.findMany({
            where: { productoId: { in: productoIds } },
          })
        ).map((s) => [s.productoId, s.stock]),
      );

      // Unidades pedidas por producto (puede repetirse en varias líneas).
      const pedido = new Map<number, number>();
      for (const item of input.items) {
        pedido.set(
          item.productoId,
          (pedido.get(item.productoId) ?? 0) + item.cantidad,
        );
      }
      for (const [productoId, unidades] of pedido) {
        const p = porId.get(productoId);
        if (!p) throw new NotFoundException(`Producto ${productoId} no existe`);
        if (!p.activo)
          throw new BadRequestException(`"${p.nombre}" está inactivo`);
        const disponible = stock.get(productoId) ?? 0;
        if (disponible < unidades) {
          throw new ConflictException(
            `Stock insuficiente de "${p.nombre}": hay ${disponible}, se piden ${unidades}`,
          );
        }
      }

      let subtotal = new Decimal(0);
      const detalles = input.items.map((item) => {
        const p = porId.get(item.productoId)!;
        const bruto = p.precio.mul(item.cantidad);
        if (bruto.lessThan(item.descuento)) {
          throw new BadRequestException(
            `El descuento de "${p.nombre}" supera el importe de la línea`,
          );
        }
        subtotal = subtotal.add(bruto.sub(item.descuento));
        return {
          productoId: p.id,
          cantidad: item.cantidad,
          precioUnit: p.precio,
          costoUnit: p.costo,
          descuento: item.descuento,
        };
      });

      if (subtotal.lessThan(input.descuento)) {
        throw new BadRequestException('El descuento supera el subtotal');
      }

      return tx.venta.create({
        data: {
          cajaId: caja.id,
          metodoPago: input.metodoPago,
          subtotal,
          descuento: input.descuento,
          total: subtotal.sub(input.descuento),
          detalles: { create: detalles },
        },
        include,
      });
    });

    this.realtime.emit(Eventos.VentaRegistrada, { ventaId: venta.id });
    this.realtime.emit(Eventos.StockActualizado, { productoIds });
    this.realtime.emit(Eventos.CajaActualizada, { cajaId: venta.cajaId });
    return venta;
  }

  /** Anula la venta; el trigger trg_anular_venta devuelve el stock. */
  async anular(id: number, motivo: string) {
    const venta = await this.prisma.venta.findUnique({
      where: { id },
      include: { detalles: { select: { productoId: true } } },
    });
    if (!venta) throw new NotFoundException(`Venta ${id} no encontrada`);
    if (venta.estado === 'anulada') {
      throw new BadRequestException('La venta ya está anulada');
    }

    const anulada = await this.prisma.venta.update({
      where: { id },
      data: { estado: 'anulada', motivoAnulacion: motivo },
      include,
    });

    this.realtime.emit(Eventos.VentaAnulada, { ventaId: id });
    this.realtime.emit(Eventos.StockActualizado, {
      productoIds: [...new Set(venta.detalles.map((d) => d.productoId))],
    });
    this.realtime.emit(Eventos.CajaActualizada, { cajaId: venta.cajaId });
    return anulada;
  }
}
