import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Se usa process.env para que `prisma generate` funcione sin base de datos.
    url: process.env.DATABASE_URL ?? '',
  },
});
