import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller.js';

@Module({ controllers: [ComprasController] })
export class ComprasModule {}
