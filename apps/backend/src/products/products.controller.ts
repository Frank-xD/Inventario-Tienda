import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import type {
  CreateProductInput,
  StockMovementInput,
  UpdateProductInput,
} from './products.types.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll() {
    return this.products.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() body: CreateProductInput) {
    return this.products.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductInput,
  ) {
    return this.products.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.products.remove(id);
  }

  @Post(':id/movements')
  registerMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: StockMovementInput,
  ) {
    return this.products.registerMovement(id, body);
  }
}
