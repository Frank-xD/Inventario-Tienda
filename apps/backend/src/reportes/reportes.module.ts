import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller.js';

@Module({ controllers: [ReportesController] })
export class ReportesModule {}
