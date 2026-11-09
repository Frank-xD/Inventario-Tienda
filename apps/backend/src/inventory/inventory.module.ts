import { Global, Module } from '@nestjs/common';
import { InventoryGateway } from './inventory.gateway.js';

@Global()
@Module({
  providers: [InventoryGateway],
  exports: [InventoryGateway],
})
export class InventoryModule {}
