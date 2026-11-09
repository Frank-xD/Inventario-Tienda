import './common/bigint-json.js';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  // Valida @Body/@Query/@Param que declaran { schema } (zod).
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
