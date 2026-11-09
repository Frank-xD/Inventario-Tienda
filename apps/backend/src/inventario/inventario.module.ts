import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller.js';

@Module({ controllers: [InventarioController] })
export class InventarioModule {}
