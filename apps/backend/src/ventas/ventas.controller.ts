import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { idParam } from '../common/schemas.js';
import {
  anularVenta,
  type CrearVenta,
  crearVenta,
  type FiltrosVentas,
  filtrosVentas,
} from './ventas.schemas.js';
import { VentasService } from './ventas.service.js';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Get()
  listar(@Query({ schema: filtrosVentas }) filtros: FiltrosVentas) {
    return this.ventas.listar(filtros);
  }

  @Get(':id')
  detalle(@Param('id', { schema: idParam }) id: number) {
    return this.ventas.detalle(id);
  }

  @Post()
  crear(@Body({ schema: crearVenta }) body: CrearVenta) {
    return this.ventas.crear(body);
  }

  @Post(':id/anular')
  anular(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: anularVenta }) body: { motivo: string },
  ) {
    return this.ventas.anular(id, body.motivo);
  }
}
