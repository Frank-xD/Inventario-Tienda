import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { idParam } from '../common/schemas.js';
import {
  type CrearProducto,
  crearProducto,
  type EditarProducto,
  editarProducto,
  type FiltrosProductos,
  filtrosProductos,
} from './productos.schemas.js';
import { MAX_FOTO_BYTES, ProductosService } from './productos.service.js';

/** Lo que deja multer (almacenamiento en memoria, el predeterminado). */
interface ArchivoSubido {
  buffer: Buffer;
  size: number;
}

@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(@Query({ schema: filtrosProductos }) filtros: FiltrosProductos) {
    return this.productos.listar(filtros);
  }

  @Get('codigo/:codigo')
  porCodigo(@Param('codigo') codigo: string) {
    return this.productos.porCodigo(codigo);
  }

  @Get(':id')
  detalle(@Param('id', { schema: idParam }) id: number) {
    return this.productos.detalle(id);
  }

  @Post()
  crear(@Body({ schema: crearProducto }) body: CrearProducto) {
    return this.productos.crear(body);
  }

  @Patch(':id')
  editar(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editarProducto }) body: EditarProducto,
  ) {
    return this.productos.editar(id, body);
  }

  /**
   * Bytes de la foto. La URL lleva ?v=<fecha>, así que cambia al
   * reemplazarla y se puede guardar en caché sin vencimiento.
   */
  @Get(':id/foto')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async foto(@Param('id', { schema: idParam }) id: number) {
    const foto = await this.productos.foto(id);
    return new StreamableFile(Buffer.from(foto.datos), {
      type: foto.tipo,
      length: foto.datos.length,
    });
  }

  /**
   * Sube o reemplaza la foto (multipart/form-data, campo "foto").
   * El frontend la comprime a WebP antes de enviarla.
   */
  @Put(':id/foto')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_FOTO_BYTES, files: 1 } }),
  )
  subirFoto(
    @Param('id', { schema: idParam }) id: number,
    @UploadedFile() archivo: ArchivoSubido | undefined,
  ) {
    if (!archivo)
      throw new BadRequestException('Falta la imagen (campo "foto")');
    return this.productos.guardarFoto(id, archivo.buffer);
  }

  @Delete(':id/foto')
  @HttpCode(204)
  borrarFoto(@Param('id', { schema: idParam }) id: number) {
    return this.productos.borrarFoto(id);
  }
}
