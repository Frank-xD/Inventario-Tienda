import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  dinero,
  fecha,
  idParam,
  montoPositivo,
  texto,
  textoOpcional,
} from '../common/schemas.js';
import { TIPOS_MOVIMIENTO_CAJA } from '../common/tienda.js';
import { CajaService } from './caja.service.js';

const abrir = z.object({
  montoInicial: dinero.default(0),
  notas: textoOpcional,
});
const cerrar = z.object({ montoContado: dinero, notas: textoOpcional });
const filtrosMovimientos = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  limite: z.coerce.number().int().min(1).max(500).default(200),
});
const filtrosHistorial = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  limite: z.coerce.number().int().min(1).max(365).default(30),
});
const movimiento = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO_CAJA),
  monto: montoPositivo,
  motivo: texto,
});

@Controller('cajas')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  /** Caja abierta con su resumen, o null si no hay ninguna. */
  @Get('actual')
  actual() {
    return this.caja.actual();
  }

  /** Cajas abiertas en el período (por fecha de apertura), con su resumen. */
  @Get()
  historial(@Query({ schema: filtrosHistorial }) f: z.infer<typeof filtrosHistorial>) {
    return this.caja.historial(f);
  }

  /** Ingresos y egresos extra de todas las cajas, del más reciente al más antiguo. */
  @Get('movimientos')
  movimientos(
    @Query({ schema: filtrosMovimientos })
    f: z.infer<typeof filtrosMovimientos>,
  ) {
    return this.caja.listarMovimientos(f);
  }

  @Get(':id')
  detalle(@Param('id', { schema: idParam }) id: number) {
    return this.caja.detalle(id);
  }

  @Post('abrir')
  abrir(@Body({ schema: abrir }) body: z.infer<typeof abrir>) {
    return this.caja.abrir(body.montoInicial, body.notas);
  }

  @Post(':id/cerrar')
  cerrar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: cerrar }) body: z.infer<typeof cerrar>,
  ) {
    return this.caja.cerrar(id, body.montoContado, body.notas);
  }

  /** Ingresos o egresos de efectivo que no son ventas (cambio, pago a un proveedor...). */
  @Post(':id/movimientos')
  movimiento(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: movimiento }) body: z.infer<typeof movimiento>,
  ) {
    return this.caja.registrarMovimiento(
      id,
      body.tipo,
      body.monto,
      body.motivo,
    );
  }
}
