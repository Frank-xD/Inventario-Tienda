import { Body, Controller, Get, Patch } from '@nestjs/common';
import { z } from 'zod';
import { texto } from '../common/schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Eventos, RealtimeGateway } from '../realtime/realtime.gateway.js';

/** Texto opcional que se puede borrar enviando "" o null. */
const opcionalBorrable = z
  .string()
  .trim()
  .transform((s) => s || null)
  .nullable()
  .optional();

const editarConfiguracion = z.object({
  nombreTienda: texto.optional(),
  correo: z
    .union([z.email('Correo no válido'), z.literal('')])
    .transform((s) => s || null)
    .nullable()
    .optional(),
  telefono: opcionalBorrable,
  notifStock: z.boolean().optional(),
  notifVencimientos: z.boolean().optional(),
  notifProveedores: z.boolean().optional(),
  resumenSemanal: z.boolean().optional(),
});

@Controller('configuracion')
export class ConfiguracionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  obtener() {
    return this.prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });
  }

  @Patch()
  async editar(
    @Body({ schema: editarConfiguracion })
    body: z.infer<typeof editarConfiguracion>,
  ) {
    const cfg = await this.prisma.configuracion.update({
      where: { id: 1 },
      data: { ...body, actualizadoEn: new Date() },
    });
    // Cambiar notif_* abre o cierra avisos en la próxima sincronización.
    this.realtime.emit(Eventos.ConfiguracionActualizada);
    this.realtime.emit(Eventos.AvisosActualizados);
    return cfg;
  }
}
