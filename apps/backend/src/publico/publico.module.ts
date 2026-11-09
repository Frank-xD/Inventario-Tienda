import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller.js';

@Module({ controllers: [PublicoController] })
export class PublicoModule {}
