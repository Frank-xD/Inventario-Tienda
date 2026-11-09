import { Module } from '@nestjs/common';
import { CategoriasController } from './categorias.controller.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';
import { ProveedoresController } from './proveedores.controller.js';

@Module({
  controllers: [
    CategoriasController,
    ProveedoresController,
    ProductosController,
  ],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class CatalogoModule {}
