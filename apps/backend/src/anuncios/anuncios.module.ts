import { Module } from '@nestjs/common';
import { AnunciosController } from './anuncios.controller.js';

@Module({ controllers: [AnunciosController] })
export class AnunciosModule {}
