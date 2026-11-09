import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller.js';
import { CajaService } from './caja.service.js';

@Module({
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}
