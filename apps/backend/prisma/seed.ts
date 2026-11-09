import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const data: Record<
  string,
  {
    sku: string;
    name: string;
    price: number;
    stock: number;
    minStock: number;
  }[]
> = {
  Bebidas: [
    {
      sku: 'BEB-001',
      name: 'Agua mineral 600ml',
      price: 12,
      stock: 48,
      minStock: 12,
    },
    {
      sku: 'BEB-002',
      name: 'Refresco de cola 2L',
      price: 38,
      stock: 20,
      minStock: 6,
    },
    {
      sku: 'BEB-003',
      name: 'Jugo de naranja 1L',
      price: 29,
      stock: 4,
      minStock: 6,
    },
  ],
  Abarrotes: [
    { sku: 'ABA-001', name: 'Arroz 1kg', price: 32, stock: 30, minStock: 10 },
    {
      sku: 'ABA-002',
      name: 'Frijol negro 1kg',
      price: 41,
      stock: 18,
      minStock: 8,
    },
    {
      sku: 'ABA-003',
      name: 'Aceite vegetal 1L',
      price: 55,
      stock: 3,
      minStock: 5,
    },
  ],
  Limpieza: [
    {
      sku: 'LIM-001',
      name: 'Detergente 1kg',
      price: 48,
      stock: 15,
      minStock: 5,
    },
    {
      sku: 'LIM-002',
      name: 'Jabón de trastes',
      price: 27,
      stock: 22,
      minStock: 6,
    },
  ],
};

async function main() {
  for (const [categoryName, products] of Object.entries(data)) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    for (const p of products) {
      await prisma.product.upsert({
        where: { sku: p.sku },
        update: {},
        create: { ...p, categoryId: category.id },
      });
    }
  }
  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
