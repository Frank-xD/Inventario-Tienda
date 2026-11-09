import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TipoMovimientoCaja } from '../common/tienda.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class CajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Caja abierta o null. El índice uq_una_caja_abierta garantiza que hay como mucho una. */
  abierta() {
    return this.prisma.caja.findFirst({ where: { cerradaEn: null } });
  }

  async abiertaOrThrow() {
    const caja = await this.abierta();
    if (!caja) throw new ConflictException('No hay una caja abierta');
    return caja;
  }

  /** Caja abierta con su resumen (vista v_resumen_caja) y movimientos. */
  async actual() {
    const caja = await this.abierta();
    if (!caja) return null;
    return this.detalle(caja.id);
  }

  async detalle(id: number) {
    const [caja, resumen] = await Promise.all([
      this.prisma.caja.findUnique({
        where: { id },
        include: { movimientos: { orderBy: { creadoEn: 'desc' } } },
      }),
      this.prisma.vResumenCaja.findUnique({ where: { cajaId: id } }),
    ]);
    if (!caja) throw new NotFoundException(`Caja ${id} no encontrada`);
    return { ...caja, resumen };
  }

  historial(limite = 30) {
    return this.prisma.vResumenCaja.findMany({
      orderBy: { abiertaEn: 'desc' },
      take: limite,
    });
  }

  async abrir(montoInicial: number, notas?: string | null) {
    if (await this.abierta()) {
      throw new ConflictException('Ya hay una caja abierta; ciérrala primero');
    }
    const caja = await this.prisma.caja.create({
      data: { montoInicial, notas: notas ?? null },
    });
    this.realtime.emit(Eventos.CajaActualizada, { cajaId: caja.id });
    return this.detalle(caja.id);
  }

  /** Cierre con arqueo: se guarda lo contado y la vista calcula la diferencia. */
  async cerrar(id: number, montoContado: number, notas?: string | null) {
    const caja = await this.prisma.caja.findUnique({ where: { id } });
    if (!caja) throw new NotFoundException(`Caja ${id} no encontrada`);
    if (caja.cerradaEn)
      throw new BadRequestException('La caja ya está cerrada');

    await this.prisma.caja.update({
      where: { id },
      data: {
        cerradaEn: new Date(),
        montoContado,
        ...(notas !== undefined && { notas }),
      },
    });
    this.realtime.emit(Eventos.CajaActualizada, { cajaId: id });
    return this.detalle(id);
  }

  async registrarMovimiento(
    id: number,
    tipo: TipoMovimientoCaja,
    monto: number,
    motivo: string,
  ) {
    const caja = await this.prisma.caja.findUnique({ where: { id } });
    if (!caja) throw new NotFoundException(`Caja ${id} no encontrada`);
    if (caja.cerradaEn) throw new BadRequestException('La caja está cerrada');

    const mov = await this.prisma.movimientoCaja.create({
      data: { cajaId: id, tipo, monto, motivo },
    });
    this.realtime.emit(Eventos.CajaActualizada, { cajaId: id });
    return mov;
  }
}
