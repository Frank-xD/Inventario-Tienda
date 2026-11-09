import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Datos agregados para los gráficos del dashboard (Recharts). */
@Controller('stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        stock: true,
        minStock: true,
        price: true,
        category: { select: { name: true } },
      },
    });

    const byCategory = new Map<string, { stock: number; value: number }>();
    let inventoryValue = 0;
    let lowStock = 0;

    for (const p of products) {
      const value = Number(p.price) * p.stock;
      inventoryValue += value;
      if (p.stock <= p.minStock) lowStock++;
      const key = p.category?.name ?? 'Sin categoría';
      const entry = byCategory.get(key) ?? { stock: 0, value: 0 };
      entry.stock += p.stock;
      entry.value += value;
      byCategory.set(key, entry);
    }

    return {
      totalProducts: products.length,
      totalUnits: products.reduce((acc, p) => acc + p.stock, 0),
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      lowStock,
      byCategory: [...byCategory].map(([category, v]) => ({
        category,
        stock: v.stock,
        value: Math.round(v.value * 100) / 100,
      })),
    };
  }
}
