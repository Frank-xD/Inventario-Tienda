import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  InventoryEvents,
  InventoryGateway,
} from '../inventory/inventory.gateway.js';
import type {
  CreateProductInput,
  StockMovementInput,
  UpdateProductInput,
} from './products.types.js';

const include = { category: true } as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: InventoryGateway,
  ) {}

  findAll() {
    return this.prisma.product.findMany({ include, orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ...include,
        movements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!product) throw new NotFoundException(`Producto ${id} no encontrado`);
    return product;
  }

  async create(data: CreateProductInput) {
    const product = await this.prisma.product.create({ data, include });
    this.gateway.emit(InventoryEvents.ProductCreated, product);
    return product;
  }

  async update(id: number, data: UpdateProductInput) {
    await this.findOne(id);
    const product = await this.prisma.product.update({
      where: { id },
      data,
      include,
    });
    this.gateway.emit(InventoryEvents.ProductUpdated, product);
    return product;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    this.gateway.emit(InventoryEvents.ProductDeleted, { id });
    return { id };
  }

  /** Registra un movimiento y actualiza el stock en una única transacción. */
  async registerMovement(id: number, input: StockMovementInput) {
    if (!Number.isInteger(input.quantity) || input.quantity < 0) {
      throw new BadRequestException('quantity debe ser un entero >= 0');
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw new NotFoundException(`Producto ${id} no encontrado`);

      let stock: number;
      switch (input.type) {
        case 'IN':
          stock = current.stock + input.quantity;
          break;
        case 'OUT':
          stock = current.stock - input.quantity;
          if (stock < 0) throw new BadRequestException('Stock insuficiente');
          break;
        case 'ADJUSTMENT':
          stock = input.quantity;
          break;
        default:
          throw new BadRequestException('Tipo de movimiento inválido');
      }

      await tx.stockMovement.create({ data: { productId: id, ...input } });
      return tx.product.update({ where: { id }, data: { stock }, include });
    });

    this.gateway.emit(InventoryEvents.StockChanged, product);
    return product;
  }
}
