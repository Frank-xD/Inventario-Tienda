import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { idParam } from '../common/schemas.js';
import {
  type CrearProducto,
  crearProducto,
  type EditarProducto,
  editarProducto,
  type FiltrosProductos,
  filtrosProductos,
} from './productos.schemas.js';
import { ProductosService } from './productos.service.js';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(@Query({ schema: filtrosProductos }) filtros: FiltrosProductos) {
    return this.productos.listar(filtros);
  }

  @Get('codigo/:codigo')
  porCodigo(@Param('codigo') codigo: string) {
    return this.productos.porCodigo(codigo);
  }

  @Get(':id')
  detalle(@Param('id', { schema: idParam }) id: number) {
    return this.productos.detalle(id);
  }

  @Post()
  crear(@Body({ schema: crearProducto }) body: CrearProducto) {
    return this.productos.crear(body);
  }

  @Patch(':id')
  editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarProducto }) body: EditarProducto,
  ) {
    return this.productos.editar(id, body);
  }
}
