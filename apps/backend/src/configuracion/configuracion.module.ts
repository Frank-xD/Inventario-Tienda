import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller.js';

@Module({ controllers: [ConfiguracionController] })
export class ConfiguracionModule {}
