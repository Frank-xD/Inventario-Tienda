import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

export const TIPOS_AVISO = [
  'stock',
  'vencimiento',
  'proveedor',
  'info',
] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

/** Avisos resueltos que se siguen mostrando (historial reciente). */
const DIAS_HISTORIAL = 30;

@Injectable()
export class AvisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Abre y cierra los avisos de stock, vencimiento y proveedores según el
   * estado actual (fn_sincronizar_avisos en la BD). Se llama al leer, así
   * los vencimientos aparecen aunque nadie haya tocado el inventario.
   */
  async sincronizar() {
    await this.prisma.$executeRaw`SELECT fn_sincronizar_avisos()`;
  }

  async listar(tipo?: TipoAviso, limite = 100) {
    await this.sincronizar();
    const desde = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000);
    const [avisos, noLeidos] = await Promise.all([
      this.prisma.aviso.findMany({
        where: {
          ...(tipo && { tipo }),
          // Abiertos siempre; resueltos e informativos, solo los recientes.
          OR: [
            { resueltoEn: null, tipo: { not: 'info' } },
            { creadoEn: { gte: desde } },
          ],
        },
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        take: limite,
      }),
      this.contarNoLeidos(),
    ]);
    return { avisos, noLeidos };
  }

  /** Lo que cuenta la campana: sin leer y todavía vigentes. */
  contarNoLeidos() {
    return this.prisma.aviso.count({
      where: { leidoEn: null, resueltoEn: null },
    });
  }

  async marcarLeido(id: number) {
    await this.prisma.aviso.updateMany({
      where: { id, leidoEn: null },
      data: { leidoEn: new Date() },
    });
    this.realtime.emit(Eventos.AvisosActualizados);
  }

  async marcarTodosLeidos() {
    const { count } = await this.prisma.aviso.updateMany({
      where: { leidoEn: null },
      data: { leidoEn: new Date() },
    });
    this.realtime.emit(Eventos.AvisosActualizados);
    return { marcados: count };
  }

  /** Aviso informativo (proveedor, categoría o producto nuevos). */
  async informar(texto: string, productoId?: number) {
    await this.prisma.aviso.create({
      data: { tipo: 'info', titulo: 'Información', texto, productoId },
    });
    this.realtime.emit(Eventos.AvisosActualizados);
  }
}
