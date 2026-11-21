import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Opciones de conexión para `pg` a partir de DATABASE_URL.
 *
 * Con `?sslmode=require` (Supabase u otro Postgres administrado) la conexión
 * va cifrada sin validar la cadena del certificado: el certificado de Supabase
 * lo firma su propia CA y `pg` lo rechazaría. Se quita `sslmode` de la URL
 * porque `pg` le da prioridad sobre la opción `ssl`. La CLI de Prisma
 * (migraciones) lee la misma URL y sí entiende `sslmode=require`.
 *
 * Sin `sslmode` (Docker local) la conexión es la de siempre, sin SSL.
 */
export function opcionesConexion(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  const modo = url.searchParams.get('sslmode');
  if (!modo || modo === 'disable') return { connectionString: databaseUrl };
  url.searchParams.delete('sslmode');
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const adapter = new PrismaPg(opcionesConexion(config.getOrThrow<string>('DATABASE_URL')));
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
