import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';
import { tipoDeImagen, urlFoto } from './fotos.js';
import type {
  CrearProducto,
  EditarProducto,
  FiltrosProductos,
} from './productos.schemas.js';

/** Máximo que acepta producto_fotos (CHECK en la BD). El cliente comprime antes. */
export const MAX_FOTO_BYTES = 512 * 1024;

/** Solo la fecha de la foto: los bytes se piden aparte en GET /productos/:id/foto. */
const conFoto = { foto: { select: { actualizadaEn: true } } } as const;

type ConFoto<T> = T & { foto: { actualizadaEn: Date } | null };

/** Reemplaza la relación `foto` por `fotoUrl` (o null). */
function sinBytes<T extends { id: number }>({ foto, ...p }: ConFoto<T>) {
  return { ...p, fotoUrl: foto ? urlFoto(p.id, foto.actualizadaEn) : null };
}

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly avisos: AvisosService,
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
        ...conFoto,
      },
    });
    const stock = await this.stockDe(productos.map((p) => p.id));
    return productos.map((p) => ({
      ...sinBytes(p),
      stock: stock.get(p.id) ?? new Prisma.Decimal(0),
    }));
  }

  async detalle(id: number) {
    const producto = await this.prisma.producto.findUniqueOrThrow({
      where: { id },
      include: {
        categoria: true,
        proveedor: true,
        lotes: { orderBy: { fechaVencimiento: 'asc' } },
        movimientosInventario: { orderBy: { creadoEn: 'desc' }, take: 30 },
        ...conFoto,
      },
    });
    const stock = await this.stockDe([id]);
    return {
      ...sinBytes(producto),
      stock: stock.get(id) ?? new Prisma.Decimal(0),
    };
  }

  /** Busca por código de barras (lector del POS). */
  async porCodigo(codigo: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { codigoBarras: codigo },
      include: conFoto,
    });
    if (!producto)
      throw new NotFoundException(`No hay un producto con el código ${codigo}`);
    const stock = await this.stockDe([producto.id]);
    return {
      ...sinBytes(producto),
      stock: stock.get(producto.id) ?? new Prisma.Decimal(0),
    };
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
    await this.avisos.informar(
      `Se agregó el producto ${producto.nombre}.`,
      producto.id,
    );
    return this.detalle(producto.id);
  }

  async editar(id: number, data: EditarProducto) {
    await this.prisma.producto.update({ where: { id }, data });
    this.realtime.emit(Eventos.ProductoActualizado, { productoId: id });
    return this.detalle(id);
  }

  async stockDe(ids: number[]) {
    if (ids.length === 0) return new Map<number, Prisma.Decimal>();
    const filas = await this.prisma.vStock.findMany({
      where: { productoId: { in: ids } },
      select: { productoId: true, stock: true },
    });
    return new Map(filas.map((f) => [f.productoId, f.stock]));
  }

  // -------------------------------------------------------------------
  // Fotos (bytes en producto_fotos)
  // -------------------------------------------------------------------

  async foto(id: number) {
    const foto = await this.prisma.productoFoto.findUnique({
      where: { productoId: id },
    });
    if (!foto) throw new NotFoundException('El producto no tiene foto');
    return foto;
  }

  /**
   * Guarda (o reemplaza) la foto. El tipo se detecta por los bytes, no por
   * lo que declara el navegador.
   */
  async guardarFoto(id: number, datos: Buffer) {
    if (datos.length === 0)
      throw new BadRequestException('La imagen está vacía');
    if (datos.length > MAX_FOTO_BYTES) {
      throw new BadRequestException(
        `La imagen pesa ${Math.round(datos.length / 1024)} KB; el máximo es ${MAX_FOTO_BYTES / 1024} KB`,
      );
    }
    const tipo = tipoDeImagen(datos);
    if (!tipo)
      throw new BadRequestException(
        'Formato no admitido: usa WebP, JPEG o PNG',
      );

    await this.prisma.producto.findUniqueOrThrow({
      where: { id },
      select: { id: true },
    });
    const bytes = new Uint8Array(datos);
    const foto = await this.prisma.productoFoto.upsert({
      where: { productoId: id },
      create: { productoId: id, datos: bytes, tipo },
      update: { datos: bytes, tipo, actualizadaEn: new Date() },
      select: { actualizadaEn: true },
    });
    this.realtime.emit(Eventos.ProductoActualizado, { productoId: id });
    return {
      fotoUrl: urlFoto(id, foto.actualizadaEn),
      bytes: datos.length,
      tipo,
    };
  }

  async borrarFoto(id: number) {
    await this.prisma.productoFoto.deleteMany({ where: { productoId: id } });
    this.realtime.emit(Eventos.ProductoActualizado, { productoId: id });
  }
}
