import { Module } from '@nestjs/common';
import { AvisosModule } from '../avisos/avisos.module.js';
import { CategoriasController } from './categorias.controller.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';
import { ProveedoresController } from './proveedores.controller.js';

@Module({
  imports: [AvisosModule],
  controllers: [
    CategoriasController,
    ProveedoresController,
    ProductosController,
  ],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class CatalogoModule {}
