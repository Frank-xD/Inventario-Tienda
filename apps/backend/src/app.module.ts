import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AnunciosModule } from './anuncios/anuncios.module.js';
import { AvisosModule } from './avisos/avisos.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CajaModule } from './caja/caja.module.js';
import { CatalogoModule } from './catalogo/catalogo.module.js';
import { ComprasModule } from './compras/compras.module.js';
import { ConfiguracionModule } from './configuracion/configuracion.module.js';
import { HealthController } from './health/health.controller.js';
import { InventarioModule } from './inventario/inventario.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PublicoModule } from './publico/publico.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ReportesModule } from './reportes/reportes.module.js';
import { VentasModule } from './ventas/ventas.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    PrismaModule,
    RealtimeModule,
    CatalogoModule,
    InventarioModule,
    ComprasModule,
    CajaModule,
    VentasModule,
    AnunciosModule,
    PublicoModule,
    ReportesModule,
    AvisosModule,
    ConfiguracionModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
