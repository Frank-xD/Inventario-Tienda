import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';
import type {
  CrearProducto,
  EditarProducto,
  FiltrosProductos,
} from './productos.schemas.js';

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Productos con su stock actual (vista v_stock). */
  async listar(f: FiltrosProductos) {
    const where: Prisma.ProductoWhereInput = {
      ...(f.inactivos === 'true' ? {} : { activo: true }),
      ...(f.categoriaId && { categoriaId: f.categoriaId }),
      ...(f.proveedorId && { proveedorId: f.proveedorId }),
      ...(f.q && {
        OR: [
          // ILIKE aprovecha el índice trigram idx_productos_nombre_trgm
          { nombre: { contains: f.q, mode: 'insensitive' } },
          { codigoBarras: f.q },
        ],
      }),
    };

    const productos = await this.prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        categoria: { select: { id: true, nombre: true } },
        proveedor: { select: { id: true, nombre: true } },
      },
    });
    const stock = await this.stockDe(productos.map((p) => p.id));
    return productos.map((p) => ({ ...p, stock: stock.get(p.id) ?? 0 }));
  }

  async detalle(id: number) {
    const producto = await this.prisma.producto.findUniqueOrThrow({
      where: { id },
      include: {
        categoria: true,
        proveedor: true,
        lotes: { orderBy: { fechaVencimiento: 'asc' } },
        movimientosInventario: { orderBy: { creadoEn: 'desc' }, take: 30 },
      },
    });
    const stock = await this.stockDe([id]);
    return { ...producto, stock: stock.get(id) ?? 0 };
  }

  /** Busca por código de barras (lector del POS). */
  async porCodigo(codigo: string) {
    const producto = await this.prisma.producto.findUniqueOrThrow({
      where: { codigoBarras: codigo },
    });
    const stock = await this.stockDe([producto.id]);
    return { ...producto, stock: stock.get(producto.id) ?? 0 };
  }

  async crear({ stockInicial, fechaVencimiento, ...data }: CrearProducto) {
    const producto = await this.prisma.$transaction(async (tx) => {
      const p = await tx.producto.create({ data });
      if (stockInicial) {
        await tx.movimientoInventario.create({
          data: {
            productoId: p.id,
            tipo: 'ajuste',
            cantidad: stockInicial,
            motivo: 'Stock inicial',
          },
        });
        if (fechaVencimiento) {
          await tx.lote.create({
            data: {
              productoId: p.id,
              fechaVencimiento: new Date(fechaVencimiento),
              cantidadInicial: stockInicial,
            },
          });
        }
      }
      return p;
    });

    this.realtime.emit(Eventos.ProductoActualizado, {
      productoId: producto.id,
    });
    if (stockInicial) {
      this.realtime.emit(Eventos.StockActualizado, {
        productoIds: [producto.id],
      });
    }
    return this.detalle(producto.id);
  }

  async editar(id: number, data: EditarProducto) {
    await this.prisma.producto.update({ where: { id }, data });
    this.realtime.emit(Eventos.ProductoActualizado, { productoId: id });
    return this.detalle(id);
  }

  async stockDe(ids: number[]) {
    if (ids.length === 0) return new Map<number, number>();
    const filas = await this.prisma.vStock.findMany({
      where: { productoId: { in: ids } },
      select: { productoId: true, stock: true },
    });
    return new Map(filas.map((f) => [f.productoId, f.stock]));
  }
}
