import { Module } from '@nestjs/common';
import { AvisosController } from './avisos.controller.js';
import { AvisosService } from './avisos.service.js';

@Module({
  controllers: [AvisosController],
  providers: [AvisosService],
  exports: [AvisosService],
})
export class AvisosModule {}
