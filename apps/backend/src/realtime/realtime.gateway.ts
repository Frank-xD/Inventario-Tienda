import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Eventos que el servidor emite. Solo llevan identificadores: el cliente
 * vuelve a pedir los datos que le corresponden (el portal público no debe
 * recibir cifras exactas de stock).
 */
export const Eventos = {
  /** { productoIds: number[] } — cambió el stock de esos productos */
  StockActualizado: 'stock:actualizado',
  /** { productoId: number } — se creó o editó un producto */
  ProductoActualizado: 'producto:actualizado',
  /** { ventaId: number } */
  VentaRegistrada: 'venta:registrada',
  /** { ventaId: number } */
  VentaAnulada: 'venta:anulada',
  /** { cajaId: number } — apertura, cierre o movimiento de caja */
  CajaActualizada: 'caja:actualizada',
  /** {} */
  AnunciosActualizados: 'anuncios:actualizados',
  /** {} — lotes nuevos o retirados */
  LotesActualizados: 'lotes:actualizados',
  /** {} — avisos leídos, nuevos avisos informativos o cambio de configuración */
  AvisosActualizados: 'avisos:actualizados',
  /** {} — datos de la tienda o preferencias de notificaciones */
  ConfiguracionActualizada: 'configuracion:actualizada',
  /** { proveedorId: number } */
  ProveedorActualizado: 'proveedor:actualizado',
  /** { categoriaId: number } */
  CategoriaActualizada: 'categoria:actualizada',
  /** { compraId: number } */
  CompraRegistrada: 'compra:registrada',
} as const;

export type Evento = (typeof Eventos)[keyof typeof Eventos];

@WebSocketGateway({
  namespace: '/tienda',
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Cliente conectado: ${client.id}`);
  }

  emit(evento: Evento, payload: object = {}) {
    this.server?.emit(evento, payload);
  }
}
