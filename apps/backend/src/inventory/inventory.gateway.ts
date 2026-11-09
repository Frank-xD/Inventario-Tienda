import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

/** Eventos que el servidor emite a los clientes conectados. */
export const InventoryEvents = {
  ProductCreated: 'product:created',
  ProductUpdated: 'product:updated',
  ProductDeleted: 'product:deleted',
  StockChanged: 'stock:changed',
} as const;

@WebSocketGateway({
  namespace: '/inventory',
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true },
})
export class InventoryGateway implements OnGatewayConnection {
  private readonly logger = new Logger(InventoryGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Cliente conectado: ${client.id}`);
  }

  emit(
    event: (typeof InventoryEvents)[keyof typeof InventoryEvents],
    payload: unknown,
  ) {
    this.server?.emit(event, payload);
  }
}
