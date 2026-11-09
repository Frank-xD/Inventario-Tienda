import type { MovementType } from '../generated/prisma/client.js';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  price: number;
  stock?: number;
  minStock?: number;
  categoryId?: number | null;
}

export type UpdateProductInput = Partial<CreateProductInput> & {
  active?: boolean;
};

export interface StockMovementInput {
  type: MovementType;
  quantity: number;
  note?: string;
}
